/**
 * Public SEO pages. Runs after Vite builds; never serializes business or user data.
 * Public routes remain usable without JavaScript or authentication.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DOMAIN = 'https://scoutly.pro';
const DIST = path.resolve('dist');
const preview = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development';
const robots = preview ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large, max-snippet:-1';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
));
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const url = (route) => DOMAIN + route;
const logo = url('/logo.png');

const pages = [
  {
    route: '/prospeccao-local/', name: 'Prospecção local',
    title: 'Software de prospecção local e busca de empresas | Scoutly',
    description: 'Encontre empresas por segmento, nome e região. Explore negócios no mapa, consulte sinais digitais e organize leads com o software de prospecção local Scoutly.',
    h1: 'Software de prospecção local para encontrar e organizar empresas',
    intro: 'A Scoutly reúne busca por segmento, nome e localização, mapa de empresas, contatos e sinais digitais disponíveis e pipeline de vendas. Explore um território, qualifique negócios e acompanhe a próxima ação comercial.',
    sections: [
      ['Encontre negócios por nome, segmento ou região', 'Pesquise empresas na área em que deseja atuar. Resultados por nome e atividade ajudam a descobrir possíveis clientes. A cobertura depende da qualidade e atualização das fontes disponíveis em cada região.'],
      ['Qualifique oportunidades a partir de sinais digitais', 'Veja dados públicos disponíveis, presença de site, perfis sociais e indícios de tracking. Um sinal não detectado é uma hipótese a investigar, e não prova da ausência de uma ferramenta.'],
      ['Organize a prospecção em um único workspace', 'Salve favoritos, registre o estágio de contato no pipeline e conecte as informações do negócio às suas próximas ações e rotas de visita.']
    ], related: ['/recursos/', '/para-agencias/', '/dados-e-fontes/']
  },
  {
    route: '/prospeccao-com-ia/', name: 'Prospecção com IA',
    title: 'Prospecção de empresas com IA e Scoutly Agentic | Scoutly',
    description: 'Use IA com o contexto dos seus leads. Conheça o Scoutly Agentic, pesquisas com fontes públicas, sinais digitais e sugestões de abordagem comercial.',
    h1: 'Prospecção com IA conectada aos seus leads',
    intro: 'O Scoutly Agentic recebe o contexto da empresa selecionada e ajuda a pesquisar informações relevantes e preparar abordagens. Quando um mecanismo de busca externa está configurado, ele também pode apresentar páginas públicas como fontes.',
    sections: [
      ['Contexto do negócio selecionado', 'Nome, segmento, localização e os dados aos quais o usuário tem acesso ajudam o Agentic a trabalhar com o lead real, em vez de responder a uma pergunta comercial genérica.'],
      ['Pesquisa pública com fontes verificáveis', 'Para encontrar páginas na web, a IA depende de integrações externas configuradas. Links de possíveis perfis de proprietários exigem verificação de nome, cargo e vínculo antes de serem tratados como confirmados.'],
      ['Sugestões de abordagem para revisar e personalizar', 'A IA pode apoiar a criação de mensagens comerciais com base nos sinais disponíveis. Nenhuma abordagem ou pesquisa automatizada garante resultados ou substitui a revisão humana.']
    ], related: ['/recursos/', '/dados-e-fontes/', '/para-agencias/']
  },
  {
    route: '/para-agencias/', name: 'Para agências',
    title: 'Prospecção de clientes para agências de marketing | Scoutly',
    description: 'Encontre empresas locais para sua agência de marketing. Analise sinais digitais, presença de site e rastreamento e organize oportunidades no pipeline da Scoutly.',
    h1: 'Prospecção de clientes para agências de marketing',
    intro: 'Agências de mídia, SEO, criação de sites e automação podem usar a Scoutly para descobrir empresas por território, analisar sinais digitais públicos e organizar uma rotina de prospecção comercial.',
    sections: [
      ['Descubra empresas na sua área de atuação', 'Selecione uma região e segmento, encontre negócios no mapa e analise quais merecem uma investigação comercial mais aprofundada.'],
      ['Conecte sinais digitais aos serviços da agência', 'Informações de site, Google Analytics, Tag Manager, Meta Pixel e PageSpeed ajudam a formular hipóteses para uma auditoria. Uma ferramenta não detectada não deve ser apresentada como definitivamente ausente.'],
      ['Mantenha o relacionamento no pipeline', 'Salve possíveis clientes, registre o contato e prepare os próximos passos. O Scoutly Agentic oferece apoio contextual nos planos elegíveis.']
    ], related: ['/prospeccao-local/', '/recursos/', '/prospeccao-com-ia/']
  },
  {
    route: '/recursos/', name: 'Recursos',
    title: 'Recursos da Scoutly: mapa, contatos, pipeline e IA',
    description: 'Conheça os recursos da Scoutly: busca de empresas no mapa, contatos públicos, auditoria de sinais digitais, pipeline, favoritos, rotas e IA contextual.',
    h1: 'Recursos da Scoutly para uma prospecção conectada',
    intro: 'Da descoberta inicial ao acompanhamento de oportunidades, os recursos da Scoutly são organizados em torno do negócio que você está prospectando.',
    sections: [
      ['Pesquisa geográfica e mapa de empresas', 'Busque negócios por nome, segmento e localização. Consulte empresas disponíveis no mapa e aplique filtros para construir uma lista de prospecção.'],
      ['Perfis, contatos e sinais digitais', 'Veja site, telefones, redes sociais e sinais de WhatsApp quando disponíveis. Endereços de e-mail completos são protegidos e dependem de um plano elegível.'],
      ['Auditoria de site e rastreamento', 'Com um site disponível, a Scoutly pode analisar tags, cookies e desempenho. Resultados refletem as condições da verificação e podem precisar de confirmação.'],
      ['Pipeline, favoritos, rotas e Scoutly Agentic', 'Salve oportunidades, acompanhe etapas comerciais, organize visitas e peça ajuda à IA usando o contexto dos seus leads, conforme os recursos do plano.']
    ], related: ['/prospeccao-local/', '/prospeccao-com-ia/', '/dados-e-fontes/']
  },
  {
    route: '/dados-e-fontes/', name: 'Dados e fontes',
    title: 'Fontes de dados e confiabilidade da Scoutly',
    description: 'Entenda as fontes da Scoutly, cobertura geográfica, contato e WhatsApp, critérios de auditoria digital e limites das pesquisas do Scoutly Agentic.',
    h1: 'Fontes de dados, evidências e limites da Scoutly',
    intro: 'A Scoutly diferencia informações disponíveis, sinais identificados e hipóteses que precisam de verificação. A cobertura varia por região, negócio e qualidade das fontes.',
    sections: [
      ['Origem dos registros de empresas', 'A Scoutly utiliza dados de lugares, incluindo Overture Maps, e pode complementar informações com Serper Places quando o serviço está configurado. A cobertura e atualização dependem dos dados da região.'],
      ['Sites e canais de contato', 'O site oficial do negócio pode complementar dados de telefone, redes sociais e WhatsApp. Um telefone, por si só, não confirma que o número tenha WhatsApp. O e-mail completo é protegido por plano e permissões.'],
      ['Limites de tracking e PageSpeed', 'Scripts bloqueados, consentimento de cookies e carregamento dinâmico podem impedir a detecção de Analytics, Tag Manager e Meta Pixel. Performance também varia conforme o dispositivo e o momento da medição.'],
      ['Pesquisa web assistida por IA', 'O Agentic pode apresentar links de pesquisa pública quando a integração externa está habilitada. A identidade de pessoas e os vínculos profissionais precisam ser confirmados por fontes adequadas.']
    ], related: ['/recursos/', '/prospeccao-com-ia/', '/perguntas-frequentes/']
  },
  {
    route: '/perguntas-frequentes/', name: 'Perguntas frequentes',
    title: 'Perguntas frequentes sobre a Scoutly | FAQ',
    description: 'Saiba como buscar empresas, usar créditos gratuitos, identificar contatos e WhatsApp, interpretar auditorias digitais e usar o Scoutly Agentic.',
    h1: 'Perguntas frequentes sobre a Scoutly',
    intro: 'Respostas sobre a plataforma, a prospecção por mapa, os limites dos dados e o acesso aos recursos de IA.',
    sections: [
      ['O que é a Scoutly?', 'A Scoutly é um software de prospecção local com busca de empresas, mapa, perfis de negócios, sinais digitais, favoritos, pipeline e recursos de IA contextual.'],
      ['Posso encontrar empresas pelo nome ou segmento?', 'Sim. É possível pesquisar por nome, segmento e localização. A cobertura depende da disponibilidade e da atualização dos dados de cada região.'],
      ['Existe um plano gratuito?', 'Sim. O plano Free oferece cinco créditos de prospecção por dia, até o limite de 25 por mês. Planos pagos têm outros recursos e limites.'],
      ['A Scoutly fornece WhatsApp e e-mail de todas as empresas?', 'Não. A Scoutly mostra os canais encontrados nas fontes disponíveis. Um telefone não é automaticamente um WhatsApp confirmado. E-mails completos são restritos a planos elegíveis.'],
      ['A IA pode pesquisar informações externas?', 'O Scoutly Agentic trabalha com o contexto dos leads e pode usar fontes públicas quando uma integração de busca está configurada. Resultados sobre proprietários precisam de verificação.'],
      ['Uma tag não detectada significa que a empresa não a utiliza?', 'Não. Cookies, scripts dinâmicos e outros fatores podem impedir a detecção durante a auditoria.']
    ], related: ['/dados-e-fontes/', '/recursos/', '/prospeccao-local/'], faq: true
  },
  {
    route: '/en/', lang: 'en', name: 'English overview',
    title: 'Scoutly | Local business prospecting software with AI',
    description: 'Discover businesses by location and category, review digital signals, organize sales leads in your pipeline and prospect with maps and contextual AI.',
    h1: 'Local business prospecting from discovery to action',
    intro: 'Scoutly helps sales teams and agencies find local businesses by name, category and location, review available digital signals, save prospects and organize follow-up in one workspace.',
    sections: [
      ['Discover businesses in your territory', 'Search businesses by name, category or location and explore them on a map. Results depend on the available data coverage and freshness in each region.'],
      ['Qualify with digital signals', 'Review available website, phone, social profiles and technical indicators. A missing tracking signal is not proof that a company does not use a tool. Full email access requires an eligible plan.'],
      ['Organize the next step', 'Save favorites, update pipeline stages, plan visits and use contextual AI in eligible plans. External web research depends on configured search integrations.']
    ], related: ['/prospeccao-local/', '/recursos/', '/dados-e-fontes/']
  }
];

const linkNames = Object.fromEntries(pages.map((page) => [page.route, page.name]));
const publicLinks = [
  ['/prospeccao-local/', 'Prospecção local'],
  ['/prospeccao-com-ia/', 'Prospecção com IA'],
  ['/para-agencias/', 'Para agências'],
  ['/recursos/', 'Recursos'],
  ['/dados-e-fontes/', 'Dados e fontes'],
  ['/perguntas-frequentes/', 'Perguntas frequentes']
];
const css = [
  ':root{font-family:Inter,Arial,sans-serif;color-scheme:dark}*{box-sizing:border-box}',
  'body{margin:0;background:#090b0f;color:#f5f6f7;font:15px/1.8 Inter,Arial,sans-serif}',
  'a{color:inherit;text-decoration:none}a:hover{color:#ff9a67}a:focus-visible{outline:2px solid #ff753d;outline-offset:4px}',
  '.seo-wrap{width:min(1160px,calc(100% - 42px));margin:0 auto}',
  '.seo-header{border-bottom:1px solid #ffffff17;background:#0e1116}',
  '.seo-nav{display:flex;justify-content:space-between;align-items:center;gap:17px;min-height:76px}',
  '.seo-brand{display:inline-flex;align-items:center;gap:9px;font-size:22px;font-weight:800;letter-spacing:-.05em}',
  '.seo-brand img{width:31px;height:31px;object-fit:contain}.seo-brand b{color:#ff7138}',
  '.seo-links,.seo-related,.seo-footer-links{display:flex;gap:15px;flex-wrap:wrap;font-size:12px;color:#b7bec8}',
  '.seo-cta{display:inline-flex;align-items:center;justify-content:center;min-height:43px;padding:9px 18px;border-radius:11px;background:#ff5a12;color:white;font-size:12px;font-weight:700}',
  '.seo-cta:hover{background:#ff7438;color:white}',
  '.seo-secondary,.seo-related a{display:inline-flex;align-items:center;min-height:41px;padding:8px 15px;border:1px solid #ffffff24;border-radius:11px;font-size:12px;color:#e5e7eb}',
  '.seo-hero{padding:84px 0 62px;background:radial-gradient(ellipse at 80% 30%,#ff5a121a,transparent 48%),linear-gradient(140deg,#0e1117,#090b0f);border-bottom:1px solid #ffffff12}',
  '.seo-kicker{font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#ff955f}',
  '.seo-hero h1{font-size:clamp(37px,5.4vw,65px);line-height:1.08;letter-spacing:-.054em;max-width:930px;margin:16px 0 22px}',
  '.seo-lead{max-width:840px;font-size:clamp(15px,1.8vw,18px);line-height:1.8;color:#bdc3cc}',
  '.seo-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}',
  '.seo-content{padding:50px 0 80px}.seo-content h2{font-size:clamp(22px,3vw,30px);letter-spacing:-.035em;line-height:1.3}',
  '.seo-section{padding:24px 0;border-bottom:1px solid #ffffff16}.seo-section p{max-width:850px;color:#bec3cc;margin-top:10px}',
  '.seo-related{margin:20px 0 0;gap:10px}.seo-note{color:#a4aab5;font-size:11px;margin-top:32px}',
  '.seo-footer{padding:28px 0;border-top:1px solid #ffffff16;background:#0b0d11}.seo-footer-inner{display:flex;gap:20px;justify-content:space-between;align-items:center;flex-wrap:wrap;font-size:11px;color:#9ca3ad}',
  '@media(max-width:720px){.seo-links{display:none}.seo-hero{padding:55px 0 45px}.seo-content{padding:35px 0 55px}}'
].join('\n');

const organization = {
  '@type': 'Organization', '@id': DOMAIN + '/#organization', name: 'Scoutly', url: DOMAIN + '/',
  logo: { '@type': 'ImageObject', url: logo },
  description: 'Plataforma de prospecção local com mapa, sinais digitais, pipeline e IA.'
};
const website = {
  '@type': 'WebSite', '@id': DOMAIN + '/#website', name: 'Scoutly',
  url: DOMAIN + '/', inLanguage: ['pt-BR', 'en'],
  publisher: { '@id': DOMAIN + '/#organization' }
};
const software = {
  '@type': 'SoftwareApplication', '@id': DOMAIN + '/#software', name: 'Scoutly',
  url: DOMAIN + '/', applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web', inLanguage: ['pt-BR', 'en'],
  description: 'Software de prospecção local por mapa, segmento e região, com sinais digitais, pipeline e IA contextual.',
  offers: { '@type': 'Offer', name: 'Plano Free', price: '0', priceCurrency: 'BRL',
    availability: 'https://schema.org/InStock', url: DOMAIN + '/login?mode=signup' },
  featureList: ['Busca de empresas locais', 'Mapa de empresas', 'Pipeline e favoritos',
    'Sinais digitais e contatos disponíveis', 'Assistente de IA em planos elegíveis'],
  publisher: { '@id': DOMAIN + '/#organization' }
};
const homepageSchema = [
  organization, website, software,
  { '@type': 'WebPage', '@id': DOMAIN + '/#webpage', url: DOMAIN + '/',
    name: 'Scoutly | Software de prospecção local com mapa, dados e IA',
    isPartOf: { '@id': DOMAIN + '/#website' }, about: { '@id': DOMAIN + '/#software' }, inLanguage: 'pt-BR' }
];
const structured = (graph) => '<script type="application/ld+json">' +
  json({ '@context': 'https://schema.org', '@graph': graph }) + '</script>';

const nav = (lang) => '<header class="seo-header"><nav class="seo-wrap seo-nav" aria-label="Scoutly">' +
  '<a class="seo-brand" href="/"><img src="/scoutly-mark.png" alt="" width="31" height="31">Scoutly<b>.</b></a>' +
  '<div class="seo-links"><a href="/prospeccao-local/">Prospecção local</a><a href="/recursos/">Recursos</a>' +
  '<a href="/para-agencias/">Agências</a><a href="/perguntas-frequentes/">FAQ</a></div>' +
  '<a class="seo-cta" href="/login?mode=signup">' + (lang === 'en' ? 'Start free' : 'Começar grátis') +
  ' →</a></nav></header>';

const footer = (lang) => '<footer class="seo-footer"><div class="seo-wrap seo-footer-inner">' +
  '<span>© Scoutly · ' + (lang === 'en' ? 'Local business prospecting software.' : 'Software de prospecção local.') + '</span>' +
  '<div class="seo-footer-links">' + publicLinks.map(([route, label]) =>
    '<a href="' + route + '">' + escape(label) + '</a>').join('') +
  '<a href="' + (lang === 'en' ? '/' : '/en/') + '">' + (lang === 'en' ? 'Português' : 'English') +
  '</a></div></div></footer>';

const meta = (page) => {
  const href = url(page.route);
  const alt = page.route === '/' || page.route === '/en/'
    ? '<link rel="alternate" hreflang="pt-BR" href="' + DOMAIN + '/">' +
      '<link rel="alternate" hreflang="en" href="' + DOMAIN + '/en/">' +
      '<link rel="alternate" hreflang="x-default" href="' + DOMAIN + '/">'
    : '';
  return '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escape(page.title) + '</title>' +
    '<meta name="description" content="' + escape(page.description) + '">' +
    '<meta name="robots" content="' + robots + '"><meta name="googlebot" content="' + robots + '">' +
    '<link rel="canonical" href="' + href + '">' + alt +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Scoutly">' +
    '<meta property="og:locale" content="' + (page.lang === 'en' ? 'en_US' : 'pt_BR') + '">' +
    '<meta property="og:title" content="' + escape(page.title) + '">' +
    '<meta property="og:description" content="' + escape(page.description) + '">' +
    '<meta property="og:url" content="' + href + '">' +
    '<meta property="og:image" content="' + logo + '">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + escape(page.title) + '">' +
    '<meta name="twitter:description" content="' + escape(page.description) + '">' +
    '<meta name="twitter:image" content="' + logo + '">' +
    '<link rel="icon" href="/scoutly-mark.png" type="image/png">' +
    '<meta name="theme-color" content="#090b0f">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + css + '</style>';
};

function renderPage(page) {
  const lang = page.lang || 'pt';
  const graph = [
    organization,
    { '@type': 'WebPage', '@id': url(page.route) + '#webpage', url: url(page.route),
      name: page.title, description: page.description, inLanguage: lang === 'en' ? 'en' : 'pt-BR',
      about: { '@id': DOMAIN + '/#software' }, isPartOf: { '@id': DOMAIN + '/#website' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Scoutly', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: page.name, item: url(page.route) }
    ] }
  ];
  if (page.faq) graph.push({
    '@type': 'FAQPage', '@id': url(page.route) + '#faq',
    mainEntity: page.sections.map(([question, answer]) => ({
      '@type': 'Question', name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer }
    }))
  });
  const sections = page.sections.map(([heading, body]) =>
    '<section class="seo-section"><h2>' + escape(heading) + '</h2><p>' + escape(body) +
    '</p></section>').join('');
  const related = page.related.map((route) =>
    '<a href="' + route + '">' + escape(linkNames[route] || 'Scoutly') + ' ↗</a>').join('');
  const body = nav(lang) + '<main><section class="seo-hero"><div class="seo-wrap">' +
    '<p class="seo-kicker"><a href="/">Scoutly</a> / ' + escape(page.name) + '</p>' +
    '<h1>' + escape(page.h1) + '</h1><p class="seo-lead">' + escape(page.intro) + '</p>' +
    '<div class="seo-actions"><a class="seo-cta" href="/login?mode=signup">' +
    (lang === 'en' ? 'Start free' : 'Começar grátis') +
    ' →</a><a class="seo-secondary" href="/recursos/">' +
    (lang === 'en' ? 'Explore features' : 'Conhecer recursos') +
    '</a></div></div></section><div class="seo-wrap seo-content">' + sections +
    '<section class="seo-section"><h2>' + (lang === 'en' ? 'Related resources' : 'Veja também') +
    '</h2><div class="seo-related">' + related + '</div></section>' +
    '<p class="seo-note">' + (lang === 'en' ? 'Coverage and availability vary by region and source.' :
      'A cobertura e a disponibilidade dos dados variam por região e fonte.') +
    '</p></div></main>' + footer(lang);
  return '<!doctype html><html lang="' + (lang === 'en' ? 'en' : 'pt-BR') +
    '"><head>' + meta(page) + structured(graph) + '</head><body>' + body + '</body></html>';
}

const homeFallback = '<div class="seo-fallback">' + nav('pt') +
  '<main><section class="seo-hero"><div class="seo-wrap">' +
  '<p class="seo-kicker">Prospecção local com inteligência comercial</p>' +
  '<h1>Encontre empresas e oportunidades no mapa com a Scoutly</h1>' +
  '<p class="seo-lead">Busque empresas por segmento, nome e região. Analise contatos e sinais digitais disponíveis, salve leads, organize oportunidades no pipeline e use IA com contexto comercial.</p>' +
  '<div class="seo-actions"><a class="seo-cta" href="/login?mode=signup">Começar grátis →</a>' +
  '<a class="seo-secondary" href="/recursos/">Conhecer os recursos</a></div></div></section>' +
  '<div class="seo-wrap seo-content"><section class="seo-section">' +
  '<h2>Da descoberta à abordagem, no mesmo workspace</h2>' +
  '<p>Encontre negócios no mapa, consulte os dados disponíveis, salve favoritos e acompanhe cada lead no pipeline. O plano gratuito oferece cinco créditos por dia, até o limite de 25 por mês. O acesso a e-mails completos e ferramentas de IA exige um plano elegível.</p>' +
  '</section><section class="seo-section"><h2>Conheça a plataforma</h2><div class="seo-related">' +
  publicLinks.map(([route, label]) =>
    '<a href="' + route + '">' + escape(label) + ' ↗</a>').join('') +
  '</div></section></div></main>' + footer('pt') + '</div>';

await mkdir(DIST, { recursive: true });
let index = await readFile(path.join(DIST, 'index.html'), 'utf8');
if (!index.includes('<div id="root"></div>')) {
  throw new Error('Expected React root missing from Vite output; SEO fallback not generated.');
}
index = index.replace('<div id="root"></div>', '<div id="root">' + homeFallback + '</div>');
index = index.replace('</head>',
  '<style>' + css + 'html.seo-nonhome .seo-fallback{display:none}</style>' +
  '<script>if(location.pathname!=="/")document.documentElement.classList.add("seo-nonhome")</script>' +
  structured(homepageSchema) + '</head>');
if (preview) {
  index = index.replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="' + robots + '" />');
  index = index.replace(/<meta name="googlebot" content="[^"]*" \/>/, '<meta name="googlebot" content="' + robots + '" />');
}
await writeFile(path.join(DIST, 'index.html'), index);

for (const page of pages) {
  const folder = path.join(DIST, page.route.slice(1));
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'index.html'), renderPage(page));
}

const urls = ['/', ...pages.map(page => page.route)];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  urls.map((route) => {
    const hreflang = route === '/' || route === '/en/'
      ? '<xhtml:link rel="alternate" hreflang="pt-BR" href="' + DOMAIN + '/"/>' +
        '<xhtml:link rel="alternate" hreflang="en" href="' + DOMAIN + '/en/"/>'
      : '';
    return '<url><loc>' + url(route) + '</loc>' + hreflang + '</url>';
  }).join('\n') + '\n</urlset>';
await writeFile(path.join(DIST, 'sitemap.xml'), sitemap);

if (preview) {
  await writeFile(path.join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
}
const indexNowKey = String(process.env.INDEXNOW_KEY || '').trim();
if (indexNowKey && /^[a-f0-9-]{8,128}$/i.test(indexNowKey)) {
  await writeFile(path.join(DIST, indexNowKey + '.txt'), indexNowKey);
}
console.log('[SEO] Homepage with static fallback, ' + pages.length +
  ' standalone public pages, structured data, sitemap and ' +
  (preview ? 'preview noindex' : 'production indexation') + ' generated.');
