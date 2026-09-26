import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runScoutlyBusinessSearch } from '../server/searchFacade.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { ensureAppUser } from '../server/appDataService.js';
import { protectBusinessResults } from '../server/entitlementService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const currentRegionName = typeof req.query.currentRegionName === 'string'
    ? req.query.currentRegionName
    : 'São Paulo - SP';

  if (!query) {
    return res.status(400).json({ error: 'Parâmetro q é obrigatório.', businesses: [] });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    await ensureAppUser(identity);
    const result = await runScoutlyBusinessSearch(query, currentRegionName);
    const protectedResult = await protectBusinessResults(identity.uid, result.businesses || []);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      ...result,
      businesses: protectedResult.businesses,
      creditState: protectedResult.creditState,
    });
  } catch (err: any) {
    console.error('[API /api/search Error]:', err);
    const status = Number(err?.statusCode || 500);
    return res.status(status).json({
      error: err?.message || 'Erro ao buscar empresas.',
      code: err?.code || undefined,
      businesses: [],
    });
  }
}
