import React from 'react';
import { 
  LayoutDashboard, Factory, Truck, Scale, MoreHorizontal 
} from 'lucide-react';
import { UserRole } from '../types';
import { canAccessMenu } from '../services/permissionService';

interface BottomNavProps {
  currentView: string;
  onNavigate?: (view: string) => void;
  onSelectView?: (view: string) => void;
  onOpenMore?: () => void;
  onOpenMobileMenu?: () => void;
  badgeCounts?: Record<string, number>;
  currentUserRole?: UserRole;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onNavigate,
  onSelectView,
  onOpenMore,
  onOpenMobileMenu,
  badgeCounts,
  currentUserRole,
}) => {
  const navigateFn = onSelectView || onNavigate || (() => {});
  const openMenuFn = onOpenMobileMenu || onOpenMore || (() => {});
  const primaryTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'produksi', label: 'Produksi', icon: Factory },
    { id: 'distribusi', label: 'Distribusi', icon: Truck },
    { id: 'keuangan', label: 'Keuangan', icon: Scale },
  ];

  const isTabActive = (id: string) => {
    if (currentView === id) return true;
    if (id === 'produksi' && (currentView === 'production' || currentView === 'produksi')) return true;
    if (id === 'distribusi' && (currentView === 'distribution' || currentView === 'distribusi')) return true;
    if (id === 'keuangan' && (currentView === 'finance' || currentView === 'keuangan')) return true;
    return false;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around safe-area-bottom">
      {primaryTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = isTabActive(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => navigateFn(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isActive
                ? 'text-blue-400 font-semibold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}

      <button
        onClick={openMenuFn}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
      >
        <MoreHorizontal className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Menu</span>
      </button>
    </nav>
  );
};
