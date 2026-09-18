import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enrichBusinessWebsite } from '../server/enrichService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

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
    console.error('[API /api/social-check Error]:', error?.message || error);
    return res.status(500).json({
      error: 'Erro ao verificar redes sociais.',
      details: error?.message || String(error),
    });
  }
}
