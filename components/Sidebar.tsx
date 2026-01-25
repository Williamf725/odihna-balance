import React from 'react';
import { LayoutDashboard, Building2, CalendarDays, PieChart, MessageSquare, Settings, Wallet } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  toggleChat: () => void;
  isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, toggleChat, isAdmin }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'properties', label: 'Propiedades', icon: Building2 },
    { id: 'reservations', label: 'Reservas', icon: CalendarDays },
    { id: 'reports', label: 'Reportes', icon: PieChart },
  ];

  if (isAdmin) {
      menuItems.push({ id: 'payments', label: 'Pagos', icon: Wallet });
      menuItems.push({ id: 'settings', label: 'Config', icon: Settings });
  }

  return (
    <>
      {/* DESKTOP SIDEBAR (Left) */}
      <div className="hidden lg:flex w-64 bg-zinc-900 flex-col justify-between h-full border-r border-zinc-800">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-black font-bold shadow-md shadow-primary-500/20">
              OB
            </div>
            <span className="font-bold text-xl text-zinc-100">Odihna Balance</span>
          </div>
          
          <nav className="mt-6 flex flex-col gap-2 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-primary-500/10 text-primary-500 font-medium translate-x-1 border border-primary-500/20'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-primary-500' : 'text-zinc-500 group-hover:text-zinc-300'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {isAdmin && (
          <div className="p-4 border-t border-zinc-800">
              <button
              onClick={toggleChat}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 text-black p-3 rounded-xl shadow-lg hover:shadow-primary-500/20 transition-all hover:scale-105 active:scale-95 font-bold"
              >
              <MessageSquare size={20} />
              <span className="font-medium">Asistente AI</span>
              </button>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION (Bottom) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
        <div className="flex justify-around items-center h-16">
            {menuItems.slice(0, 5).map((item) => { // Limit items on mobile if needed
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                            isActive ? 'text-primary-500' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <div className={`p-1.5 rounded-full transition-all ${isActive ? 'bg-primary-500/10' : 'bg-transparent'}`}>
                            <Icon size={20} className={isActive ? 'fill-current' : ''} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                );
            })}
            {isAdmin && (
                <button 
                    onClick={toggleChat}
                    className="flex flex-col items-center justify-center w-full h-full gap-1 text-primary-500"
                >
                    <div className="p-1.5 rounded-full bg-primary-500/10">
                        <MessageSquare size={20} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-medium">AI</span>
                </button>
            )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
