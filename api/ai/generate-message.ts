import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function getEvidence(business: any) {
  const score = Number(business?.pageSpeedScore || 0);
  const diagnostics = Array.isArray(business?.pageSpeedDiagnostics)
    ? business.pageSpeedDiagnostics
        .map((item: any) => item?.title)
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const tracking = business?.trackingAudit || null;
  const missingTracking: string[] = [];

  if (tracking) {
    if (!tracking.ga4?.detected) missingTracking.push('GA4 não confirmado');
    if (!tracking.gtm?.detected) missingTracking.push('GTM não confirmado');
    if (!tracking.metaPixel?.detected) missingTracking.push('Meta Pixel não confirmado');
    if (!tracking.cookieConsent?.detected) missingTracking.push('consentimento de cookies não confirmado');
  }

  return { score, diagnostics, missingTracking };
}

function buildFallbackMessage(business: any, variationIndex = 0): string {
  const name = business?.name || 'sua empresa';
  const category = business?.category || 'serviços';
  const { score, diagnostics, missingTracking } = getEvidence(business);
  const priorityCount = Math.max(1, Math.min(3, diagnostics.length || missingTracking.length || 2));

  if (!business?.website) {
    const variants = [
      `Olá! Tudo bem? Encontrei a ${name} pesquisando empresas de ${category} e notei uma oportunidade simples na presença digital de vocês.

Hoje, quem procura a empresa online pode ter dificuldade para chegar rápido às informações e ao contato. Tenho uma ideia bem objetiva de como resolver isso sem transformar em um projeto enorme.

Posso te mostrar a estrutura que eu faria para a ${name}?`,
      `Olá! Tudo bem? Estava olhando a presença digital da ${name} e fiquei com uma ideia que pode facilitar bastante a chegada de novos contatos.

É uma estrutura simples, focada em transformar busca local em conversa no WhatsApp, sem depender de um site complexo.

Quer que eu te mostre como eu montaria isso para vocês?`,
    ];
    return variants[variationIndex % variants.length];
  }

  if (score > 0 && score < 70) {
    const variants = [
      `Olá! Tudo bem? Dei uma olhada no site da ${name} e um ponto me chamou atenção: no mobile, a análise ficou em ${score}/100.

Isso indica alguns gargalos que podem criar atrito justamente antes do visitante chegar ao contato. Separei os ${priorityCount} pontos que eu atacaria primeiro, sem mexer no que já funciona.

Quer que eu te mande esse diagnóstico curto?`,
      `Olá! Tudo bem? Analisei rapidamente o site da ${name} e encontrei uma oportunidade bem clara no mobile. O desempenho ficou em ${score}/100.

O interessante é que não parece ser caso de refazer tudo. Há alguns ajustes prioritários que podem melhorar a experiência e deixar o site mais preparado para receber tráfego.

Posso te mostrar quais eu priorizaria primeiro?`,
      `Olá! Tudo bem? Passei pelo site da ${name} e fiz uma checagem rápida de performance. O resultado no mobile foi ${score}/100.

Encontrei alguns pontos que valem atenção antes de colocar mais energia em tráfego ou aquisição. Montei uma leitura bem curta do que parece ter maior impacto.

Quer que eu te envie?`,
    ];
    return variants[variationIndex % variants.length];
  }

  if (missingTracking.length > 0) {
    const variants = [
      `Olá! Tudo bem? Dei uma olhada na estrutura digital da ${name} e encontrei alguns pontos de mensuração que valem uma checagem.

Não significa necessariamente que estejam ausentes, mas há sinais que não ficaram confirmados publicamente e isso pode dificultar enxergar o que realmente gera contato e venda.

Posso te mandar os pontos que eu revisaria primeiro?`,
      `Olá! Tudo bem? Analisei rapidamente o site da ${name} e fiquei com uma dúvida importante sobre a mensuração das campanhas e dos acessos.

Alguns sinais de tracking não ficaram confirmados na análise pública. Separei uma lista curta do que eu validaria antes de escalar mídia.

Quer que eu te envie?`,
    ];
    return variants[variationIndex % variants.length];
  }

  const variants = [
    `Olá! Tudo bem? Encontrei a ${name} pesquisando empresas de ${category} e dei uma olhada rápida na presença digital de vocês.

Vi alguns pontos interessantes que podem deixar o caminho entre visita e contato mais direto. Nada genérico, são ajustes bem específicos do que encontrei.

Posso te mandar um resumo curto?`,
    `Olá! Tudo bem? Dei uma olhada na presença digital da ${name} e encontrei algumas oportunidades que eu priorizaria antes de pensar em aumentar investimento em aquisição.

Separei uma leitura bem objetiva, focada no que pode melhorar o caminho até o contato.

Quer que eu te mostre?`,
  ];
  return variants[variationIndex % variants.length];
}

function buildPrompt(business: any, variationIndex = 0, previousMessage = ''): string {
  const { score, diagnostics, missingTracking } = getEvidence(business);
  const styles = [
    'curiosidade com dado específico',
    'consultivo e confiante',
    'direto com provocação leve',
    'executivo e muito curto',
  ];
  const style = styles[variationIndex % styles.length];

  return `Escreva uma mensagem de prospecção B2B para WhatsApp em português brasileiro.

Empresa: ${business?.name || 'Empresa'}
Segmento: ${business?.category || 'Não informado'}
Site: ${business?.website || 'Não identificado'}
PageSpeed mobile: ${score > 0 ? `${score}/100` : 'não disponível'}
Diagnósticos técnicos: ${diagnostics.length ? diagnostics.join('; ') : 'nenhum diagnóstico específico disponível'}
Sinais de tracking não confirmados: ${missingTracking.length ? missingTracking.join('; ') : 'nenhum'}
Telefone/WhatsApp: ${business?.phone || 'não informado'}
Estilo desta variação: ${style}

Objetivo:
Criar curiosidade real e vontade de responder sem entregar todo o diagnóstico na primeira mensagem. A mensagem deve dar um motivo concreto para a pessoa querer ver o restante.

Regras:
- mensagem curta e natural
- 2 ou 3 parágrafos curtos
- use um dado específico quando houver, principalmente PageSpeed
- mostre que houve uma análise real da empresa
- revele só uma parte do achado e guarde o restante para o CTA
- CTA de baixa fricção como "Quer que eu te mande os pontos?"
- não invente prejuízo, percentual, aumento de vendas ou qualquer fato não fornecido
- não diga que algo está ausente quando só está "não confirmado"
- sem emojis
- sem travessões
- sem clichês de marketing
- sem "potencialize seu negócio", "soluções personalizadas", "transforme sua presença digital"
- não comece se apresentando ou falando muito sobre quem vende
- responda somente com a mensagem pronta para envio

${previousMessage ? `A mensagem anterior foi esta:
"${previousMessage}"

Crie uma variação claramente diferente. Mude abertura, argumento e CTA. Não apenas reescreva sinônimos.` : ''}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const business = req.body?.business;
  const variationIndex = Math.max(0, Number(req.body?.variationIndex || 0));
  const previousMessage =
    typeof req.body?.previousMessage === 'string' ? req.body.previousMessage.slice(0, 1800) : '';

  if (!business) {
    return res.status(400).json({ error: 'Business data is required' });
  }

  const prompt = buildPrompt(business, variationIndex, previousMessage);
  let message = '';
  let source: 'gemini' | 'openrouter' | 'template' = 'template';
  let model = '';

  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (process.env.OPENROUTER_API_KEY) {
    const candidateModels = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'openrouter/auto',
    ];

    for (const candidate of candidateModels) {
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
            temperature: variationIndex > 0 ? 0.9 : 0.76,
            max_tokens: 360,
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

  if (!message && geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: variationIndex > 0 ? 0.9 : 0.76 },
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
    message = buildFallbackMessage(business, variationIndex);
    source = 'template';
    model = 'scoutly-local-fallback';
  }

  return res.status(200).json({
    message,
    source,
    model,
    variationIndex,
  });
}
