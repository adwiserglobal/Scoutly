import { memo } from 'react';
import {
  Compass,
  Star,
  Columns3,
  Settings,
} from 'lucide-react';
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
  const navItems = [
    {
      id: 'INICIO' as NavigationTab,
      label: 'Início',
      icon: Compass,
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
      label: 'Config.',
      icon: Settings,
    },
  ];

  return (
    <div className="fixed bottom-[52px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-stone-900/60 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`relative flex items-center justify-center px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 overflow-hidden group cursor-pointer ${
              isActive
                ? 'text-white'
                : 'text-stone-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {isActive && (
              <div className="absolute inset-0 bg-[#FF4D00] rounded-full shadow-inner" />
            )}
            
            <div className="relative z-10 flex items-center gap-2">
              <Icon className={`w-4 h-4 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`} />
              <span className="hidden sm:inline-block">{item.label}</span>
            </div>

            {item.badge !== null && item.badge !== undefined && (
              <span
                className={`absolute top-0 right-0 sm:static sm:ml-1.5 -mt-1 sm:mt-0 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-black relative z-10 shadow-xs ${
                  isActive
                    ? 'bg-white text-[#FF4D00]'
                    : 'bg-[#FF4D00] text-white'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default memo(BottomMenu);
