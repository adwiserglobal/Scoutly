import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Globe2,
  Layers3,
  MessageSquareText,
  Radar,
  Route,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';

interface MarketingSiteProps {
  isAuthenticated: boolean;
  onLogin: () => void;
  onStart: () => void;
  onOpenDashboard: () => void;
}

type Language = 'en' | 'pt';

const TRUSTED_BRANDS = [
  { name: 'Ternus', src: '/trusted/ternus.png', monochrome: true },
  { name: 'VibeCheck', src: '/trusted/vibecheck.svg', monochrome: true },
  { name: 'Wallcloud', src: '/trusted/wallcloud.png', monochrome: true },
  { name: 'Adwiser', src: '/trusted/adwiser.png' },
  { name: 'Planna', src: '/trusted/planna.png' },
  { name: 'Altora', src: '/trusted/altora.png' },
  { name: 'Feedmetrics', src: '/trusted/feedmetrics.png' },
  { name: 'ListerUp', src: '/trusted/listerup.svg' },
];

function TrustedMarquee({ label }: { label: string }) {
  const brands = [...TRUSTED_BRANDS, ...TRUSTED_BRANDS];

  return (
    <section className="border-y border-white/[0.07] bg-[#090b0f] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <p className="mb-7 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
          {label}
        </p>
      </div>
      <div className="trusted-marquee" aria-label={label}>
        <div className="trusted-track">
          {brands.map((brand, index) => (
            <div
              className="trusted-logo"
              key={`${brand.name}-${index}`}
              aria-hidden={index >= TRUSTED_BRANDS.length}
              title={brand.name}
            >
              <img
                src={brand.src}
                alt={index < TRUSTED_BRANDS.length ? brand.name : ''}
                className={`trusted-logo-image ${brand.monochrome ? 'trusted-logo-monochrome' : ''}`}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  copy,
  index,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  index: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#ff6a2a]/30 hover:bg-white/[0.055] sm:p-7">
      <div className="absolute right-5 top-4 text-[11px] font-semibold tracking-[0.14em] text-white/20">{index}</div>
      <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ff6a2a]/20 bg-[#ff6a2a]/10 text-[#ff7a3d] shadow-[0_12px_32px_rgba(255,90,18,0.08)]">
        {icon}
      </div>
      <h3 className="text-[18px] font-semibold tracking-[-0.025em] text-white">{title}</h3>
      <p className="mt-3 text-[13px] leading-6 text-stone-400">{copy}</p>
    </article>
  );
}

export default function MarketingSite({
  isAuthenticated,
  onLogin,
  onStart,
  onOpenDashboard,
}: MarketingSiteProps) {
  const [language, setLanguage] = useState<Language>(() =>
    navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'
  );
  const isEnglish = language === 'en';

  const t = useMemo(
    () =>
      isEnglish
        ? {
            pageTitle: 'Scoutly | Local prospecting intelligence',
            nav: { product: 'Product', workflow: 'Workflow', ai: 'Scoutly AI', customers: 'Customers' },
            login: 'Sign in',
            dashboard: 'Open dashboard',
            start: 'Start free',
            heroKicker: 'Local prospecting intelligence',
            heroTitleStart: 'Turn local territory into',
            heroTitleAccent: 'commercial momentum.',
            heroCopy:
              'Scoutly gives sales teams one operating layer to discover local businesses, understand digital signals and move from map to outreach without fragmented tools.',
            heroPrimary: 'Start prospecting free',
            heroSecondary: 'See how it works',
            heroMeta: ['5 free credits every day', 'Pipeline and favorites included', 'Upgrade only when you need more'],
            trusted: 'Trusted by ambitious products, teams and operators',
            videoKicker: 'One workspace, from discovery to action',
            videoTitle: 'See the territory. Understand the opportunity. Act from the same place.',
            videoCopy:
              'Scoutly turns a map into a commercial operating system: companies, contact signals, website intelligence, pipeline, routes and AI context stay connected.',
            problemTitle: 'Prospecting breaks when context lives in five different places.',
            problemCopy:
              'Maps tell you where a company is. Search tools return a list. CRMs tell you what happened later. Scoutly connects the pieces before the first conversation.',
            solutionTitle: 'A single workflow built around real businesses.',
            solutionCopy:
              'Search an area, qualify the companies that matter, save them, organize follow-up and let Scoutly AI work with the same context your team already created.',
            platformKicker: 'The Scoutly workflow',
            platformTitle: 'Everything your prospecting operation needs to move forward.',
            platformCopy:
              'Designed to reduce the time between finding a company and knowing what to do next.',
            aiKicker: 'Scoutly AI',
            aiTitle: 'AI that works with your commercial context, not around it.',
            aiCopy:
              'Scoutly AI can use searches, favorites, pipeline activity and the current territory to help identify similar opportunities and prepare the next action.',
            aiPrompt: 'Find companies similar to my favorites nearby and prioritize the ones with weak digital presence.',
            aiResponse: 'I found a new cluster of local opportunities and prioritized the businesses with the clearest digital gaps.',
            aiBullets: ['Context-aware recommendations', 'Natural-language prospecting', 'Sales approach generation', 'Connected to your map and pipeline'],
            useKicker: 'Built for revenue teams',
            useTitle: 'For teams that need signal before outreach.',
            finalTitle: 'Your next customer is already on the map.',
            finalCopy: 'Scoutly helps you find the right business, understand the context and take the next step faster.',
            finalCta: 'Start with Scoutly',
            footer: 'Local prospecting with commercial intelligence.',
          }
        : {
            pageTitle: 'Scoutly | Inteligência comercial para prospecção local',
            nav: { product: 'Produto', workflow: 'Fluxo', ai: 'Scoutly AI', customers: 'Clientes' },
            login: 'Entrar',
            dashboard: 'Abrir dashboard',
            start: 'Começar grátis',
            heroKicker: 'Inteligência para prospecção local',
            heroTitleStart: 'Transforme território local em',
            heroTitleAccent: 'movimento comercial.',
            heroCopy:
              'A Scoutly dá ao time comercial uma camada única para descobrir negócios locais, entender sinais digitais e sair do mapa para a abordagem sem ferramentas fragmentadas.',
            heroPrimary: 'Começar a prospectar grátis',
            heroSecondary: 'Ver como funciona',
            heroMeta: ['5 créditos grátis todos os dias', 'Pipeline e favoritos incluídos', 'Upgrade só quando precisar de mais'],
            trusted: 'Empresas e times que confiam na Scoutly',
            videoKicker: 'Um workspace, da descoberta à ação',
            videoTitle: 'Veja o território. Entenda a oportunidade. Aja no mesmo lugar.',
            videoCopy:
              'A Scoutly transforma o mapa em um sistema operacional comercial: empresas, sinais de contato, inteligência do site, pipeline, rotas e contexto de IA permanecem conectados.',
            problemTitle: 'A prospecção quebra quando o contexto vive em cinco lugares diferentes.',
            problemCopy:
              'O mapa mostra onde a empresa está. A busca entrega uma lista. O CRM conta o que aconteceu depois. A Scoutly conecta as peças antes da primeira conversa.',
            solutionTitle: 'Um único fluxo construído em torno de negócios reais.',
            solutionCopy:
              'Busque uma região, qualifique as empresas certas, salve, organize o follow-up e deixe a Scoutly AI trabalhar com o mesmo contexto que seu time já construiu.',
            platformKicker: 'O fluxo Scoutly',
            platformTitle: 'Tudo que sua operação de prospecção precisa para avançar.',
            platformCopy:
              'Criado para reduzir o tempo entre encontrar uma empresa e saber exatamente qual deve ser o próximo passo.',
            aiKicker: 'Scoutly AI',
            aiTitle: 'IA que trabalha com o seu contexto comercial, não ao redor dele.',
            aiCopy:
              'A Scoutly AI usa buscas, favoritos, atividade no pipeline e o território atual para encontrar oportunidades parecidas e preparar a próxima ação.',
            aiPrompt: 'Encontre empresas parecidas com meus favoritos aqui perto e priorize as que têm presença digital fraca.',
            aiResponse: 'Encontrei um novo grupo de oportunidades locais e priorizei os negócios com lacunas digitais mais claras.',
            aiBullets: ['Recomendações com contexto', 'Prospecção em linguagem natural', 'Geração de abordagem comercial', 'Conectada ao mapa e ao pipeline'],
            useKicker: 'Feita para times de receita',
            useTitle: 'Para equipes que precisam de sinal antes da abordagem.',
            finalTitle: 'Seu próximo cliente já está no mapa.',
            finalCopy: 'A Scoutly ajuda você a encontrar a empresa certa, entender o contexto e agir mais rápido.',
            finalCta: 'Começar com a Scoutly',
            footer: 'Prospecção local com inteligência comercial.',
          },
    [isEnglish]
  );

  const workflow = isEnglish
    ? [
        [Search, 'Discover the right businesses', 'Search by segment, neighborhood, city or intent and turn a geographic area into an actionable prospecting list.'],
        [Database, 'Qualify with real signals', 'Review public contacts, website presence, tracking, PageSpeed, confidence and other digital indicators before outreach.'],
        [Target, 'Organize commercial progress', 'Save favorites, move opportunities through the pipeline and keep notes tied to the same business context.'],
        [Route, 'Take prospecting into the field', 'Build visit routes and keep offline prospecting connected to the same workflow when the sale happens in person.'],
      ]
    : [
        [Search, 'Descubra as empresas certas', 'Busque por segmento, bairro, cidade ou intenção e transforme uma região em uma lista comercial acionável.'],
        [Database, 'Qualifique com sinais reais', 'Veja contatos públicos, presença de site, tracking, PageSpeed, confiança e outros indicadores digitais antes da abordagem.'],
        [Target, 'Organize o avanço comercial', 'Salve favoritos, mova oportunidades pelo pipeline e mantenha notas ligadas ao mesmo contexto de negócio.'],
        [Route, 'Leve a prospecção para a rua', 'Monte rotas de visita e mantenha a prospecção presencial conectada ao mesmo fluxo quando a venda acontece fora da tela.'],
      ];

  const audiences = isEnglish
    ? [
        ['Agencies', 'Find local companies with visible digital opportunity signals before the first contact.'],
        ['B2B sales', 'Map territories and build a repeatable outbound routine without scattered spreadsheets.'],
        ['Freelancers', 'Discover businesses that may need websites, media, automation, content or other specialized services.'],
        ['Field teams', 'Connect local visits, routes and follow-up with the same commercial pipeline.'],
      ]
    : [
        ['Agências', 'Encontre empresas locais com sinais claros de oportunidade digital antes do primeiro contato.'],
        ['Vendas B2B', 'Mapeie territórios e construa uma rotina previsível de outbound sem planilhas espalhadas.'],
        ['Freelancers', 'Descubra negócios que podem precisar de site, mídia, automação, conteúdo ou outros serviços especializados.'],
        ['Equipes externas', 'Conecte visitas locais, rotas e follow-up ao mesmo pipeline comercial.'],
      ];

  useEffect(() => {
    document.title = t.pageTitle;
    document.documentElement.lang = isEnglish ? 'en' : 'pt-BR';
  }, [isEnglish, t.pageTitle]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const primaryAction = isAuthenticated ? onOpenDashboard : onStart;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07080a] text-white selection:bg-[#ff5a12]/30 selection:text-white">
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border border-white/[0.09] bg-[#0a0c10]/80 px-4 shadow-[0_14px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-5">
          <button type="button" onClick={() => scrollTo('top')} className="flex items-center" aria-label="Scoutly">
            <img src="/logo_white.png" alt="Scoutly" className="h-8 w-auto object-contain" />
          </button>

          <nav className="hidden items-center gap-6 lg:flex">
            <button onClick={() => scrollTo('product')} className="text-[12px] font-medium text-stone-400 transition hover:text-white">{t.nav.product}</button>
            <button onClick={() => scrollTo('workflow')} className="text-[12px] font-medium text-stone-400 transition hover:text-white">{t.nav.workflow}</button>
            <button onClick={() => scrollTo('ai')} className="text-[12px] font-medium text-stone-400 transition hover:text-white">{t.nav.ai}</button>
            <button onClick={() => scrollTo('customers')} className="text-[12px] font-medium text-stone-400 transition hover:text-white">{t.nav.customers}</button>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-white/[0.08] bg-white/[0.035] p-1 sm:flex">
              {(['pt', 'en'] as Language[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLanguage(item)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase transition ${language === item ? 'bg-white text-black' : 'text-stone-500 hover:text-white'}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button type="button" onClick={onLogin} className="hidden px-3 text-[11px] font-semibold text-stone-300 transition hover:text-white sm:block">
              {isAuthenticated ? t.dashboard : t.login}
            </button>
            <button type="button" onClick={primaryAction} className="site-orange-button h-10 rounded-xl px-4 text-[11px] font-semibold text-white">
              {isAuthenticated ? t.dashboard : t.start}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="top" className="relative flex min-h-[860px] items-center overflow-hidden border-b border-white/[0.06] pt-28">
          <div className="hero-grid absolute inset-0 opacity-45" />
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#07080a] to-transparent" />

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:px-10 lg:pb-28 lg:pt-20">
            <div className="max-w-3xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#ff6a2a]/20 bg-[#ff5a12]/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ff8a55]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a2a] shadow-[0_0_14px_rgba(255,90,18,.9)]" />
                {t.heroKicker}
              </div>
              <h1 className="max-w-[760px] text-[52px] font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-[70px] lg:text-[82px]">
                {t.heroTitleStart}{' '}
                <span className="site-gradient-text">{t.heroTitleAccent}</span>
              </h1>
              <p className="mt-7 max-w-2xl text-[15px] leading-7 text-stone-400 sm:text-[17px] sm:leading-8">
                {t.heroCopy}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={primaryAction} className="site-orange-button inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[12px] font-semibold text-white">
                  {t.heroPrimary}<ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => scrollTo('product')} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.035] px-6 text-[12px] font-semibold text-stone-200 transition hover:border-white/[0.18] hover:bg-white/[0.06]">
                  {t.heroSecondary}
                </button>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
                {t.heroMeta.map((item) => (
                  <span key={item} className="flex items-center gap-1.5 text-[10px] font-medium text-stone-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#ff6a2a]" /> {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-[540px] lg:block">
              <div className="hero-product-card absolute left-0 top-10 w-[86%] rounded-[28px] border border-white/[0.10] bg-[#101319]/90 p-4 shadow-[0_40px_100px_rgba(0,0,0,.48)] backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2"><Radar className="h-4 w-4 text-[#ff6a2a]" /><span className="text-[11px] font-semibold text-stone-200">Scoutly Map</span></div>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-400">LIVE</span>
                </div>
                <div className="relative h-[330px] overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#0a0d12]">
                  <div className="absolute inset-0 opacity-80" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,90,18,.22), transparent 24%), linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: 'auto, 34px 34px, 34px 34px' }} />
                  {[['16%','24%'],['65%','18%'],['42%','48%'],['76%','66%'],['24%','72%'],['54%','80%']].map(([left, top], index) => (
                    <span key={index} className="absolute h-4 w-4 rounded-full border-2 border-white bg-[#ff5a12] shadow-[0_0_22px_rgba(255,90,18,.8)]" style={{ left, top }} />
                  ))}
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/[0.09] bg-[#0d1015]/90 p-3 backdrop-blur-xl">
                    <div className="flex items-center gap-2 text-[10px] text-stone-400"><Search className="h-3.5 w-3.5" /><span>{isEnglish ? 'Marketing agencies near Pinheiros' : 'Agências de marketing em Pinheiros'}</span></div>
                  </div>
                </div>
              </div>
              <div className="hero-float-card absolute bottom-10 right-0 w-[250px] rounded-[22px] border border-[#ff6a2a]/20 bg-[#15110e]/95 p-4 shadow-[0_30px_80px_rgba(0,0,0,.44)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ff8a55]"><Sparkles className="h-3.5 w-3.5" /> Scoutly AI</div>
                <p className="text-[12px] leading-5 text-stone-300">{isEnglish ? '12 companies match your current prospecting pattern.' : '12 empresas combinam com o seu padrão atual de prospecção.'}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-[76%] rounded-full bg-gradient-to-r from-[#ff8a32] to-[#ff4d00]" /></div>
              </div>
            </div>
          </div>
        </section>

        <div id="customers"><TrustedMarquee label={t.trusted} /></div>

        <section id="product" className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid items-end gap-8 lg:grid-cols-[.9fr_1.1fr]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff7a3d]">{t.videoKicker}</p>
                <h2 className="mt-4 max-w-xl text-[38px] font-semibold leading-[1.05] tracking-[-0.045em] text-white sm:text-[50px]">{t.videoTitle}</h2>
              </div>
              <p className="max-w-xl text-[14px] leading-7 text-stone-400 lg:justify-self-end">{t.videoCopy}</p>
            </div>

            <div className="site-video-shell mt-12 overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#0a0d12] p-2 shadow-[0_40px_120px_rgba(0,0,0,.5)] sm:p-3">
              <div className="relative overflow-hidden rounded-[24px] bg-black">
                <div className="site-product-image aspect-video w-full" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-[#0a0c10] py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:px-8 lg:grid-cols-2 lg:px-10">
            <article className="rounded-[30px] border border-white/[0.08] bg-white/[0.03] p-7 sm:p-10">
              <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-stone-300"><Layers3 className="h-5 w-5" /></div>
              <h2 className="max-w-xl text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[40px]">{t.problemTitle}</h2>
              <p className="mt-5 max-w-xl text-[14px] leading-7 text-stone-400">{t.problemCopy}</p>
            </article>
            <article className="site-solution-card rounded-[30px] border border-[#ff6a2a]/20 p-7 sm:p-10">
              <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff8a55]/20 bg-[#ff5a12]/10 text-[#ff8a55]"><Globe2 className="h-5 w-5" /></div>
              <h2 className="max-w-xl text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[40px]">{t.solutionTitle}</h2>
              <p className="mt-5 max-w-xl text-[14px] leading-7 text-stone-300">{t.solutionCopy}</p>
            </article>
          </div>
        </section>

        <section id="workflow" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff7a3d]">{t.platformKicker}</p>
              <h2 className="mt-4 text-[38px] font-semibold leading-[1.05] tracking-[-0.045em] text-white sm:text-[52px]">{t.platformTitle}</h2>
              <p className="mt-5 max-w-2xl text-[14px] leading-7 text-stone-400">{t.platformCopy}</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {workflow.map(([Icon, title, copy], index) => (
                <FeatureCard key={title as string} icon={<Icon className="h-5 w-5" />} title={title as string} copy={copy as string} index={`0${index + 1}`} />
              ))}
            </div>
          </div>
        </section>

        <section id="ai" className="relative overflow-hidden border-y border-white/[0.06] bg-[#0a0c10] py-24 sm:py-32">
          <div className="ai-orange-glow" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[.86fr_1.14fr] lg:px-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff7a3d]">{t.aiKicker}</p>
              <h2 className="mt-4 text-[38px] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[52px]">{t.aiTitle}</h2>
              <p className="mt-5 max-w-xl text-[14px] leading-7 text-stone-400">{t.aiCopy}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {t.aiBullets.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[11px] font-medium text-stone-300"><CheckCircle2 className="h-4 w-4 text-[#ff6a2a]" />{item}</div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/[0.10] bg-[#0d1015]/88 p-4 shadow-[0_40px_100px_rgba(0,0,0,.44)] backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#ff6a2a]" /><span className="text-[12px] font-semibold text-white">Scoutly AI</span></div>
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-400">{isEnglish ? 'ACTIVE' : 'ATIVA'}</span>
              </div>
              <div className="space-y-4">
                <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-white/[0.07] px-4 py-3 text-[12px] leading-6 text-stone-200">{t.aiPrompt}</div>
                <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-[#ff6a2a]/15 bg-[#ff5a12]/[0.07] px-4 py-3 text-[12px] leading-6 text-stone-300">{t.aiResponse}</div>
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/20 p-3 text-[10px] text-stone-500"><MessageSquareText className="h-4 w-4" />{isEnglish ? 'Ask about your territory, pipeline or next opportunities' : 'Pergunte sobre seu território, pipeline ou próximas oportunidades'}</div>
            </div>
          </div>
        </section>

        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff7a3d]">{t.useKicker}</p>
              <h2 className="mt-4 text-[38px] font-semibold leading-[1.05] tracking-[-0.045em] text-white sm:text-[52px]">{t.useTitle}</h2>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.08] md:grid-cols-2 lg:grid-cols-4">
              {audiences.map(([title, copy]) => (
                <article key={title} className="bg-[#0b0d11] p-6 sm:p-7">
                  <h3 className="text-[15px] font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-[12px] leading-6 text-stone-400">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 pt-6 sm:px-8 sm:pb-28 lg:px-10">
          <div className="site-final-cta mx-auto max-w-7xl overflow-hidden rounded-[34px] border border-[#ff7a3d]/20 px-6 py-16 text-center sm:px-10 sm:py-20">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.08] text-white"><Radar className="h-5 w-5" /></div>
            <h2 className="mx-auto mt-7 max-w-3xl text-[40px] font-semibold leading-[1.03] tracking-[-0.05em] text-white sm:text-[58px]">{t.finalTitle}</h2>
            <p className="mx-auto mt-5 max-w-xl text-[14px] leading-7 text-orange-50/70">{t.finalCopy}</p>
            <button type="button" onClick={primaryAction} className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[12px] font-semibold text-[#15100d] transition hover:-translate-y-0.5 hover:bg-orange-50">
              {t.finalCta}<ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] bg-[#080a0d]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-3"><img src="/logo_white.png" alt="Scoutly" className="h-7 w-auto" /><span className="hidden text-[10px] text-stone-600 sm:inline">{t.footer}</span></div>
          <div className="flex items-center gap-4 text-[10px] text-stone-600"><span>© {new Date().getFullYear()} Scoutly</span><button onClick={() => setLanguage(isEnglish ? 'pt' : 'en')} className="font-semibold uppercase text-stone-400 transition hover:text-white">{isEnglish ? 'PT-BR' : 'EN'}</button></div>
        </div>
      </footer>
    </div>
  );
}
