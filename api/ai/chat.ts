import type { VercelRequest, VercelResponse } from '@vercel/node';
console.log('AI API started');
import { handleAIChat } from '../../server/aiService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('handler started');
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    console.log('OPENROUTER_API_KEY exists', hasOpenRouter);
    console.log('GEMINI_API_KEY exists', hasGemini);
    console.log('request to OpenRouter started');

    const { message, history, businesses, currentRegionName, searchMode } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const response = await handleAIChat({
      message,
      history: Array.isArray(history) ? history : [],
      businesses: Array.isArray(businesses) ? businesses : [],
      currentRegionName: currentRegionName || 'Região Atual',
      searchMode: searchMode === 'deep' ? 'deep' : 'default',
    });

    console.log('OpenRouter response status', 200);
    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[API /api/ai/chat Error FULL]:', err);
    return res.status(500).json({
      error: err.message || 'Erro ao processar consulta de IA.',
      details: err.stack || String(err),
    });
  }
}
