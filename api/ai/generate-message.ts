import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { requireFirebaseIdentity } from '../../server/firebaseTokenService.js';
import { ensureAppUser } from '../../server/appDataService.js';
import { consumeAiConversation } from '../../server/entitlementService.js';

function evidenceFor(business: any) {
  const score = Number(business?.pageSpeedScore || 0);
  const tracking = business?.trackingAudit || null;
  const opportunities = Array.isArray(business?.opportunities)
    ? business.opportunities.map(String).slice(0, 5)
    : [];
  const signals: string[] = [];
  if (score > 0) signals.push(`PageSpeed mobile ${score}/100`);
  if (tracking && !tracking.ga4?.detected) signals.push('GA4 não confirmado');
  if (tracking && !tracking.gtm?.detected) signals.push('GTM não confirmado');
  if (tracking && !tracking.metaPixel?.detected) signals.push('Meta Pixel não confirmado');
  signals.push(...opportunities);
  return signals.slice(0, 7);
}

function promptFor(business: any, channel: 'email' | 'whatsapp', variationIndex: number, previousMessage: string) {
  const name = business?.name || 'Empresa';
  const category = business?.category || 'negócio local';
  const signals = evidenceFor(business);

  if (channel === 'email') {
    return `Escreva somente o corpo de um e-mail de prospecção B2B em português brasileiro para ${name}, do segmento ${category}.
Sinais públicos observados: ${signals.length ? signals.join('; ') : 'nenhum sinal técnico específico'}.
Use 120 a 220 palavras, tom humano, profissional e consultivo. Explique em uma frase que trabalhamos com marketing, tecnologia e automação. Ofereça uma análise curta e gratuita e termine com um CTA simples para uma conversa breve. Não use emojis ou markdown. Não invente problemas, faturamento, ranking, clientes ou resultados. Quando algo estiver "não confirmado", nunca afirme que está ausente.`;
  }

  return `Escreva somente uma mensagem de prospecção B2B para WhatsApp em português brasileiro, pronta para envio e personalizada para ${name}, do segmento ${category}.
Sinais públicos observados: ${signals.length ? signals.join('; ') : 'nenhum sinal técnico específico'}.
Tom humano, consultivo e profissional. Comece com "Olá! Tudo bem? 😊". Mostre que houve uma análise real, explique que trabalhamos com marketing, tecnologia e automação, cite apenas serviços relevantes, ofereça uma análise gratuita e termine perguntando se faz sentido conversar por alguns minutos. Não invente problemas, resultados, faturamento ou infrações. Se algo estiver "não confirmado", não diga que está ausente. Não use markdown com asteriscos.
Variação: ${variationIndex}.${previousMessage ? ` Crie uma versão claramente diferente desta mensagem anterior: ${previousMessage.slice(0, 3000)}` : ''}`;
}

function fallbackMessage(business: any, channel: 'email' | 'whatsapp') {
  const name = business?.name || 'sua empresa';
  const category = business?.category || 'negócios locais';
  if (channel === 'email') {
    return `Olá, tudo bem?\n\nEncontrei a ${name} enquanto pesquisava empresas de ${category} na região e fiz uma leitura rápida da presença digital de vocês. Trabalho com soluções de marketing, tecnologia e automação para negócios locais e acredito que pode fazer sentido conversar sobre oportunidades de presença digital, aquisição e atendimento.\n\nSe fizer sentido, posso preparar uma análise curta e gratuita com alguns pontos públicos que observei e possibilidades práticas para a ${name}.\n\nPodemos conversar por alguns minutos esta semana?\n\nAbraço,\nEduardo`;
  }
  return `Olá! Tudo bem? 😊\n\nEncontrei a ${name} pesquisando empresas de ${category} na região e fiz uma análise rápida da presença digital de vocês. Trabalho com marketing, tecnologia e automação para negócios locais e vi alguns caminhos que podem valer uma conversa.\n\nSe fizer sentido, posso preparar uma análise gratuita e objetiva da ${name} e mostrar algumas oportunidades práticas.\n\nFaz sentido conversarmos por alguns minutos?`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    const { workspaceId } = await ensureAppUser(identity);
    const access = await consumeAiConversation(identity.uid, workspaceId);

    const business = req.body?.business;
    if (!business) return res.status(400).json({ error: 'Business data is required' });

    const variationIndex = Math.max(0, Number(req.body?.variationIndex || 0));
    const previousMessage = typeof req.body?.previousMessage === 'string'
      ? req.body.previousMessage.slice(0, 7000)
      : '';
    const channel: 'email' | 'whatsapp' = req.body?.channel === 'email' ? 'email' : 'whatsapp';
    const prompt = promptFor(business, channel, variationIndex, previousMessage);

    let message = '';
    let source: 'gemini' | 'openrouter' | 'template' = 'template';
    let model = '';

    if (process.env.OPENROUTER_API_KEY) {
      for (const candidate of [
        'meta-llama/llama-3.3-70b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
        'openrouter/auto',
      ]) {
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
              model: candidate,
              messages: [{ role: 'user', content: prompt }],
              temperature: channel === 'email' ? 0.65 : 0.78,
              max_tokens: channel === 'email' ? 700 : 1000,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) continue;
          const data = await response.json();
          const text = data?.choices?.[0]?.message?.content?.trim() || '';
          if (text.length >= 30) {
            message = text;
            source = 'openrouter';
            model = data?.model || candidate;
            break;
          }
        } catch (error: any) {
          console.warn(`[Generate Message] OpenRouter ${candidate} failed:`, error?.message || error);
        }
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!message && geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { temperature: channel === 'email' ? 0.65 : 0.78 },
        });
        const text = response.text?.trim() || '';
        if (text.length >= 30) {
          message = text;
          source = 'gemini';
          model = 'gemini-2.5-flash';
        }
      } catch (error: any) {
        console.warn('[Generate Message] Gemini failed:', error?.message || error);
      }
    }

    if (!message) {
      message = fallbackMessage(business, channel);
      source = 'template';
      model = 'scoutly-local-fallback';
    }

    return res.status(200).json({
      message,
      source,
      model,
      variationIndex,
      channel,
      subject: channel === 'email' ? `Uma ideia para ${business?.name || 'sua empresa'}` : undefined,
      access,
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      error: error?.message || 'Não foi possível gerar a mensagem.',
      code: error?.code || undefined,
    });
  }
}
