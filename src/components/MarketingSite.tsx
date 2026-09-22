import { useEffect } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  Compass,
  Database,
  Instagram,
  MapPin,
  Route,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import { formatBRL, SCOUTLY_PLANS } from '../lib/billing';

interface MarketingSiteProps {
  isAuthenticated: boolean;
  onLogin: () => void;
  onStart: () => void;
  onOpenDashboard: () => void;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FF7A3D]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A12] shadow-[0_0_16px_rgba(255,90,18,0.75)]" />
      {children}
    </div>
  );
}

function Plan({
  name,
  price,
  description,
  features,
  featured,
  onStart,
}: {
  name: string;
  price: number;
  description: string;
  features: string[];
  featured?: boolean;
  onStart: () => void;
}) {
  return (
    <article
      className={`relative flex h-full flex-col border-t px-0 py-7 sm:px-6 md:border-l md:border-t-0 md:py-4 ${
        featured ? 'border-[#FF5A12]/45' : 'border-white/[0.09]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            {name}
          </span>
          <div className="mt-4 flex items-end gap-1">
            <strong className="text-[34px] font-semibold tracking-[-0.045em] text-white">
              {formatBRL(price)}
            </strong>
            <span className="pb-1.5 text-[11px] text-stone-600">por mês</span>
          </div>
        </div>
        {featured && (
          <span className="rounded-full border border-[#FF5A12]/20 bg-[#FF5A12]/[0.09] px-2.5 py-1 text-[9px] font-semibold text-[#FF7A3D]">
            Mais escolhido
          </span>
        )}
      </div>

      <p className="mt-3 min-h-10 max-w-xs text-[12px] leading-6 text-stone-500">
        {description}
      </p>

      <div className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-2.5 text-[11px] leading-5 text-stone-400">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6A26]" />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className={`mt-7 flex h-11 items-center justify-center gap-2 rounded-xl text-[11px] font-semibold transition duration-300 ${
          featured
            ? 'bg-[#FF5A12] text-white shadow-[0_12px_34px_rgba(255,90,18,0.16)] hover:bg-[#ff6a27]'
            : 'border border-white/[0.10] bg-white/[0.035] text-stone-200 hover:border-white/[0.16] hover:bg-white/[0.06]'
        }`}
      >
        Começar grátis
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}

export default function MarketingSite({
  isAuthenticated,
  onLogin,
  onStart,
  onOpenDashboard,
}: MarketingSiteProps) {
  useEffect(() => {
    document.title = 'Scoutly | Inteligência comercial para prospecção local';

    const elements = Array.from(document.querySelectorAll<HTMLElement>('.site-reveal'));
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -7% 0px' }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const startAction = isAuthenticated ? onOpenDashboard : onStart;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07090c] text-white selection:bg-[#FF5A12]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#07090c]/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-[74px] max-w-[1320px] items-center justify-between px-5 lg:px-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center"
          >
            <img src="/logo_white.png" alt="Scoutly" className="h-9 w-auto object-contain" />
          </button>

          <nav className="hidden items-center gap-8 lg:flex">
            <a href="#produto" className="text-[11px] font-medium text-stone-400 transition hover:text-white">
              Produto
            </a>
            <a href="#plataforma" className="text-[11px] font-medium text-stone-400 transition hover:text-white">
              Plataforma
            </a>
            <a href="#inteligencia" className="text-[11px] font-medium text-stone-400 transition hover:text-white">
              Scoutly AI
            </a>
            <a href="#precos" className="text-[11px] font-medium text-stone-400 transition hover:text-white">
              Preços
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isAuthenticated ? onOpenDashboard : onLogin}
              className="hidden h-10 items-center rounded-xl px-3.5 text-[11px] font-semibold text-stone-300 transition hover:bg-white/[0.05] hover:text-white sm:flex"
            >
              {isAuthenticated ? 'Abrir dashboard' : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={startAction}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#FF5A12] px-4 text-[11px] font-semibold text-white shadow-[0_12px_34px_rgba(255,90,18,0.14)] transition duration-300 hover:-translate-y-px hover:bg-[#ff6a27]"
            >
              {isAuthenticated ? 'Ir para a Scoutly' : 'Começar grátis'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative px-5 pb-24 pt-[152px] lg:px-8 lg:pb-32 lg:pt-[188px]">
          <div className="site-ambient site-ambient-one" />
          <div className="site-ambient site-ambient-two" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.018),transparent_72%)]" />

          <div className="relative mx-auto max-w-[1240px]">
            <div className="site-reveal max-w-[930px]">
              <SectionLabel>Inteligência comercial para prospecção local</SectionLabel>
              <h1 className="mt-6 max-w-[970px] text-[48px] font-semibold leading-[0.98] tracking-[-0.058em] text-white sm:text-[66px] lg:text-[88px]">
                Transforme território em oportunidades comerciais.
              </h1>
              <p className="mt-7 max-w-[720px] text-[15px] leading-7 text-stone-400 sm:text-[17px] sm:leading-8">
                A Scoutly reúne descoberta de empresas, sinais digitais, dados públicos, organização comercial e inteligência artificial em uma única plataforma.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={startAction}
                  className="flex h-12 items-center gap-2 rounded-xl bg-[#FF5A12] px-5 text-xs font-semibold text-white shadow-[0_18px_54px_rgba(255,90,18,0.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#ff6a27]"
                >
                  {isAuthenticated ? 'Abrir Scoutly' : 'Começar grátis por 7 dias'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#produto"
                  className="flex h-12 items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.025] px-5 text-xs font-semibold text-stone-300 backdrop-blur-xl transition duration-300 hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white"
                >
                  Conhecer a plataforma
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/[0.07] pt-5 text-[10px] text-stone-500">
                <span>Teste Pro por 7 dias</span>
                <span>Sem cartão durante o teste</span>
                <span>Planos a partir de {formatBRL(SCOUTLY_PLANS.go.monthlyPrice)}</span>
              </div>
            </div>

            <div id="produto" className="site-reveal relative mt-16 scroll-mt-28 sm:mt-20 lg:mt-24">
              <div className="site-product-glow" />
              <div className="site-product-shell">
                <div className="site-product-toolbar">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/[0.10]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/[0.10]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/[0.10]" />
                  </div>
                  <div className="mx-auto hidden h-7 w-[46%] items-center justify-center rounded-lg border border-white/[0.06] bg-black/[0.18] text-[9px] text-stone-600 sm:flex">
                    scoutly.pro/dashboard
                  </div>
                  <span className="text-[9px] font-medium text-stone-600">Scoutly</span>
                </div>

                <div className="relative overflow-hidden bg-[#090c10]">
                  <img
                    src="/scoutly-product-screen.webp"
                    alt="Tela real da Scoutly com mapa de prospecção e empresas"
                    className="site-product-image block h-auto w-full"
                    loading="eager"
                  />
                  <div className="site-product-sheen" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="plataforma" className="border-y border-white/[0.06] bg-[#090c10] px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1240px]">
            <div className="site-reveal grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div>
                <SectionLabel>Uma plataforma para todo o fluxo</SectionLabel>
                <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl">
                  Descoberta, contexto e execução no mesmo lugar.
                </h2>
              </div>
              <p className="max-w-[650px] text-sm leading-7 text-stone-500 lg:justify-self-end">
                A Scoutly foi desenhada para reduzir a distância entre encontrar uma empresa e iniciar uma conversa comercial. O mapa é o ponto de partida. Dados, filtros, pipeline, rotas e IA completam o processo.
              </p>
            </div>

            <div className="site-reveal mt-16 border-y border-white/[0.075]">
              {[
                {
                  number: '01',
                  icon: Search,
                  title: 'Busca contextual',
                  copy: 'Pesquise por segmento e região com linguagem natural. A plataforma interpreta o que você procura e transforma a busca em uma área comercial acionável.',
                },
                {
                  number: '02',
                  icon: Database,
                  title: 'Sinais para qualificar',
                  copy: 'Veja presença digital, contatos públicos, site, PageSpeed, tracking, categoria, confiança dos dados e outros sinais antes de abordar.',
                },
                {
                  number: '03',
                  icon: Target,
                  title: 'Pipeline conectado ao mapa',
                  copy: 'Salve favoritos, mova oportunidades entre etapas, registre comentários e mantenha o histórico da prospecção sem perder o contexto geográfico.',
                },
                {
                  number: '04',
                  icon: Route,
                  title: 'Prospecção presencial',
                  copy: 'Selecione empresas, monte uma sequência de visitas e abra o trajeto no Google Maps quando a venda precisa acontecer fora da tela.',
                },
              ].map(({ number, icon: Icon, title, copy }) => (
                <article
                  key={number}
                  className="group grid gap-5 border-b border-white/[0.07] py-7 last:border-b-0 sm:grid-cols-[68px_48px_0.7fr_1.3fr] sm:items-center sm:gap-6 lg:py-9"
                >
                  <span className="text-[10px] font-semibold tracking-[0.16em] text-stone-700">{number}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-stone-500 transition duration-300 group-hover:border-[#FF5A12]/25 group-hover:bg-[#FF5A12]/[0.06] group-hover:text-[#FF7A3D]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-white">{title}</h3>
                  <p className="max-w-[620px] text-[12px] leading-6 text-stone-500">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="inteligencia" className="relative overflow-hidden px-5 py-24 lg:px-8 lg:py-32">
          <div className="site-ambient site-ambient-three" />
          <div className="site-reveal relative mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionLabel>Scoutly AI</SectionLabel>
              <h2 className="mt-5 max-w-[570px] text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl">
                Inteligência que considera o comportamento da sua prospecção.
              </h2>
              <p className="mt-5 max-w-[580px] text-sm leading-7 text-stone-500">
                Buscas, favoritos, pipeline e interações ajudam a Scoutly a construir contexto para recomendações e sugestões mais relevantes dentro da plataforma.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  'Descubra empresas parecidas com as que você já priorizou',
                  'Encontre oportunidades alinhadas ao seu pipeline atual',
                  'Peça novas buscas usando linguagem natural',
                  'Gere uma abordagem comercial a partir do contexto do prospect',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-[12px] leading-6 text-stone-400">
                    <CircleCheck className="mt-1 h-4 w-4 shrink-0 text-[#FF6A26]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="site-ai-panel">
              <div className="site-ai-orbit" />
              <div className="relative">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] text-[#FF7A3D]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <strong className="block text-[12px] font-semibold text-white">Scoutly AI</strong>
                      <span className="mt-1 block text-[9px] text-stone-600">Inteligência comercial contextual</span>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-1 text-[8px] font-semibold text-emerald-400">
                    Ativa
                  </span>
                </div>

                <div className="py-7">
                  <p className="max-w-[520px] text-[15px] leading-7 text-stone-200">
                    Encontre empresas parecidas com meus favoritos em São Paulo e priorize as que ainda não possuem site.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {[
                    ['Contexto considerado', 'Favoritos, buscas recentes e região atual'],
                    ['Objetivo', 'Encontrar novas oportunidades comerciais'],
                    ['Próxima ação', 'Abrir resultados diretamente no mapa'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-1 border-t border-white/[0.06] py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[9px] uppercase tracking-[0.10em] text-stone-700">{label}</span>
                      <span className="text-[10px] font-medium text-stone-400">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex h-11 items-center rounded-xl border border-white/[0.08] bg-black/[0.20] px-3.5">
                  <span className="text-[10px] text-stone-600">Pergunte algo sobre sua prospecção</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-[#FF6A26]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-[#090c10] px-5 py-24 lg:px-8 lg:py-32">
          <div className="site-reveal mx-auto max-w-[1240px]">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <SectionLabel>Para operações comerciais modernas</SectionLabel>
                <h2 className="mt-5 max-w-[560px] text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl">
                  Uma base única para encontrar e desenvolver oportunidades locais.
                </h2>
              </div>

              <div className="grid gap-x-12 gap-y-7 sm:grid-cols-2">
                {[
                  ['Agências', 'Encontre empresas com sinais claros de oportunidade digital e leve contexto para a primeira abordagem.'],
                  ['Vendas B2B', 'Mapeie territórios, identifique prospects e organize o avanço comercial sem depender de planilhas dispersas.'],
                  ['Freelancers', 'Descubra negócios que podem precisar de site, mídia, conteúdo, automação ou outros serviços especializados.'],
                  ['Equipes externas', 'Combine mapa, rota de visitas e pipeline para manter a operação presencial conectada ao processo comercial.'],
                ].map(([title, copy]) => (
                  <div key={title} className="border-t border-white/[0.09] pt-5">
                    <h3 className="text-[14px] font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-[11px] leading-6 text-stone-500">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="precos" className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="site-reveal mx-auto max-w-[1240px]">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <SectionLabel>Planos</SectionLabel>
                <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl">
                  Estrutura simples para começar e crescer.
                </h2>
              </div>
              <p className="max-w-[600px] text-sm leading-7 text-stone-500 lg:justify-self-end">
                Todos os novos usuários começam com acesso ao Pro por 7 dias. Depois, basta escolher o plano adequado ao ritmo da operação.
              </p>
            </div>

            <div className="mt-14 grid md:grid-cols-3">
              <Plan
                name="Go"
                price={SCOUTLY_PLANS.go.monthlyPrice}
                description="Para profissionais que estão começando a estruturar uma rotina de prospecção."
                features={[
                  'Mapa e busca de empresas',
                  `Até ${SCOUTLY_PLANS.go.monthlyAnalysisLimit} análises por mês`,
                  'Contatos públicos, favoritos e pipeline',
                  `Até ${SCOUTLY_PLANS.go.monthlyAiMessageLimit} mensagens com IA por mês`,
                ]}
                onStart={startAction}
              />
              <Plan
                name="Pro"
                price={SCOUTLY_PLANS.pro.monthlyPrice}
                description="Para quem usa prospecção como processo recorrente de geração de oportunidades."
                features={[
                  'Busca e filtros avançados',
                  'Enriquecimento de contatos públicos',
                  'Tracking, PageSpeed e sinais digitais',
                  'Scoutly AI, recomendações e exportação',
                ]}
                featured
                onStart={startAction}
              />
              <Plan
                name="Agency"
                price={SCOUTLY_PLANS.agency.monthlyPrice}
                description="Para equipes que precisam ampliar capacidade e compartilhar a operação."
                features={[
                  'Tudo do Pro',
                  '5 usuários incluídos',
                  'Estrutura preparada para equipes',
                  'Maior capacidade para uso recorrente',
                ]}
                onStart={startAction}
              />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.06] px-5 py-24 lg:px-8 lg:py-32">
          <div className="site-ambient site-ambient-four" />
          <div className="site-reveal relative mx-auto max-w-[1240px]">
            <div className="border-y border-white/[0.09] py-14 sm:py-20">
              <SectionLabel>Comece agora</SectionLabel>
              <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <h2 className="max-w-[850px] text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                  Sua próxima oportunidade pode estar a poucos quarteirões de distância.
                </h2>
                <button
                  type="button"
                  onClick={startAction}
                  className="flex h-12 w-fit items-center gap-2 rounded-xl bg-[#FF5A12] px-5 text-xs font-semibold text-white shadow-[0_18px_54px_rgba(255,90,18,0.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#ff6a27]"
                >
                  {isAuthenticated ? 'Abrir Scoutly' : 'Começar grátis'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
            <img src="/logo_white.png" alt="Scoutly" className="h-8 w-auto self-start object-contain opacity-95" />

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[10px] text-stone-500">
              <a href="#produto" className="transition hover:text-white">Produto</a>
              <a href="#plataforma" className="transition hover:text-white">Plataforma</a>
              <a href="#inteligencia" className="transition hover:text-white">Scoutly AI</a>
              <a href="#precos" className="transition hover:text-white">Preços</a>
              <button type="button" onClick={onLogin} className="transition hover:text-white">Entrar</button>
              <a
                href="https://instagram.com/scoutly.pro"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition hover:text-white"
              >
                <Instagram className="h-3.5 w-3.5" />
                @scoutly.pro
              </a>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-white/[0.06] pt-5 text-[9px] text-stone-700 sm:flex-row">
            <span>© {new Date().getFullYear()} Scoutly</span>
            <span>Prospecção local com inteligência comercial</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
