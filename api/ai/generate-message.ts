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
  const category = business?.category || 'negócios locais';
  const { score, missingTracking } = getEvidence(business);

  const observedSignals: string[] = [];
  if (!business?.website) observedSignals.push('presença online');
  if (score > 0 && score < 70) observedSignals.push('desempenho do site no celular');
  if (missingTracking.length > 0) observedSignals.push('mensuração e rastreamento');
  if (Array.isArray(business?.opportunities)) {
    observedSignals.push(...business.opportunities.slice(0, 2).map(String));
  }

  const opportunityText = observedSignals.length > 0
    ? `Na análise pública, apareceram alguns pontos que vale olhar com mais atenção, principalmente em ${Array.from(new Set(observedSignals)).slice(0, 3).join(', ')}.`
    : `Pesquisando empresas de ${category}, vi algumas oportunidades que podem ajudar a melhorar aquisição, atendimento e presença digital.`;

  const openings = [
    `Olá! Tudo bem? 😊\n\nPesquisando negócios locais, conheci a ${name} e percebi que existem algumas oportunidades que podem ajudar vocês a atrair mais clientes, facilitar o atendimento e melhorar a presença digital da empresa.\n\n${opportunityText}`,
    `Olá! Tudo bem? 😊\n\nEu estava analisando negócios de ${category} na região e encontrei a ${name}. Fiz uma leitura rápida da presença digital de vocês e identifiquei alguns pontos que podem ser trabalhados para melhorar visibilidade, atendimento e geração de oportunidades.\n\n${opportunityText}`,
    `Olá! Tudo bem? 😊\n\nConheci a ${name} enquanto pesquisava empresas locais e resolvi fazer uma análise rápida da estrutura digital de vocês. Existem alguns caminhos interessantes para aumentar a presença no Google, melhorar a captação e reduzir tarefas manuais no atendimento.\n\n${opportunityText}`,
  ];

  return `${openings[variationIndex % openings.length]}

Hoje trabalhamos justamente com esse tipo de solução, unindo marketing, tecnologia e automação conforme a necessidade de cada negócio.

🌐 Websites profissionais — criação, otimização, velocidade, SEO e estrutura pensada para gerar contatos.

📍 Google & Google Maps — otimização do perfil, posicionamento local e estratégias para aumentar a visibilidade.

⭐ Avaliações Google com NFC + QR Code — placas, cartões e adesivos personalizados para facilitar que o cliente avalie a empresa após o atendimento.

📱 Mídias sociais — criação de conteúdo, gestão de redes sociais, planejamento e presença digital.

🎯 Gestão de tráfego pago — Google Ads, Meta Ads, LinkedIn Ads e outras plataformas, com acompanhamento e mensuração dos resultados.

📊 Analytics, rastreamento e relatórios — implementação de GA4, Google Tag Manager, eventos, conversões e acompanhamento da jornada do cliente.

🤖 Automação de processos — automação de formulários, captação de informações, notificações, organização de leads e etapas do atendimento, reduzindo trabalho manual e tempo de resposta.

📲 Aplicativos Essenciais ou Premium — desenvolvimento de sistemas próprios para atendimento, gestão e acompanhamento de processos, inclusive soluções internas ou produtos digitais.

🔐 Auditoria digital e LGPD — análise de formulários, coleta de dados, cookies, consentimento e rastreamento. A necessidade de adequação é avaliada caso a caso.

E o principal: não trabalhamos com uma solução engessada.

Primeiro procuramos entender onde está o problema do negócio.

Está faltando cliente?
O site não gera contatos?
O Google não traz visitas suficientes?
Os leads demoram para ser atendidos?
O processo depende de muita coisa manual?
As informações ficam espalhadas?
Existe dificuldade para acompanhar os clientes?
O marketing não está sendo mensurado?
Ou existe uma ideia que vocês gostariam de transformar em uma ferramenta?

A partir da dor, desenvolvemos a solução — seja marketing, tecnologia, automação, site, aplicativo, tráfego pago ou uma combinação de tudo isso.

Posso fazer uma análise gratuita da presença digital da ${name}, apontar algumas oportunidades e mostrar, de forma prática, o que poderia ser melhorado.

Faz sentido conversarmos por alguns minutos? 😊`;
}

function buildPrompt(business: any, variationIndex = 0, previousMessage = ''): string {
  const { score, diagnostics, missingTracking } = getEvidence(business);
  const styles = [
    'consultivo, próximo e profissional',
    'confiante, humano e orientado a oportunidades',
    'comercial elegante, sem pressão',
    'direto, personalizado e acolhedor',
  ];
  const style = styles[variationIndex % styles.length];
  const opportunities = Array.isArray(business?.opportunities)
    ? business.opportunities.map(String).slice(0, 5)
    : [];

  return `Escreva uma mensagem de prospecção B2B para WhatsApp em português brasileiro, pronta para envio, personalizada para um negócio local.

Empresa: ${business?.name || 'Empresa'}
Segmento: ${business?.category || 'Não informado'}
Site: ${business?.website || 'Não identificado'}
PageSpeed mobile: ${score > 0 ? `${score}/100` : 'não disponível'}
Diagnósticos técnicos encontrados: ${diagnostics.length ? diagnostics.join('; ') : 'nenhum diagnóstico específico disponível'}
Sinais de tracking não confirmados: ${missingTracking.length ? missingTracking.join('; ') : 'nenhum'}
Outras oportunidades observadas: ${opportunities.length ? opportunities.join('; ') : 'nenhuma adicional'}
Estilo desta variação: ${style}

A mensagem deve seguir esta pegada e estrutura:

1. Comece com "Olá! Tudo bem? 😊".
2. Diga que encontrou/conheceu a empresa pesquisando negócios locais ou o segmento.
3. Mostre que houve uma análise real, mas seja cuidadoso com evidências. Se um sinal estiver apenas "não confirmado", nunca diga que está ausente. Se não houver dado suficiente, fale em "oportunidades que vale analisar".
4. Explique que trabalhamos com marketing, tecnologia e automação para resolver problemas reais do negócio.
5. Inclua, cada um em seu próprio parágrafo, estes serviços, com linguagem clara e comercial:

🌐 Websites profissionais — criação, otimização, velocidade, SEO e estrutura pensada para gerar contatos.

📍 Google & Google Maps — otimização do perfil, posicionamento local e estratégias para aumentar a visibilidade.

⭐ Avaliações Google com NFC + QR Code — placas, cartões e adesivos personalizados para facilitar avaliações após o atendimento.

📱 Mídias sociais — criação de conteúdo, gestão de redes sociais, planejamento e presença digital.

🎯 Gestão de tráfego pago — Google Ads, Meta Ads, LinkedIn Ads e outras plataformas, com acompanhamento e mensuração.

📊 Analytics, rastreamento e relatórios — GA4, Google Tag Manager, eventos, conversões e acompanhamento da jornada do cliente.

🤖 Automação de processos — formulários, captação de informações, notificações, organização de leads e etapas de atendimento, reduzindo trabalho manual.

📲 Aplicativos Essenciais ou Premium — sistemas próprios para atendimento, gestão e acompanhamento de processos, incluindo ferramentas internas ou produtos digitais.

🔐 Auditoria digital e LGPD — análise de formulários, coleta de dados, cookies, consentimento e rastreamento. Diga explicitamente que a necessidade de adequação é avaliada caso a caso.

6. Depois explique que não trabalhamos com solução engessada e que primeiro entendemos a dor.
7. Inclua perguntas curtas, uma por linha, nesta linha:
Está faltando cliente?
O site não gera contatos?
O Google não traz visitas suficientes?
Os leads demoram para ser atendidos?
O processo depende de muita coisa manual?
As informações ficam espalhadas?
Existe dificuldade para acompanhar os clientes?
O marketing não está sendo mensurado?
Existe uma ideia que gostariam de transformar em uma ferramenta?

8. Diga que, a partir da dor, desenvolvemos a solução adequada, podendo combinar marketing, tecnologia, automação, site, aplicativo e tráfego pago.
9. Finalize oferecendo uma análise gratuita da presença digital da empresa e perguntando se faz sentido conversar por alguns minutos, podendo encerrar com 😊.

Regras importantes:
- personalize com o nome exato da empresa
- mantenha tom humano, consultivo e profissional
- o texto pode ser longo porque funciona como apresentação comercial completa
- preserve boa leitura no WhatsApp com parágrafos curtos
- não invente faturamento, prejuízo, quantidade de clientes, resultados, rankings ou problemas não comprovados
- não prometa resultado garantido
- não diga que uma tecnologia está ausente se ela estiver apenas "não confirmada"
- não invente infrações de LGPD
- não use markdown com asteriscos
- responda somente com a mensagem pronta para envio

${previousMessage ? `A mensagem anterior foi esta:
"${previousMessage}"

Crie uma variação claramente diferente na abertura, na forma de apresentar as oportunidades e no CTA, mantendo a mesma estrutura completa de serviços.` : ''}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const business = req.body?.business;
  const variationIndex = Math.max(0, Number(req.body?.variationIndex || 0));
  const previousMessage =
    typeof req.body?.previousMessage === 'string' ? req.body.previousMessage.slice(0, 7000) : '';

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
            max_tokens: 1600,
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
