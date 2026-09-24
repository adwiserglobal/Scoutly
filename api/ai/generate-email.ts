import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function buildFallbackEmail(business: any) {
  const name = business?.name || 'sua empresa';
  const category = business?.category || 'negócios locais';
  const opportunities = Array.isArray(business?.opportunities)
    ? business.opportunities.map(String).slice(0, 3)
    : [];

  const evidence = opportunities.length
    ? `Em uma análise rápida da presença digital, encontrei alguns pontos que podem valer uma conversa: ${opportunities.join(', ')}.`
    : `Pesquisando empresas de ${category}, encontrei a ${name} e vi algumas oportunidades que podem ser exploradas na presença digital e na geração de contatos.`;

  return {
    subject: `Uma ideia para ${name}`,
    message: `Olá, tudo bem?\n\nMeu nome é Eduardo e encontrei a ${name} enquanto pesquisava empresas da região. ${evidence}\n\nTrabalho com soluções de marketing, tecnologia e automação para negócios locais e acredito que pode fazer sentido trocar uma ideia sobre formas de melhorar presença digital, captação e atendimento sem partir de uma solução engessada.\n\nSe fizer sentido, posso preparar uma análise curta e gratuita com os principais pontos que observei e algumas possibilidades práticas para a ${name}.\n\nPodemos conversar por alguns minutos esta semana?\n\nAbraço,\nEduardo`,
  };
}

function buildPrompt(business: any) {
  const opportunities = Array.isArray(business?.opportunities)
    ? business.opportunities.map(String).slice(0, 5)
    : [];
  const tracking = business?.trackingAudit || null;
  const missingTracking: string[] = [];

  if (tracking) {
    if (!tracking.ga4?.detected) missingTracking.push('GA4 não confirmado');
    if (!tracking.gtm?.detected) missingTracking.push('GTM não confirmado');
    if (!tracking.metaPixel?.detected) missingTracking.push('Meta Pixel não confirmado');
  }

  return `Escreva um e-mail de prospecção B2B em português brasileiro, pronto para envio, curto, profissional e personalizado para um negócio local.

Empresa: ${business?.name || 'Empresa'}
Segmento: ${business?.category || 'Não informado'}
Site: ${business?.website || 'Não identificado'}
PageSpeed mobile: ${business?.pageSpeedScore ? `${business.pageSpeedScore}/100` : 'não disponível'}
Oportunidades observadas: ${opportunities.length ? opportunities.join('; ') : 'nenhuma específica'}
Sinais de tracking não confirmados: ${missingTracking.length ? missingTracking.join('; ') : 'nenhum'}

Regras:
- gere um assunto curto e específico
- escreva entre 120 e 220 palavras
- personalize com o nome exato da empresa
- mantenha tom humano, consultivo e profissional
- não use emojis
- não use markdown
- não diga que algo está ausente quando estiver apenas não confirmado
- não invente faturamento, prejuízo, ranking, quantidade de clientes ou problemas não comprovados
- ofereça uma análise curta/gratuita como próximo passo
- termine com um CTA simples para uma conversa breve
- responda SOMENTE em JSON válido no formato {"subject":"...","message":"..."}`;
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed?.subject && parsed?.message) return parsed;
  } catch {}
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const business = req.body?.business;
  if (!business) {
    return res.status(400).json({ error: 'Business data is required' });
  }

  const prompt = buildPrompt(business);
  const fallback = buildFallbackEmail(business);

  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (process.env.OPENROUTER_API_KEY) {
    const models = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'openrouter/auto',
    ];

    for (const model of models) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.APP_URL || 'https://scoutly.pro',
            'X-Title': 'Scoutly',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.65,
            max_tokens: 700,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) continue;
        const data = await response.json();
        const parsed = parseJson(data?.choices?.[0]?.message?.content || '');
        if (parsed) return res.status(200).json({ ...parsed, source: 'openrouter', model: data?.model || model });
      } catch (error: any) {
        console.warn(`[Generate Email] OpenRouter ${model} failed:`, error?.message || error);
      }
    }
  }

  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.65 },
      });
      const parsed = parseJson(response.text || '');
      if (parsed) return res.status(200).json({ ...parsed, source: 'gemini', model: 'gemini-2.5-flash' });
    } catch (error: any) {
      console.warn('[Generate Email] Gemini failed:', error?.message || error);
    }
  }

  return res.status(200).json({ ...fallback, source: 'template', model: 'local-fallback' });
}
