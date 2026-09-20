import { memo, useState } from 'react';
import { Columns3, Home, Menu, Settings, Star, X } from 'lucide-react';
import { NavigationTab } from '../types';

interface BottomMenuProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  savedLeadsCount: number;
  pipelineDealsCount: number;
}

function BottomMenu({
  currentTab,
  onTabChange,
  savedLeadsCount,
  pipelineDealsCount,
}: BottomMenuProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      id: 'INICIO' as NavigationTab,
      label: 'Início',
      icon: Home,
    },
    {
      id: 'FAVORITOS' as NavigationTab,
      label: 'Favoritos',
      icon: Star,
      badge: savedLeadsCount > 0 ? savedLeadsCount : null,
    },
    {
      id: 'PIPELINE' as NavigationTab,
      label: 'Pipeline',
      icon: Columns3,
      badge: pipelineDealsCount > 0 ? pipelineDealsCount : null,
    },
    {
      id: 'CONFIGURACOES' as NavigationTab,
      label: 'Configurações',
      icon: Settings,
    },
  ];

  const navigate = (tab: NavigationTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const navigation = (
    <nav className="flex flex-col gap-1.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            className={`group relative flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition-all duration-200 ${
              isActive
                ? 'bg-white/[0.075] text-white shadow-[inset_2px_0_0_#FF5A12]'
                : 'text-stone-400 hover:bg-white/[0.045] hover:text-white'
            }`}
          >
            <Icon className={`h-[18px] w-[18px] shrink-0 transition ${
              isActive ? 'text-[#FF5A12]' : 'text-stone-500 group-hover:text-stone-300'
            }`} />
            <span className="min-w-0 flex-1 text-[12px] font-medium">{item.label}</span>
            {item.badge !== null && item.badge !== undefined && (
              <span className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                isActive ? 'bg-[#FF5A12] text-white' : 'bg-white/[0.08] text-stone-400'
              }`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[172px] flex-col border-r border-white/[0.08] bg-[#0d0f12]/[0.96] px-3 py-5 shadow-[18px_0_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl lg:flex">
        <div className="mb-10 px-2">
          <img
            src="/logo_white.png"
            alt="Scoutly"
            className="h-10 w-auto max-w-[132px] object-contain object-left"
          />
        </div>

        <div className="flex-1">{navigation}</div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
          <div className="mb-2 h-1.5 w-1.5 rounded-full bg-[#FF5A12] shadow-[0_0_10px_rgba(255,90,18,0.7)]" />
          <p className="text-[10px] font-medium leading-relaxed text-stone-400">
            Prospecção local em tempo real
          </p>
        </div>
      </aside>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-50 flex h-[44px] w-[44px] items-center justify-center rounded-2xl border border-white/10 bg-[#111418]/[0.94] text-white shadow-[0_12px_36px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
          aria-label="Abrir menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <div
          className={`fixed inset-0 z-[90] transition ${
            mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          aria-hidden={!mobileOpen}
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
            className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 ${
              mobileOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <aside className={`absolute inset-y-0 left-0 flex w-[286px] max-w-[84vw] flex-col border-r border-white/10 bg-[#0d0f12]/[0.98] px-4 py-5 shadow-[24px_0_70px_rgba(0,0,0,0.48)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="mb-9 flex items-center justify-between gap-4 px-1">
              <img
                src="/logo_white.png"
                alt="Scoutly"
                className="h-10 w-auto max-w-[136px] object-contain object-left"
              />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-stone-300"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1">{navigation}</div>

            <p className="px-2 text-[10px] leading-relaxed text-stone-600">
              Scoutly
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}

export default memo(BottomMenu);
