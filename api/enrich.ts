import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enrichBusinessWebsite } from '../server/enrichService.js';
import { auditWebsiteTracking } from '../server/trackingAuditService.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { hasBusinessUnlockAccess } from '../server/entitlementService.js';
import { getSubscriptionAccess } from '../server/subscriptionAccessService.js';
import { fetchBusinessesFromSerper } from '../server/serperService.js';
import { findJobsForBusiness, hasJoobleKey } from '../server/jobsService.js';

function stripPaidEmail(result: any, allowEmail: boolean) {
  if (!result || typeof result !== 'object') return result;
  if (allowEmail) return result;
  const safe = { ...result };
  delete safe.email;
  delete safe.emails;
  return safe;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hiring signals ("Contratando"): company website + public job boards, and Jooble when a key is set.
  if (req.query.__scoutly_handler === 'jobs') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
    try {
      await requireFirebaseIdentity(req as any);
      const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
      const name = str(req.query.name);
      const website = str(req.query.url);
      if (!name && !website) return res.status(400).json({ error: 'name or url is required' });

      const result = await findJobsForBusiness({
        name,
        website,
        location: str(req.query.location),
        aggregator: req.query.aggregator === '1',
      });
      res.setHeader('Cache-Control', 'private, max-age=600');
      return res.status(200).json({ ...result, aggregatorAvailable: hasJoobleKey() });
    } catch (error: any) {
      const status = Number(error?.statusCode || 500);
      console.error('[Scoutly Jobs Error]:', error?.message || error);
      return res.status(status).json({ error: error?.message || 'Erro ao buscar vagas.' });
    }
  }

  if (req.query.__scoutly_handler === 'social-check') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
      const result = await enrichBusinessWebsite(url);
      const socials = Object.values(result.socials || {})
        .map((item: any) => item?.value)
        .filter(Boolean);

      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      return res.status(200).json({
        hasSocial: socials.length > 0,
        socials,
        siteStatus: result.siteStatus,
        checkedAt: result.updatedAt,
      });
    } catch (error: any) {
      console.error('[Scoutly Social Check Error]:', error?.message || error);
      return res.status(500).json({
        error: 'Erro ao verificar redes sociais.',
        details: error?.message || String(error),
      });
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const businessId = typeof req.query.businessId === 'string' ? req.query.businessId.trim() : '';
    const businessName = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : '';
    const knownPhone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const force = req.query.force === '1' || req.query.force === 'true';

    if (!url && !businessName) return res.status(400).json({ error: 'URL or business name is required' });
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const [allowed, access] = await Promise.all([
      hasBusinessUnlockAccess(identity.uid, businessId),
      getSubscriptionAccess(identity.uid),
    ]);

    if (!allowed) {
      return res.status(403).json({
        error: 'Abra este negócio primeiro para analisar os sinais digitais.',
        code: 'BUSINESS_NOT_UNLOCKED',
      });
    }

    let placeSignal: any = null;
    let effectiveUrl = url;

    if (businessName && (!effectiveUrl || !knownPhone)) {
      try {
        const query = [businessName, address].filter(Boolean).join(' ');
        const candidates = await fetchBusinessesFromSerper(
          query,
          Number.isFinite(lat) ? lat : undefined,
          Number.isFinite(lng) ? lng : undefined
        );

        const normalize = (value: string) =>
          String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const target = normalize(businessName);
        const ranked = candidates
          .map((candidate: any) => {
            const candidateName = normalize(candidate.name || '');
            let score = 0;
            if (candidateName === target) score += 100;
            else if (candidateName.startsWith(target) || target.startsWith(candidateName)) score += 70;
            else if (candidateName.includes(target) || target.includes(candidateName)) score += 45;
            if (candidate.phone) score += 8;
            if (candidate.website) score += 8;
            return { candidate, score };
          })
          .filter((entry: any) => entry.score >= 45)
          .sort((a: any, b: any) => b.score - a.score);

        const best = ranked[0]?.candidate || null;
        if (best) {
          placeSignal = {
            source: 'serper_google_places',
            phone: best.phone || null,
            phones: Array.isArray(best.phones) ? best.phones : best.phone ? [best.phone] : [],
            website: best.website || null,
            name: best.name || businessName,
            address: best.address || address || null,
          };
          if (!effectiveUrl && best.website) effectiveUrl = best.website;
        }
      } catch (error: any) {
        console.warn('[Scoutly Signal Enrichment] Serper place lookup failed:', error?.message || error);
      }
    }

    const result = effectiveUrl
      ? await enrichBusinessWebsite(effectiveUrl, { force })
      : {
          siteStatus: 'unknown',
          whatsapp: [],
          whatsappCandidates: [],
          emails: [],
          phones: [],
          socials: {},
          cnpj: [],
          team: [],
          contactFreshness: {
            checkedAt: new Date().toISOString(),
            websiteReachable: false,
            verifiedWhatsappCount: 0,
            verifiedPhoneCount: 0,
            verifiedEmailCount: 0,
          },
          updatedAt: new Date().toISOString(),
        };

    const trackingAudit = effectiveUrl
      ? await auditWebsiteTracking(effectiveUrl).catch((error: any) => {
          console.warn('[Tracking Audit Warning]:', error?.message || error);
          return null;
        })
      : null;

    const allowEmail = ['go', 'pro', 'agency'].includes(String(access.plan || '').toLowerCase());
    res.setHeader('Cache-Control', force ? 'no-store' : 'private, max-age=120');
    return res.status(200).json({
      ...stripPaidEmail(result, allowEmail),
      trackingAudit,
      placeSignal,
      discoveredWebsite: effectiveUrl || null,
    });
  } catch (err: any) {
    console.error('[API /api/enrich Error]:', err?.message || err);
    return res.status(500).json({
      error: 'Erro ao enriquecer dados.',
      details: err?.message || String(err),
    });
  }
}
