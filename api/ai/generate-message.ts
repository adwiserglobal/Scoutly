import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function buildFallbackMessage(business: any): string {
  const name = business?.name || 'sua empresa';
  const category = business?.category || 'serviços';
  const score = Number(business?.pageSpeedScore || 0);

  if (!business?.website) {
    return `Olá! Tudo bem? Encontrei a ${name} pesquisando empresas de ${category} na região e notei que vocês ainda não têm um site próprio bem estruturado.

Uma página simples e rápida pode facilitar bastante para clientes encontrarem informações, pedirem orçamento e chamarem no WhatsApp.

Faria sentido eu te mostrar uma sugestão rápida de como isso poderia ficar para a ${name}?`;
  }

  if (score > 0 && score < 60) {
    return `Olá! Tudo bem? Dei uma olhada no site da ${name} e identifiquei alguns pontos de desempenho no mobile. A análise marcou ${score}/100, o que pode afetar a experiência de quem chega pelo Google ou por anúncios.

Trabalho com otimização de sites e conversão e posso te mostrar rapidamente os principais pontos que poderiam ser melhorados.

Posso te enviar esse diagnóstico?`;
  }

  return `Olá! Tudo bem? Encontrei a ${name} pesquisando empresas de ${category} e dei uma olhada na presença digital de vocês.

Identifiquei algumas oportunidades para facilitar a geração de contatos e levar mais pessoas para o WhatsApp.

Posso te mostrar em poucos minutos o que encontrei?`;
}

function buildPrompt(business: any): string {
  const score = Number(business?.pageSpeedScore || 0);
  return `Escreva uma mensagem de prospecção B2B para WhatsApp em português brasileiro.

Empresa: ${business?.name || 'Empresa'}
Segmento: ${business?.category || 'Não informado'}
Site: ${business?.website || 'Não identificado'}
PageSpeed mobile: ${score > 0 ? `${score}/100` : 'não disponível'}
Telefone/WhatsApp: ${business?.phone || 'não informado'}

Regras:
- mensagem curta e natural
- no máximo 3 parágrafos curtos
- não invente problemas nem resultados
- use somente oportunidades sustentadas pelos dados acima
- sem emojis
- sem travessões
- não use frases genéricas como "potencialize seu negócio"
- termine com uma pergunta simples
- responda somente com a mensagem pronta para envio`;
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
  let message = '';
  let source = 'template';

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.65 },
      });

      const text = response.text?.trim() || '';
      if (text.length >= 30) {
        message = text;
        source = 'gemini';
      }
    } catch (error: any) {
      console.warn('[Generate Message] Gemini failed:', error?.message || error);
    }
  }

  if (!message && process.env.OPENROUTER_API_KEY) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.65,
          max_tokens: 320,
        }),
        signal: AbortSignal.timeout(9000),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content?.trim() || '';
        if (text.length >= 30) {
          message = text;
          source = 'openrouter';
        }
      }
    } catch (error: any) {
      console.warn('[Generate Message] OpenRouter failed:', error?.message || error);
    }
  }

  if (!message) {
    message = buildFallbackMessage(business);
  }

  return res.status(200).json({ message, source });
}
