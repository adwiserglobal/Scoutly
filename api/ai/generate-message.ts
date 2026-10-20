import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateText } from '../../server/llmChain.js';
import { requireFirebaseIdentity } from '../../server/firebaseTokenService.js';
import { ensureAppUser } from '../../server/appDataService.js';
import { consumeAiConversation } from '../../server/entitlementService.js';
import { getOutreachProfileSafe, outreachPromptBlock, type OutreachProfile } from '../../server/userProfileService.js';

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

function promptFor(
  business: any,
  channel: 'email' | 'whatsapp',
  variationIndex: number,
  previousMessage: string,
  profile: OutreachProfile | null
) {
  const name = business?.name || 'Empresa';
  const category = business?.category || 'negócio local';
  const signals = evidenceFor(business);
  const profileBlock = outreachPromptBlock(profile);
  const isJob = profile?.objective === 'job';
  const signalsLine = `Sinais públicos observados: ${signals.length ? signals.join('; ') : 'nenhum sinal técnico específico'}.`;
  const variation = `Variação: ${variationIndex}.${previousMessage ? ` Crie uma versão claramente diferente desta mensagem anterior: ${previousMessage.slice(0, 3000)}` : ''}`;

  if (profileBlock) {
    const closing = profile?.cta
      ? `Termine com esta ação, em suas palavras: ${profile.cta}.`
      : isJob
      ? 'Termine pedindo uma conversa breve ou a indicação da pessoa certa.'
      : 'Termine perguntando se faz sentido conversar por alguns minutos.';
    const common = `${profileBlock}

DESTINATÁRIO: ${name}, do segmento ${category}. ${signalsLine}
Regras: português brasileiro, mensagem pronta para enviar, sem markdown e sem asteriscos. Use os sinais apenas como contexto real; não invente problemas, resultados, faturamento, clientes ou infrações. Quando algo estiver "não confirmado", nunca afirme que está ausente. ${closing}`;

    if (channel === 'email') {
      return `Escreva somente o corpo de um e-mail para ${name}.
${common}
Use 120 a 220 palavras, sem emojis.`;
    }
    return `Escreva somente uma mensagem de WhatsApp para ${name}.
${common}
Seja breve (até 110 palavras) e comece com uma saudação natural; no máximo um emoji.
${variation}`;
  }

  if (channel === 'email') {
    return `Escreva somente o corpo de um e-mail de prospecção B2B em português brasileiro para ${name}, do segmento ${category}.
${signalsLine}
Use 120 a 220 palavras, tom humano, profissional e consultivo. Apresente-se de forma breve, ofereça uma análise curta e gratuita e termine com um CTA simples para uma conversa breve. Não use emojis ou markdown. Não invente problemas, faturamento, ranking, clientes, resultados ou serviços que não foram informados. Quando algo estiver "não confirmado", nunca afirme que está ausente.`;
  }

  return `Escreva somente uma mensagem de prospecção B2B para WhatsApp em português brasileiro, pronta para envio e personalizada para ${name}, do segmento ${category}.
${signalsLine}
Tom humano, consultivo e profissional. Comece com "Olá! Tudo bem? 😊". Mostre que houve uma análise real, apresente-se de forma breve, ofereça uma análise gratuita e termine perguntando se faz sentido conversar por alguns minutos. Não invente problemas, resultados, faturamento, infrações ou serviços que não foram informados. Se algo estiver "não confirmado", não diga que está ausente. Não use markdown com asteriscos.
${variation}`;
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
    const outreachProfile = await getOutreachProfileSafe(identity.uid);
    const prompt = promptFor(business, channel, variationIndex, previousMessage, outreachProfile);

    const generated = await generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: channel === 'email' ? 0.65 : 0.78,
      maxTokens: channel === 'email' ? 700 : 1000,
      minLength: 30,
      title: 'Scoutly',
    });
    const message = generated.text;
    const source = generated.provider;
    const model = generated.model;

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
    if (error?.code === 'LLM_UNAVAILABLE') {
      return res.status(503).json({
        error: 'Nossa IA está com muita demanda neste momento. Tente gerar novamente em alguns instantes.',
        code: 'LLM_UNAVAILABLE',
      });
    }
    return res.status(statusCode).json({
      error: error?.message || 'Não foi possível gerar a mensagem.',
      code: error?.code || undefined,
    });
  }
}
