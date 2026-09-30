import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  Globe2,
  MapPin,
  Route,
  Search,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

interface MarketingSiteProps {
  isAuthenticated: boolean;
  onLogin: () => void;
  onStart: () => void;
  onOpenDashboard: () => void;
}

type Language = 'en' | 'pt';

const TRUSTED_LOGOS = [
  { name: 'Listerup', src: '/trusted/listerup.png' },
  { name: 'FeedMetrics', src: '/trusted/feedmetrics.png' },
  { name: 'Adwise', src: '/trusted/adwise.png' },
  { name: 'Armory', src: '/trusted/armory.png' },
  { name: 'Altora', src: '/trusted/altora.png' },
  { name: 'Planna', src: '/trusted/planna.png' },
  { name: 'Ternus', src: '/trusted/ternus.png' },
  { name: 'Wallcloud', src: '/trusted/wallcloud.png' },
  { name: 'VibeCheck', src: '/trusted/vibecheck.png' },
];

export default function MarketingSite({
  isAuthenticated,
  onLogin,
  onStart,
  onOpenDashboard,
}: MarketingSiteProps) {
  const [language, setLanguage] = useState<Language>('pt');
  const isEnglish = language === 'en';

  const t = isEnglish
    ? {
        title: 'Scoutly | Commercial intelligence for local prospecting',
        nav: { platform: 'Platform', intelligence: 'Intelligence', customers: 'Customers', workflow: 'Workflow' },
        login: 'Sign in',
        dashboard: 'Open dashboard',
        start: 'Start free',
        heroPill: 'The operating system for local prospecting',
        heroTitleA: 'Find the right companies.',
        heroTitleB: 'Know exactly why to contact them.',
        heroCopy:
          'Scoutly turns the map into a commercial intelligence layer. Discover businesses, understand their digital signals, organize opportunities and act from one place.',
        heroPrimary: 'Start prospecting free',
        heroSecondary: 'See how Scoutly works',
        heroMeta: ['Free plan available', 'No card required', 'Built for real prospecting workflows'],
        trusted: 'Used across products and teams building their next commercial opportunity',
        videoEyebrow: 'Scoutly in action',
        videoTitle: 'From an entire city to the right conversation.',
        videoCopy:
          'Search a territory, qualify companies, reveal public contacts, organize your pipeline and use AI without jumping between tools.',
        problemEyebrow: 'From noise to signal',
        problemTitle: 'Prospecting should not start with a spreadsheet.',
        problemCopy:
          'Most teams still stitch together maps, directories, tabs and manual research. Scoutly connects the territory, business context and the next action in one workflow.',
        problemCards: [
          ['Find', 'Search companies by category, region and commercial intent — directly on the map.'],
          ['Understand', 'See websites, public contacts, tracking, PageSpeed and other digital signals before outreach.'],
          ['Prioritize', 'Save favorites, use recommendations and focus on businesses that match your prospecting strategy.'],
          ['Act', 'Move prospects through the pipeline, build routes and generate outreach with Scoutly AI.'],
        ],
        platformEyebrow: 'One commercial layer',
        platformTitle: 'Everything around the business, not just a pin on a map.',
        mapTitle: 'Territory becomes a live prospecting workspace',
        mapCopy:
          'Explore local businesses spatially, filter what matters and keep commercial context attached to every company you open.',
        dataTitle: 'Signals that make the first approach smarter',
        dataCopy:
          'Scoutly combines public business information with digital presence signals so you can understand the opportunity before making contact.',
        aiTitle: 'AI with prospecting context built in',
        aiCopy:
          'Scoutly AI works with your searches, favorites and pipeline context to help find similar companies, recommend opportunities and prepare outreach.',
        workflowEyebrow: 'Built for the full motion',
        workflowTitle: 'Discovery, qualification and execution stay connected.',
        workflowSteps: [
          ['01', 'Search the territory', 'Describe what you want to find or explore directly on the map.'],
          ['02', 'Open the right businesses', 'Use credits to unlock business context and contact information when it matters.'],
          ['03', 'Build your pipeline', 'Favorite, qualify, add notes and move opportunities through your process.'],
          ['04', 'Turn context into action', 'Use routes and Scoutly AI to take the next commercial step.'],
        ],
        finalPill: 'Ready when your next territory is',
        finalTitle: 'Your next customer may already be a few blocks away.',
        finalCopy: 'Open Scoutly, choose an area and start finding companies worth talking to.',
        finalCta: 'Start free',
        footer: 'Commercial intelligence for local prospecting.',
      }
    : {
        title: 'Scoutly | Inteligência comercial para prospecção local',
        nav: { platform: 'Plataforma', intelligence: 'Inteligência', customers: 'Clientes', workflow: 'Fluxo' },
        login: 'Entrar',
        dashboard: 'Abrir dashboard',
        start: 'Começar grátis',
        heroPill: 'O sistema operacional da prospecção local',
        heroTitleA: 'Encontre as empresas certas.',
        heroTitleB: 'Saiba exatamente por que abordá-las.',
        heroCopy:
          'A Scoutly transforma o mapa em uma camada de inteligência comercial. Descubra negócios, entenda sinais digitais, organize oportunidades e aja em um só lugar.',
        heroPrimary: 'Começar a prospectar grátis',
        heroSecondary: 'Ver como a Scoutly funciona',
        heroMeta: ['Plano gratuito disponível', 'Sem cartão para começar', 'Criada para prospecção de verdade'],
        trusted: 'Usada por produtos e equipes que estão construindo suas próximas oportunidades comerciais',
        videoEyebrow: 'Scoutly em ação',
        videoTitle: 'De uma cidade inteira até a conversa certa.',
        videoCopy:
          'Pesquise um território, qualifique empresas, revele contatos públicos, organize o pipeline e use IA sem pular entre ferramentas.',
        problemEyebrow: 'Do ruído ao sinal',
        problemTitle: 'Prospecção não deveria começar em uma planilha.',
        problemCopy:
          'Muitas operações ainda juntam mapa, diretórios, abas e pesquisa manual. A Scoutly conecta território, contexto do negócio e próxima ação em um único fluxo.',
        problemCards: [
          ['Encontrar', 'Busque empresas por categoria, região e intenção comercial diretamente no mapa.'],
          ['Entender', 'Veja site, contatos públicos, tracking, PageSpeed e outros sinais digitais antes da abordagem.'],
          ['Priorizar', 'Salve favoritos, use recomendações e foque em empresas alinhadas à sua estratégia.'],
          ['Agir', 'Mova prospects no pipeline, monte rotas e gere abordagens com a Scoutly AI.'],
        ],
        platformEyebrow: 'Uma camada comercial completa',
        platformTitle: 'Tudo ao redor da empresa, não apenas um pin no mapa.',
        mapTitle: 'O território vira um workspace vivo de prospecção',
        mapCopy:
          'Explore negócios locais de forma espacial, filtre o que importa e mantenha o contexto comercial conectado a cada empresa aberta.',
        dataTitle: 'Sinais que deixam a primeira abordagem mais inteligente',
        dataCopy:
          'A Scoutly combina informações públicas do negócio com sinais de presença digital para você entender a oportunidade antes de entrar em contato.',
        aiTitle: 'IA com o contexto da sua prospecção',
        aiCopy:
          'A Scoutly AI considera buscas, favoritos e pipeline para encontrar empresas parecidas, recomendar oportunidades e ajudar na abordagem comercial.',
        workflowEyebrow: 'Pensada para o fluxo completo',
        workflowTitle: 'Descoberta, qualificação e execução continuam conectadas.',
        workflowSteps: [
          ['01', 'Pesquise o território', 'Descreva o que procura ou explore diretamente no mapa.'],
          ['02', 'Abra as empresas certas', 'Use créditos para revelar contexto e contatos quando aquela oportunidade realmente importa.'],
          ['03', 'Construa seu pipeline', 'Favorite, qualifique, registre notas e mova oportunidades pelo seu processo.'],
          ['04', 'Transforme contexto em ação', 'Use rotas e a Scoutly AI para dar o próximo passo comercial.'],
        ],
        finalPill: 'Pronta quando seu próximo território estiver',
        finalTitle: 'Seu próximo cliente pode estar a poucos quarteirões daqui.',
        finalCopy: 'Abra a Scoutly, escolha uma região e comece a encontrar empresas que valem uma conversa.',
        finalCta: 'Começar grátis',
        footer: 'Inteligência comercial para prospecção local.',
      };

  useEffect(() => {
    document.title = t.title;
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  }, [language, t.title]);

  const primaryAction = isAuthenticated ? onOpenDashboard : onStart;
  const primaryLabel = isAuthenticated ? t.dashboard : t.start;

  return (
    <main className="marketing-shell min-h-screen overflow-hidden bg-[#07090c] text-white">
      <nav className="site-nav fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Scoutly">
            <img src="/logo_white.png" alt="Scoutly" className="h-8 w-auto object-contain" />
          </a>

          <div className="hidden items-center gap-8 text-[13px] font-medium text-white/60 lg:flex">
            <a href="#platform" className="transition hover:text-white">{t.nav.platform}</a>
            <a href="#intelligence" className="transition hover:text-white">{t.nav.intelligence}</a>
            <a href="#customers" className="transition hover:text-white">{t.nav.customers}</a>
            <a href="#workflow" className="transition hover:text-white">{t.nav.workflow}</a>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="site-lang-switch hidden sm:flex">
              <button type="button" onClick={() => setLanguage('pt')} className={language === 'pt' ? 'is-active' : ''}>PT</button>
              <button type="button" onClick={() => setLanguage('en')} className={language === 'en' ? 'is-active' : ''}>EN</button>
            </div>
            {!isAuthenticated && (
              <button type="button" onClick={onLogin} className="hidden h-10 px-4 text-[12px] font-semibold text-white/70 transition hover:text-white sm:block">
                {t.login}
              </button>
            )}
            <button type="button" onClick={primaryAction} className="site-primary-button h-10 px-4 text-[12px] font-semibold sm:px-5">
              {primaryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>

      <section id="top" className="site-hero relative flex min-h-[860px] items-center pt-28">
        <div className="site-hero-grid" aria-hidden="true" />
        <div className="site-orange-orb site-orange-orb-one" aria-hidden="true" />
        <div className="site-orange-orb site-orange-orb-two" aria-hidden="true" />

        <div className="relative z-10 mx-auto w-full max-w-[1320px] px-5 pb-24 pt-20 text-center sm:px-8 lg:px-10">
          <div className="site-pill mx-auto mb-8 w-fit">
            <Sparkles className="h-3.5 w-3.5" />
            {t.heroPill}
          </div>
          <h1 className="mx-auto max-w-[1020px] text-[52px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[70px] lg:text-[88px]">
            <span className="block text-white">{t.heroTitleA}</span>
            <span className="site-gradient-text mt-2 block">{t.heroTitleB}</span>
          </h1>
          <p className="mx-auto mt-8 max-w-[760px] text-[16px] leading-7 text-white/54 sm:text-[18px] sm:leading-8">
            {t.heroCopy}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={primaryAction} className="site-primary-button h-12 px-6 text-[13px] font-semibold">
              {isAuthenticated ? t.dashboard : t.heroPrimary}
              <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#product-video" className="site-secondary-button h-12 px-6 text-[13px] font-semibold">
              {t.heroSecondary}
            </a>
          </div>
          <div className="mx-auto mt-7 flex max-w-[760px] flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-white/36">
            {t.heroMeta.map((item) => (
              <span key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#FF7A3D]" />
                {item}
              </span>
            ))}
          </div>

          <div id="product-video" className="site-product-stage mx-auto mt-16 max-w-[1160px] text-left">
            <div className="site-browser-bar">
              <div className="flex gap-1.5"><span /><span /><span /></div>
              <div className="site-browser-address">scoutly.pro/dashboard</div>
              <div className="w-12" />
            </div>
            <div className="site-video-portal-anchor">
              <img className="site-product-image" src="/scoutly-product-screen.webp" alt="Scoutly" />
            </div>
          </div>
        </div>
      </section>

      <section id="customers" className="site-trusted-section border-y border-white/[0.07] bg-[#0a0c10] py-11">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-10">
          <p className="mx-auto mb-8 max-w-2xl text-center text-[11px] font-medium uppercase tracking-[0.16em] text-white/32">{t.trusted}</p>
        </div>
        <div className="site-logo-marquee">
          <div className="site-logo-track">
            {[...TRUSTED_LOGOS, ...TRUSTED_LOGOS].map((logo, index) => (
              <div key={`${logo.name}-${index}`} className="site-logo-slot" title={logo.name}>
                <img src={logo.src} alt={logo.name} className="site-trusted-logo" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section bg-[#0b0d11] py-28 sm:py-36">
        <div className="mx-auto grid max-w-[1320px] gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <div className="site-eyebrow">{t.problemEyebrow}</div>
            <h2 className="mt-5 max-w-[560px] text-[38px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[52px]">{t.problemTitle}</h2>
            <p className="mt-6 max-w-[560px] text-[15px] leading-7 text-white/48">{t.problemCopy}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.problemCards.map(([title, copy], index) => {
              const icons = [Search, Database, Target, Route];
              const Icon = icons[index];
              return (
                <article key={title} className="site-feature-card group min-h-[250px] p-6 sm:p-7">
                  <div className="site-feature-icon"><Icon className="h-5 w-5" /></div>
                  <div className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#FF7A3D]">0{index + 1}</div>
                  <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.025em]">{title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-white/44">{copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="platform" className="site-section relative overflow-hidden bg-[#f4f0e8] py-28 text-[#151515] sm:py-36">
        <div className="site-light-orb" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-10">
          <div className="max-w-[850px]">
            <div className="site-eyebrow site-eyebrow-light">{t.platformEyebrow}</div>
            <h2 className="mt-5 text-[40px] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-[58px]">{t.platformTitle}</h2>
          </div>

          <div className="mt-16 grid gap-4 lg:grid-cols-3">
            <article className="site-light-card lg:col-span-2">
              <div className="site-map-visual">
                <div className="site-map-grid" />
                <div className="site-map-pin pin-a"><MapPin className="h-4 w-4" /></div>
                <div className="site-map-pin pin-b"><MapPin className="h-4 w-4" /></div>
                <div className="site-map-pin pin-c"><MapPin className="h-4 w-4" /></div>
                <div className="site-map-search"><Search className="h-4 w-4" /> agências de marketing em Pinheiros</div>
              </div>
              <div className="p-7 sm:p-9">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e34d00]"><MapPin className="h-4 w-4" />Mapa inteligente</div>
                <h3 className="mt-3 text-[27px] font-semibold tracking-[-0.035em]">{t.mapTitle}</h3>
                <p className="mt-3 max-w-2xl text-[14px] leading-7 text-black/52">{t.mapCopy}</p>
              </div>
            </article>

            <article className="site-light-card flex flex-col justify-between p-7 sm:p-9">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e34d00]"><Database className="h-4 w-4" />Dados e sinais</div>
                <h3 className="mt-3 text-[27px] font-semibold tracking-[-0.035em]">{t.dataTitle}</h3>
                <p className="mt-3 text-[14px] leading-7 text-black/52">{t.dataCopy}</p>
              </div>
              <div className="mt-10 space-y-2.5">
                {['Website', 'Public contacts', 'Tracking', 'PageSpeed', 'Social presence'].map((signal, index) => (
                  <div key={signal} className="flex items-center justify-between rounded-xl border border-black/[0.08] bg-white/65 px-4 py-3 text-[12px] font-medium">
                    <span>{signal}</span><span className={index < 3 ? 'text-emerald-600' : 'text-[#e34d00]'}>{index < 3 ? 'Detected' : 'Opportunity'}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="intelligence" className="site-section relative overflow-hidden bg-[#080a0d] py-28 sm:py-36">
        <div className="site-ai-glow" aria-hidden="true" />
        <div className="relative z-10 mx-auto grid max-w-[1320px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:px-10">
          <div>
            <div className="site-eyebrow">Scoutly AI</div>
            <h2 className="mt-5 max-w-[610px] text-[40px] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-[58px]">{t.aiTitle}</h2>
            <p className="mt-6 max-w-[570px] text-[15px] leading-7 text-white/48">{t.aiCopy}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {['Context-aware search', 'Recommendations', 'Outreach generation', 'Pipeline intelligence'].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-[12px] font-medium text-white/68">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF5A12]/12 text-[#FF7A3D]"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="site-ai-console">
            <div className="site-ai-console-top">
              <div className="flex items-center gap-2"><img src="/ai-sparkles-orange.svg" alt="" className="h-5 w-5" /><span>Scoutly AI</span></div>
              <span className="site-live-dot">Live context</span>
            </div>
            <div className="site-ai-message site-ai-user-message">
              {isEnglish
                ? 'Find businesses similar to my favorites around Vila Madalena and prioritize companies with weak digital presence.'
                : 'Encontre empresas parecidas com meus favoritos na Vila Madalena e priorize negócios com presença digital fraca.'}
            </div>
            <div className="site-ai-thinking"><Sparkles className="h-4 w-4" /> {isEnglish ? 'Reading territory, favorites and pipeline…' : 'Lendo território, favoritos e pipeline…'}</div>
            <div className="site-ai-results">
              {[['Ateliê Aurora', '92%'], ['Casa Ponto', '87%'], ['Studio Noma', '84%']].map(([name, score]) => (
                <div key={name} className="site-ai-result-row">
                  <div><strong>{name}</strong><span>{isEnglish ? 'High-fit local prospect' : 'Prospect local com alto fit'}</span></div>
                  <span>{score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="site-section bg-[#101216] py-28 sm:py-36">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-10">
          <div className="max-w-[850px]">
            <div className="site-eyebrow">{t.workflowEyebrow}</div>
            <h2 className="mt-5 text-[40px] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-[58px]">{t.workflowTitle}</h2>
          </div>
          <div className="mt-16 border-t border-white/[0.09]">
            {t.workflowSteps.map(([number, title, copy], index) => {
              const WorkflowIcon = [Search, Building2, Target, Zap][index];
              return (
                <div key={number} className="site-workflow-row group">
                  <div className="site-workflow-number">{number}</div>
                  <div className="site-workflow-icon"><WorkflowIcon className="h-5 w-5" /></div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <ArrowRight className="site-workflow-arrow h-5 w-5" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="site-final-section relative overflow-hidden py-28 sm:py-40">
        <div className="site-final-glow" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[1000px] px-5 text-center sm:px-8">
          <div className="site-pill mx-auto w-fit"><Globe2 className="h-3.5 w-3.5" />{t.finalPill}</div>
          <h2 className="mx-auto mt-7 max-w-[900px] text-[44px] font-semibold leading-[1.01] tracking-[-0.052em] sm:text-[68px]">{t.finalTitle}</h2>
          <p className="mx-auto mt-6 max-w-[640px] text-[15px] leading-7 text-white/48">{t.finalCopy}</p>
          <button type="button" onClick={primaryAction} className="site-primary-button mx-auto mt-9 h-12 px-6 text-[13px] font-semibold">
            {isAuthenticated ? t.dashboard : t.finalCta}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] bg-[#07090c]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-8 text-[11px] text-white/34 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-3"><img src="/logo_white.png" alt="Scoutly" className="h-6 w-auto opacity-90" /><span>{t.footer}</span></div>
          <div className="flex items-center gap-4"><span>© 2026 Scoutly</span><button type="button" onClick={() => setLanguage(isEnglish ? 'pt' : 'en')} className="transition hover:text-white">{isEnglish ? 'Português' : 'English'}</button></div>
        </div>
      </footer>
    </main>
  );
}
