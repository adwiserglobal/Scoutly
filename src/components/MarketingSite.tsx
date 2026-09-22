import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Check,
  ChevronRight,
  CircleDot,
  Compass,
  Database,
  Globe2,
  MapPin,
  MessageCircle,
  Route,
  Search,
  Sparkles,
  Star,
  Target,
  Zap,
} from 'lucide-react';
import { formatBRL, SCOUTLY_PLANS } from '../lib/billing';

interface MarketingSiteProps {
  isAuthenticated: boolean;
  onLogin: () => void;
  onStart: () => void;
  onOpenDashboard: () => void;
}

const featureCards = [
  {
    icon: Search,
    title: 'Busque como você pensa',
    copy: 'Digite “despachantes em Pinheiros” ou “restaurantes sem site em Curitiba”. A Scoutly entende negócio + região.',
  },
  {
    icon: Target,
    title: 'Encontre o sinal de oportunidade',
    copy: 'Site, contatos, PageSpeed, tracking, redes sociais e confiança dos dados em uma leitura rápida.',
  },
  {
    icon: Route,
    title: 'Transforme mapa em ação',
    copy: 'Favorite, organize no pipeline, monte uma rota de visitas e mantenha o contexto comercial no mesmo lugar.',
  },
];

const useCases = [
  'Agências e gestores de tráfego',
  'Freelancers e criadores de sites',
  'Vendas B2B e SDRs',
  'SaaS para negócios locais',
  'Consultorias e serviços profissionais',
  'Operações de prospecção presencial',
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[1180px] overflow-hidden rounded-[30px] border border-white/[0.10] bg-[#0b0e12] shadow-[0_42px_120px_rgba(0,0,0,0.48)]">
      <div className="flex h-11 items-center gap-2 border-b border-white/[0.07] bg-[#101318] px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-white/[0.10]" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/[0.10]" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/[0.10]" />
        <div className="ml-3 flex h-7 flex-1 items-center rounded-lg border border-white/[0.06] bg-black/[0.20] px-3 text-[9px] text-stone-600">
          scoutly.pro/dashboard
        </div>
      </div>

      <div className="grid min-h-[570px] grid-cols-[68px_minmax(0,1fr)] sm:grid-cols-[76px_minmax(0,1fr)]">
        <aside className="border-r border-white/[0.07] bg-[#0d1014] px-2 py-4">
          <img src="/scoutly-mark.png" alt="" className="mx-auto h-8 w-8 object-contain" />
          <div className="mt-10 space-y-3">
            {[Compass, Star, Target].map((Icon, index) => (
              <div
                key={index}
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${
                  index === 0
                    ? 'bg-white/[0.07] text-[#FF6A26]'
                    : 'text-stone-700'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>
        </aside>

        <div className="relative overflow-hidden bg-[#0b1013]">
          <div className="absolute inset-0 opacity-90">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_40%,rgba(255,90,18,0.10),transparent_18rem),linear-gradient(135deg,#11181b_0%,#0a1013_56%,#111417_100%)]" />
            <div className="absolute left-[12%] top-[-8%] h-[120%] w-[3px] rotate-[29deg] bg-white/[0.055]" />
            <div className="absolute left-[33%] top-[-5%] h-[120%] w-[2px] -rotate-[18deg] bg-white/[0.045]" />
            <div className="absolute left-[-8%] top-[42%] h-[3px] w-[120%] rotate-[8deg] bg-white/[0.05]" />
            <div className="absolute left-[8%] top-[69%] h-[2px] w-[105%] -rotate-[13deg] bg-white/[0.04]" />
          </div>

          <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-2 md:left-8 md:right-8">
            <div className="scoutly-search-focus-ring flex h-11 min-w-0 flex-1 items-center rounded-2xl border border-white/10 bg-[#111418]/95 px-4 shadow-xl backdrop-blur-xl md:max-w-[520px]">
              <Search className="mr-3 h-4 w-4 shrink-0 text-[#FF6A26]" />
              <span className="truncate text-[11px] text-stone-300">Despachantes em Pinheiros, São Paulo</span>
              <span className="ml-auto rounded-lg bg-[#FF5A12] px-2 py-1 text-[8px] font-bold text-white">BUSCAR</span>
            </div>
            <div className="hidden h-11 items-center rounded-2xl border border-white/10 bg-[#111418]/95 px-3 text-[9px] font-semibold text-stone-300 sm:flex">
              Recomendados
            </div>
          </div>

          {[
            ['18', '28%', '27%', '16%', '11%'],
            ['12', '22%', '40%', '31%', '26%'],
            ['7', '74%', '62%', '19%', '42%'],
            ['23', '54%', '25%', '56%', '17%'],
          ].map(([count, left, top], index) => (
            <div
              key={index}
              className="absolute z-[3] flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-[#ff8b54]/70 bg-[#FF5A12] px-2 text-[10px] font-bold text-white shadow-[0_8px_24px_rgba(255,90,18,0.28)]"
              style={{ left, top }}
            >
              {count}
            </div>
          ))}

          <div className="absolute bottom-5 left-5 right-5 z-10 md:bottom-8 md:left-8 md:right-auto md:w-[500px]">
            <div className="rounded-[22px] border border-white/[0.10] bg-[#101418]/95 p-4 shadow-[0_26px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-[#0b0e12] text-stone-500">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-white">Despachante Paulista</p>
                      <p className="mt-1 text-[9px] text-stone-600">Serviços automotivos · Pinheiros</p>
                    </div>
                    <span className="rounded-full bg-[#FF5A12]/10 px-2.5 py-1 text-[8px] font-bold text-[#FF7A3D]">
                      Sem site
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2">
                      <span className="block text-[8px] text-stone-600">Contato</span>
                      <strong className="mt-1 block text-[9px] text-stone-300">WhatsApp</strong>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2">
                      <span className="block text-[8px] text-stone-600">Confiança</span>
                      <strong className="mt-1 block text-[9px] text-emerald-400">92%</strong>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2">
                      <span className="block text-[8px] text-stone-600">Status</span>
                      <strong className="mt-1 block text-[9px] text-stone-300">Novo lead</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 right-5 z-10 hidden rounded-2xl border border-white/[0.09] bg-[#111418]/95 p-2 shadow-xl md:block">
            <div className="flex items-center gap-2 rounded-xl bg-[#FF5A12]/[0.08] px-3 py-2 text-[9px] font-semibold text-[#FF7A3D]">
              <Sparkles className="h-3.5 w-3.5" />
              Scoutly AI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
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
      className={`relative flex flex-col rounded-[26px] border p-6 ${
        featured
          ? 'border-[#FF5A12]/40 bg-[#131518] shadow-[0_28px_70px_rgba(255,90,18,0.08)]'
          : 'border-white/[0.08] bg-[#0e1216]'
      }`}
    >
      {featured && (
        <span className="absolute right-5 top-5 rounded-full border border-[#FF5A12]/20 bg-[#FF5A12]/[0.10] px-2.5 py-1 text-[9px] font-bold text-[#FF7A3D]">
          MAIS INDICADO
        </span>
      )}
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-600">{name}</span>
      <div className="mt-4">
        <strong className="text-3xl font-semibold tracking-[-0.04em] text-white">{formatBRL(price)}</strong>
        <span className="ml-1 text-xs text-stone-600">/mês</span>
      </div>
      <p className="mt-2 min-h-10 text-xs leading-relaxed text-stone-500">{description}</p>
      <div className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-2.5 text-[11px] leading-relaxed text-stone-400">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6A26]" />
            {feature}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onStart}
        className={`mt-7 flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition ${
          featured
            ? 'bg-[#FF5A12] text-white hover:bg-[#ff6a27]'
            : 'border border-white/[0.10] bg-white/[0.035] text-stone-200 hover:bg-white/[0.06]'
        }`}
      >
        Começar grátis
        <ArrowRight className="h-4 w-4" />
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
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07090c] text-white selection:bg-[#FF5A12]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#07090c]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo_white.png" alt="Scoutly" className="h-9 w-auto object-contain" />
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            <a href="#produto" className="text-[11px] font-medium text-stone-500 transition hover:text-white">Produto</a>
            <a href="#recursos" className="text-[11px] font-medium text-stone-500 transition hover:text-white">Recursos</a>
            <a href="#precos" className="text-[11px] font-medium text-stone-500 transition hover:text-white">Preços</a>
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
              onClick={isAuthenticated ? onOpenDashboard : onStart}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#FF5A12] px-4 text-[11px] font-semibold text-white shadow-[0_12px_34px_rgba(255,90,18,0.14)] transition hover:bg-[#ff6a27]"
            >
              {isAuthenticated ? 'Ir para a Scoutly' : 'Começar grátis'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-[150px] lg:px-8 lg:pb-28 lg:pt-[178px]">
          <div className="pointer-events-none absolute left-1/2 top-[-16rem] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-[#FF5A12]/[0.09] blur-[130px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.018),transparent)]" />

          <div className="relative mx-auto max-w-[1050px] text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-[10px] font-medium text-stone-400">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A12] shadow-[0_0_12px_rgba(255,90,18,0.8)]" />
              Prospecção local com inteligência
            </div>
            <h1 className="mx-auto max-w-[900px] text-[42px] font-semibold leading-[1.02] tracking-[-0.055em] text-white sm:text-[58px] lg:text-[74px]">
              Encontre empresas que precisam do que você vende.
            </h1>
            <p className="mx-auto mt-6 max-w-[670px] text-[15px] leading-7 text-stone-500 sm:text-base">
              A Scoutly transforma o mapa em uma máquina de prospecção. Descubra negócios,
              identifique sinais de oportunidade e organize seus leads sem trocar de ferramenta.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onStart}
                className="flex h-12 items-center gap-2 rounded-2xl bg-[#FF5A12] px-5 text-xs font-semibold text-white shadow-[0_16px_50px_rgba(255,90,18,0.18)] transition hover:-translate-y-0.5 hover:bg-[#ff6a27]"
              >
                Começar grátis por 7 dias
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#produto"
                className="flex h-12 items-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-5 text-xs font-semibold text-stone-300 transition hover:bg-white/[0.055] hover:text-white"
              >
                Ver como funciona
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-stone-600">
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-500" /> 7 dias de teste</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-500" /> Sem cartão no trial</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-500" /> Cancele quando quiser</span>
            </div>
          </div>

          <div id="produto" className="relative mx-auto mt-16 max-w-[1240px] scroll-mt-28 sm:mt-20">
            <div className="pointer-events-none absolute inset-x-[12%] -bottom-16 h-40 bg-[#FF5A12]/[0.08] blur-[80px]" />
            <ProductPreview />
          </div>
        </section>

        <section id="recursos" className="scroll-mt-24 border-y border-white/[0.06] bg-[#090c10] px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <div className="max-w-[650px]">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A26]">DO MAPA AO PIPELINE</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Menos lista fria. Mais contexto para abordar.
              </h2>
              <p className="mt-4 text-sm leading-7 text-stone-500">
                A Scoutly concentra descoberta, qualificação e organização comercial em um fluxo
                pensado para quem precisa transformar negócios locais em oportunidades reais.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {featureCards.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-[24px] border border-white/[0.08] bg-[#0e1216] p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] text-[#FF6A26]">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-6 text-[15px] font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-stone-500">{copy}</p>
                </article>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <article className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0e1216] p-7 sm:p-8">
                <div className="absolute right-[-6rem] top-[-6rem] h-56 w-56 rounded-full bg-[#FF5A12]/[0.08] blur-[70px]" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-[#FF6A26]">
                    <Bot className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.13em]">Scoutly AI</span>
                  </div>
                  <h3 className="mt-5 max-w-lg text-2xl font-semibold tracking-[-0.035em]">
                    Uma IA que aprende com os sinais da sua prospecção.
                  </h3>
                  <p className="mt-3 max-w-xl text-xs leading-6 text-stone-500">
                    Buscas, favoritos, pipeline e interações ajudam a Scoutly a recomendar negócios
                    e sugerir próximos passos com mais contexto para cada usuário.
                  </p>
                  <div className="mt-7 grid gap-2 sm:grid-cols-2">
                    {[
                      'Encontre empresas parecidas com meus favoritos',
                      'Quais oportunidades combinam com meu pipeline?',
                      'Ache negócios sem site nesta região',
                      'Monte uma abordagem para este prospect',
                    ].map((prompt) => (
                      <div key={prompt} className="rounded-xl border border-white/[0.07] bg-black/[0.14] px-3 py-2.5 text-[10px] text-stone-400">
                        “{prompt}”
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] border border-white/[0.08] bg-[#0e1216] p-7 sm:p-8">
                <MapPin className="h-5 w-5 text-[#FF6A26]" />
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">Procure. Salve. Vá até lá.</h3>
                <p className="mt-3 text-xs leading-6 text-stone-500">
                  Monte uma rota de visitas a partir dos negócios encontrados e abra o trajeto no Google Maps.
                </p>
                <div className="mt-8 space-y-3">
                  {['1. Encontre a região', '2. Selecione os negócios', '3. Abra sua rota'].map((step, index) => (
                    <div key={step} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                      <CircleDot className={`h-3.5 w-3.5 ${index === 2 ? 'text-[#FF6A26]' : 'text-stone-700'}`} />
                      <span className="text-[10px] font-medium text-stone-400">{step}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="px-5 py-24 lg:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A26]">FEITA PARA PROSPECÇÃO</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Para quem precisa descobrir clientes antes de vender.
              </h2>
              <p className="mt-4 text-sm leading-7 text-stone-500">
                Use a Scoutly para transformar território, categoria e sinais digitais em uma fila clara de oportunidades.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {useCases.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#0e1216] px-4 py-4">
                  <Zap className="h-4 w-4 shrink-0 text-[#FF6A26]" />
                  <span className="text-[11px] font-medium text-stone-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="precos" className="scroll-mt-24 border-y border-white/[0.06] bg-[#090c10] px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-[1100px]">
            <div className="mx-auto max-w-[650px] text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A26]">PLANOS</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Comece pequeno. Escale quando fizer sentido.
              </h2>
              <p className="mt-4 text-sm leading-7 text-stone-500">
                Todos começam com 7 dias de teste Pro para conhecer o fluxo completo.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <PlanCard
                name="Go"
                price={SCOUTLY_PLANS.go.monthlyPrice}
                description="Para começar a prospectar por conta própria."
                features={[
                  'Mapa e busca de empresas',
                  `Até ${SCOUTLY_PLANS.go.monthlyAnalysisLimit} análises/mês`,
                  'Favoritos e pipeline',
                  `Até ${SCOUTLY_PLANS.go.monthlyAiMessageLimit} mensagens com IA`,
                ]}
                onStart={onStart}
              />
              <PlanCard
                name="Pro"
                price={SCOUTLY_PLANS.pro.monthlyPrice}
                description="Para quem usa prospecção como rotina de crescimento."
                features={[
                  'Filtros avançados',
                  'Enriquecimento e sinais digitais',
                  'Scoutly AI',
                  'Exportação e recomendações',
                ]}
                featured
                onStart={onStart}
              />
              <PlanCard
                name="Agency"
                price={SCOUTLY_PLANS.agency.monthlyPrice}
                description="Para equipes que precisam operar juntas."
                features={[
                  'Tudo do Pro',
                  '5 usuários incluídos',
                  'Workspace para equipe',
                  'Maior capacidade de operação',
                ]}
                onStart={onStart}
              />
            </div>
          </div>
        </section>

        <section className="px-5 py-24 lg:px-8">
          <div className="relative mx-auto max-w-[1080px] overflow-hidden rounded-[32px] border border-[#FF5A12]/20 bg-[#101317] px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute left-1/2 top-[-8rem] h-80 w-80 -translate-x-1/2 rounded-full bg-[#FF5A12]/[0.12] blur-[90px]" />
            <div className="relative">
              <MessageCircle className="mx-auto h-6 w-6 text-[#FF6A26]" />
              <h2 className="mx-auto mt-5 max-w-[720px] text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                Sua próxima oportunidade provavelmente já está no mapa.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-stone-500">
                Pare de montar listas no escuro. Descubra negócios, contexto e próximos passos em um único fluxo.
              </p>
              <button
                type="button"
                onClick={onStart}
                className="mt-7 inline-flex h-12 items-center gap-2 rounded-2xl bg-[#FF5A12] px-5 text-xs font-semibold text-white transition hover:bg-[#ff6a27]"
              >
                Começar grátis
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-5 sm:flex-row">
          <img src="/logo_white.png" alt="Scoutly" className="h-8 w-auto object-contain opacity-90" />
          <div className="flex items-center gap-5 text-[10px] text-stone-600">
            <a href="#produto" className="hover:text-stone-300">Produto</a>
            <a href="#precos" className="hover:text-stone-300">Preços</a>
            <button type="button" onClick={onLogin} className="hover:text-stone-300">Entrar</button>
          </div>
          <span className="text-[9px] text-stone-700">© {new Date().getFullYear()} Scoutly</span>
        </div>
      </footer>
    </div>
  );
}
