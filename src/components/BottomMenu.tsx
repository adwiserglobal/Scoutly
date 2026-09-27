import { memo, useCallback, useEffect, useState } from 'react';
import { Coins, Columns3, HelpCircle, Home, Menu, Settings, Star, X } from 'lucide-react';
import { NavigationTab } from '../types';
import { useAuth } from '../context/AuthContext';
import { CreditAccessStatus, fetchAccessStatus } from '../services/api';
import SupportCenterPage from './SupportCenterPage';

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
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopHovered, setDesktopHovered] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [access, setAccess] = useState<CreditAccessStatus | null>(null);
  const desktopExpanded = currentTab !== 'INICIO' || desktopHovered;

  const refreshAccess = useCallback(async () => {
    if (!user) return;
    try {
      setAccess(await fetchAccessStatus());
    } catch (error) {
      console.warn('[Scoutly Sidebar Credits] Could not refresh balance:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      setAccess(null);
      return;
    }

    void refreshAccess();

    const onAccess = (event: Event) => {
      const detail = (event as CustomEvent<CreditAccessStatus>).detail;
      if (detail?.plan) setAccess(detail);
      else void refreshAccess();
    };
    const onFocus = () => void refreshAccess();

    window.addEventListener('scoutly-access-updated', onAccess);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('scoutly-access-updated', onAccess);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.uid, refreshAccess]);

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
  ];

  const navigate = (tab: NavigationTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const openPlans = () => {
    setMobileOpen(false);
    window.dispatchEvent(new CustomEvent('scoutly-open-plans'));
  };

  const lowCreditRemaining = access && !access.isUnlimited
    ? access.plan === 'free'
      ? (access.dailyRemaining ?? access.remaining)
      : (access.remaining ?? access.monthlyRemaining)
    : null;
  const showLowCredit = lowCreditRemaining !== null && lowCreditRemaining <= 2;

  const renderLowCredit = (expanded: boolean) => {
    if (!showLowCredit || lowCreditRemaining === null || !access) return null;

    const remaining = Math.max(0, lowCreditRemaining);
    const limit = access.plan === 'free'
      ? (access.dailyLimit ?? 5)
      : (access.monthlyLimit ?? 80);
    const rawProgress = limit > 0 ? (remaining / limit) * 100 : 0;
    const progress = remaining > 0 ? Math.max(7, Math.min(100, rawProgress)) : 0;
    const label = `${remaining} ${remaining === 1 ? 'Crédito restante' : 'Créditos restantes'}`;

    if (!expanded) {
      return (
        <button
          type="button"
          onClick={openPlans}
          title={`${label}. Faça o Upgrade para ter mais créditos.`}
          className="group relative mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FF6A26]/35 bg-[#FF5A12]/[0.08] text-[#FF7A3D] shadow-[0_10px_28px_rgba(0,0,0,0.25)] transition hover:border-[#FF6A26]/65 hover:bg-[#FF5A12]/[0.13]"
        >
          <Coins className="h-[17px] w-[17px]" />
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#0d0f12] bg-[#FF5A12] px-1 text-[9px] font-bold text-white shadow-[0_3px_10px_rgba(255,90,18,0.28)]">
            {remaining}
          </span>
        </button>
      );
    }

    return (
      <div className="mb-3 overflow-hidden rounded-2xl border border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-3 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[#FF6A26]/25 bg-[#FF5A12]/[0.10] text-[#FF7A3D]">
            <Coins className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] font-semibold tracking-[-0.01em] text-white">{label}</span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-white/90 shadow-[0_0_9px_rgba(255,255,255,0.24)] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-2.5 text-[9px] leading-[1.45] text-stone-500">
          Faça o Upgrade para ter mais créditos.
        </p>

        <button
          type="button"
          onClick={openPlans}
          className="mt-3 flex h-8 w-full items-center justify-center rounded-xl bg-[linear-gradient(100deg,#FF4D00_0%,#FF6A26_52%,#FF8A3D_100%)] text-[10px] font-semibold text-white shadow-[0_7px_20px_rgba(255,90,18,0.22)] transition hover:brightness-110 active:scale-[0.98]"
        >
          Upgrade
        </button>
      </div>
    );
  };

  const renderSettings = (expanded: boolean) => {
    const isActive = currentTab === 'CONFIGURACOES';
    return (
      <button
        type="button"
        onClick={() => navigate('CONFIGURACOES')}
        title={!expanded ? 'Configurações' : undefined}
        className={`group relative flex h-12 w-full items-center rounded-xl transition-all duration-200 ${
          expanded ? 'gap-3 px-3' : 'justify-center px-0'
        } ${
          isActive
            ? 'bg-white/[0.075] text-white shadow-[inset_2px_0_0_#FF5A12]'
            : 'text-stone-400 hover:bg-white/[0.045] hover:text-white'
        }`}
      >
        <Settings className={`h-[18px] w-[18px] shrink-0 transition ${
          isActive ? 'text-[#FF5A12]' : 'text-stone-500 group-hover:text-stone-300'
        }`} />
        {expanded && <span className="text-[12px] font-medium">Configurações</span>}
      </button>
    );
  };

  const renderHelp = (expanded: boolean) => (
    <button
      type="button"
      onClick={() => {
        setSupportOpen(true);
        setMobileOpen(false);
      }}
      title={!expanded ? 'Ajuda e suporte' : undefined}
      className={`group relative flex h-12 w-full items-center rounded-xl text-stone-400 transition-all duration-200 hover:bg-white/[0.045] hover:text-white ${
        expanded ? 'gap-3 px-3' : 'justify-center px-0'
      }`}
    >
      <HelpCircle className="h-[18px] w-[18px] shrink-0 text-stone-500 transition group-hover:text-[#FF6A26]" />
      {expanded && (
        <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium">Ajuda</span>
      )}
    </button>
  );

  const renderNavigation = (expanded: boolean) => (
    <nav className="flex flex-col gap-1.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            title={!expanded ? item.label : undefined}
            className={`group relative flex h-12 w-full items-center rounded-xl transition-all duration-200 ${
              expanded ? 'gap-3 px-3' : 'justify-center px-0'
            } ${
              isActive
                ? 'bg-white/[0.075] text-white shadow-[inset_2px_0_0_#FF5A12]'
                : 'text-stone-400 hover:bg-white/[0.045] hover:text-white'
            }`}
          >
            <Icon className={`h-[18px] w-[18px] shrink-0 transition ${
              isActive ? 'text-[#FF5A12]' : 'text-stone-500 group-hover:text-stone-300'
            }`} />

            {expanded && (
              <>
                <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium">
                  {item.label}
                </span>
                {item.badge !== null && item.badge !== undefined && (
                  <span className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                    isActive ? 'bg-[#FF5A12] text-white' : 'bg-white/[0.08] text-stone-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </>
            )}

            {!expanded && item.badge !== null && item.badge !== undefined && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5A12] px-1 text-[8px] font-bold text-white">
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
      <aside
        onMouseEnter={() => setDesktopHovered(true)}
        onMouseLeave={() => setDesktopHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/[0.08] bg-[#0d0f12]/[0.97] py-5 shadow-[18px_0_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex ${
          desktopExpanded ? 'w-[190px] px-3' : 'w-[72px] px-2'
        }`}
      >
        <div className={`mb-9 flex h-14 items-center ${
          desktopExpanded ? 'justify-start px-1' : 'justify-center'
        }`}>
          {desktopExpanded ? (
            <img
              src="/logo_white.png"
              alt="Scoutly"
              className="h-12 w-auto max-w-[164px] object-contain object-left"
            />
          ) : (
            <img
              src="/scoutly-mark.png"
              alt="Scoutly"
              className="h-8 w-8 object-contain"
            />
          )}
        </div>

        <div className="flex-1">{renderNavigation(desktopExpanded)}</div>

        {renderLowCredit(desktopExpanded)}

        <div className="space-y-1 border-t border-white/[0.08] pt-3">
          {renderHelp(desktopExpanded)}
          {renderSettings(desktopExpanded)}
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

            <div className="flex-1">{renderNavigation(true)}</div>

            {renderLowCredit(true)}

            <div className="space-y-1 border-t border-white/[0.08] pt-3">
              {renderHelp(true)}
              {renderSettings(true)}
            </div>
          </aside>
        </div>
      </div>

      <SupportCenterPage
        isOpen={supportOpen}
        onOpen={() => setSupportOpen(true)}
        onClose={() => setSupportOpen(false)}
      />
    </>
  );
}

export default memo(BottomMenu);
