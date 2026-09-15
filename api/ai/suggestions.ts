import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateContextualSuggestions } from '../../server/aiService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('API ai suggestions started');
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { recentSearches, currentRegionName } = req.body;
    const suggestions = await generateContextualSuggestions(
      Array.isArray(recentSearches) ? recentSearches : [],
      currentRegionName || 'São Paulo'
    );
    return res.status(200).json({ suggestions });
  } catch (err: any) {
    console.error('[API /api/ai/suggestions Error FULL]:', err);
    return res.status(500).json({
      suggestions: [
        'Ache restaurantes sem site em São Paulo',
        'Busque clínicas e consultórios em São Paulo',
        'Oficinas mecânicas com WhatsApp em São Paulo',
        'Agências de marketing e B2B em São Paulo',
      ],
      error: err.message
    });
  }
}
