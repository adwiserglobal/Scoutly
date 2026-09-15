import { memo } from 'react';
import {
  Compass,
  Star,
  Columns3,
  Settings,
  Sparkles,
  ChevronRight,
  Database,
  Layers,
  LogOut,
} from 'lucide-react';
import { NavigationTab } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  savedLeadsCount: number;
  pipelineDealsCount: number;
  onOpenAIChat: () => void;
  onLogout?: () => void;
}

function Sidebar({
  currentTab,
  onTabChange,
  savedLeadsCount,
  pipelineDealsCount,
  onOpenAIChat,
  onLogout,
}: SidebarProps) {
  const navItems = [
    {
      id: 'INICIO' as NavigationTab,
      label: 'Início',
      icon: Compass,
      description: 'Radar de Prospecção',
    },
    {
      id: 'FAVORITOS' as NavigationTab,
      label: 'Favoritos',
      icon: Star,
      description: 'Leads Salvos',
      badge: savedLeadsCount > 0 ? savedLeadsCount : null,
    },
    {
      id: 'PIPELINE' as NavigationTab,
      label: 'Pipeline',
      icon: Columns3,
      description: 'Funil Comercial',
      badge: pipelineDealsCount > 0 ? pipelineDealsCount : null,
    },
    {
      id: 'CONFIGURACOES' as NavigationTab,
      label: 'Configurações',
      icon: Settings,
      description: 'Preferências & Dados',
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia, Usuário';
    if (hour >= 12 && hour < 18) return 'Boa tarde, Usuário';
    return 'Boa noite, Usuário';
  };

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#FAF7F2] border-r border-[#EDE8E0] shrink-0 h-screen sticky top-0 z-30 justify-between select-none">
        <div className="flex flex-col pt-16 lg:pt-20">
          {/* Navigation Links */}
          <nav className="p-3 space-y-2">
            <span className="px-3 text-[11px] font-bold text-stone-500 block mb-1">
              {getGreeting()}
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer group text-left ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-700 hover:bg-white hover:text-stone-900 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-xl transition ${
                        isActive
                          ? 'bg-white/10 text-[#FF4D00]'
                          : 'bg-stone-100 text-stone-500 group-hover:text-stone-900 group-hover:bg-stone-200/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="leading-none">{item.label}</div>
                      <div
                        className={`text-[10px] font-normal mt-0.5 ${
                          isActive ? 'text-stone-300' : 'text-stone-400'
                        }`}
                      >
                        {item.description}
                      </div>
                    </div>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
                        isActive
                          ? 'bg-[#FF4D00] text-white'
                          : 'bg-stone-200 text-stone-700 group-hover:bg-stone-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Logout */}
        <div className="p-3 border-t border-[#EDE8E0]">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer group"
          >
            <div className="p-1.5 rounded-xl bg-red-100 text-red-600 group-hover:bg-red-200 transition">
              <LogOut className="w-4 h-4" />
            </div>
            <span>Encerrar Sessão</span>
          </button>
        </div>

      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EDE8E0] px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer relative ${
                isActive ? 'text-[#FF4D00]' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-[#FF4D00] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default memo(Sidebar);
