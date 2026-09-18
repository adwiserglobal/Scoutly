import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzePageSpeed } from '../server/pagespeedService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!url) {
    return res.status(400).json({ error: 'Parâmetro url é obrigatório' });
  }

  try {
    const result = await analyzePageSpeed(url);
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[API /api/pagespeed Error]:', error?.message || error);
    return res.status(500).json({
      error: 'Erro ao analisar velocidade da página.',
      details: error?.message || String(error),
    });
  }
}
