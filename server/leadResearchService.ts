import { hasPeopleSearchAccess, revealDecisionMaker, searchDecisionMakers } from './peopleSearchService.js';
type FocusedLead = {
  id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  socials?: string[];
  leadStatus?: string;
};

type WebHit = { title?: string; link?: string; snippet?: string };

function clean(value: unknown, max = 220) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function safePublicUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function websiteHostname(raw?: string | null) {
  try {
    return new URL(/^https?:\/\//i.test(String(raw || '')) ? String(raw) : `https://${raw}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function researchFocusedLead(leadInput: any, message: string) {
  const lead: FocusedLead = {
    id: clean(leadInput?.id, 180),
    name: clean(leadInput?.name, 140),
    category: clean(leadInput?.category, 120),
    address: clean(leadInput?.address, 200),
    website: clean(leadInput?.website, 300),
    phone: clean(leadInput?.phone, 50),
    socials: Array.isArray(leadInput?.socials) ? leadInput.socials.slice(0, 12).map((value: any) => clean(value, 250)) : [],
    leadStatus: clean(leadInput?.leadStatus, 40),
  };
  if (!lead.id || !lead.name) throw Object.assign(new Error('Lead não identificado.'), { statusCode: 400 });

  const question = clean(message, 350);
  const normalized = question.toLocaleLowerCase('pt-BR');
  const linkedin = /linkedin|dono|s[oó]cio|fundador|ceo|respons[aá]vel|propriet[aá]rio|decisor/.test(normalized);
  const social = /instagram|facebook|tiktok|youtube|rede social/.test(normalized);
  const approach = /abordagem|mensagem|contato|pitch|vender/.test(normalized);
  const wantsEmail = /e-?mail|email|contato profissional/.test(normalized);
  const domain = websiteHostname(lead.website);

  if (approach && !linkedin && !social) {
    const channel = lead.phone ? 'WhatsApp ou telefone' : 'site ou redes sociais oficiais';
    return {
      text: `**${lead.name}** — sugestão de abordagem inicial (personalize antes de enviar):\n\n“Olá! Encontrei a ${lead.name} pesquisando empresas em ${lead.address || 'sua região'}. Gostaria de conversar com a pessoa responsável sobre oportunidades de melhorar a presença digital e a geração de contatos. Qual seria o melhor canal?”\n\nCanal disponível: ${channel}. Não presumi problemas no negócio sem evidências verificadas.`,
      matchedBusinessIds: [lead.id],
      modelUsed: 'lead-context-template',
    };
  }

  if (linkedin && hasPeopleSearchAccess()) {
    try {
      const candidates = await searchDecisionMakers(lead.name, lead.address, domain, 5);
      if (candidates.length > 0) {
        const person = await revealDecisionMaker(candidates[0].token, wantsEmail);
        const lines = [
          `**Lead:** ${lead.name}`,
          person.name ? `**Possível decisor:** ${person.name}` : '**Possível decisor encontrado**',
          person.title ? `**Cargo:** ${person.title}` : null,
          person.company ? `**Empresa:** ${person.company}` : null,
          person.location ? `**Localização:** ${person.location}` : null,
          person.linkedinUrl ? `**LinkedIn:** ${person.linkedinUrl}` : null,
          wantsEmail && person.email ? `**E-mail profissional:** ${person.email}` : null,
          wantsEmail && person.emailStatus && !person.email ? `**Status do e-mail:** ${person.emailStatus}` : null,
        ].filter(Boolean);

        const evidence = [
          'Resultado obtido via PeopleSearch, usando uma base profissional externa e revelação explícita do perfil.',
          'Confirme nome, cargo e vínculo com a empresa antes de tratar a pessoa como responsável definitivo.',
          wantsEmail && person.emailConfidence ? `Confiança informada para o e-mail: ${person.emailConfidence}.` : null,
        ].filter(Boolean).join(' ');

        return {
          text: `${lines.join('\n')}\n\n${evidence}`,
          matchedBusinessIds: [lead.id],
          modelUsed: 'peoplesearch-decision-maker',
        };
      }
    } catch (error: any) {
      console.warn('[Lead Research] PeopleSearch failed:', error?.message || error);
      // Fall through to public web search. This keeps the Agentic useful if
      // credits run out or the external provider is temporarily unavailable.
    }
  }

  const existing = linkedin
    ? lead.socials?.filter((url) => /linkedin\.com/i.test(url))
    : social
      ? lead.socials?.filter((url) => /instagram\.com|facebook\.com|tiktok\.com|youtube\.com/i.test(url))
      : lead.socials;
  const context = [
    `**Lead:** ${lead.name}`,
    lead.address ? `**Localização:** ${lead.address}` : null,
    lead.website ? `**Site registrado:** ${lead.website}` : null,
    existing?.length ? `**Perfis já registrados:** ${existing.map((url) => safePublicUrl(url)).filter(Boolean).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const apiKey = String(process.env.SERPER_API_KEY || '').trim();
  if (!apiKey) {
    return {
      text: `${context}\n\nA pesquisa externa não está configurada neste ambiente. Não vou inventar um perfil ou o nome do proprietário. Para encontrar fontes públicas, é necessário configurar a chave Serper no backend.`,
      matchedBusinessIds: [lead.id],
      modelUsed: 'lead-context-no-web',
    };
  }

  const term = linkedin
    ? `"${lead.name}" (fundador OR sócio OR proprietário OR CEO) site:linkedin.com/in ${lead.address || ''}`
    : social
      ? `"${lead.name}" ${question} ${lead.address || ''}`
      : `"${lead.name}" ${question} ${domain || lead.address || ''}`;

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: term.slice(0, 450), gl: 'br', hl: 'pt-br', num: 8 }),
      signal: AbortSignal.timeout(8500),
    });
    if (!response.ok) throw new Error(`Web search HTTP ${response.status}`);
    const data = await response.json();
    const hits: WebHit[] = (Array.isArray(data?.organic) ? data.organic : [])
      .map((hit: any) => ({ title: clean(hit.title, 140), link: safePublicUrl(hit.link), snippet: clean(hit.snippet, 260) }))
      .filter((hit: WebHit) => Boolean(hit.link))
      .slice(0, 6);

    if (!hits.length) {
      return {
        text: `${context}\n\nNão encontrei fontes públicas suficientes para esta pesquisa. Isso não significa que o perfil não exista.`,
        matchedBusinessIds: [lead.id],
        modelUsed: 'lead-web-search',
      };
    }

    const references = hits.map((hit, index) =>
      `${index + 1}. [${hit.title || hit.link}](${hit.link})${hit.snippet ? ` — ${hit.snippet}` : ''}`
    ).join('\n');
    const caution = linkedin
      ? 'Os links acima são **candidatos de pesquisa**, não confirmação da identidade do proprietário. Compare cargo, empresa e fontes oficiais antes de atribuir um perfil à pessoa.'
      : 'Os resultados vêm de páginas públicas indexadas. Confira os links antes de usar as informações comercialmente.';
    return {
      text: `${context}\n\n**Resultados da pesquisa pública**\n${references}\n\n${caution}`,
      matchedBusinessIds: [lead.id],
      modelUsed: 'lead-web-search',
    };
  } catch (error: any) {
    console.warn('[Lead Research] Search failed:', error?.message || error);
    return {
      text: `${context}\n\nA pesquisa externa não respondeu agora. Nenhum dado novo foi confirmado; tente novamente mais tarde.`,
      matchedBusinessIds: [lead.id],
      modelUsed: 'lead-web-search-unavailable',
    };
  }
}
