import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleScoutlyAgenticChat } from '../../server/agenticSearchService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { message, history, businesses, currentRegionName } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const response = await handleScoutlyAgenticChat({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      businesses: Array.isArray(businesses) ? businesses : [],
      currentRegionName:
        typeof currentRegionName === 'string' && currentRegionName.trim()
          ? currentRegionName.trim()
          : 'São Paulo - SP',
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[API /api/ai/chat Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Erro ao processar consulta do Scoutly Agentic.',
    });
  }
}
