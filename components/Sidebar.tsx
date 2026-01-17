import React from 'react';
import { LayoutDashboard, Building2, CalendarDays, PieChart, MessageSquare, Settings, LogOut } from 'lucide-react';

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
      menuItems.push({ id: 'settings', label: 'Config', icon: Settings });
  }

  return (
    <>
      {/* DESKTOP SIDEBAR (Left) */}
      <div className="hidden lg:flex w-64 bg-white flex-col justify-between h-full border-r border-slate-200">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-slate-100">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-primary-200">
              OB
            </div>
            <span className="font-bold text-xl text-slate-800">Odihna Balance</span>
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
                      ? 'bg-primary-50 text-primary-700 font-medium translate-x-1' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {isAdmin && (
          <div className="p-4 border-t border-slate-100">
              <button
              onClick={toggleChat}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
              >
              <MessageSquare size={20} />
              <span className="font-medium">Asistente AI</span>
              </button>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION (Bottom) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
            {menuItems.slice(0, 5).map((item) => { // Limit items on mobile if needed
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                            isActive ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <div className={`p-1.5 rounded-full transition-all ${isActive ? 'bg-primary-50' : 'bg-transparent'}`}>
                            <Icon size={20} className={isActive ? 'fill-current' : ''} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                );
            })}
            {isAdmin && (
                <button 
                    onClick={toggleChat}
                    className="flex flex-col items-center justify-center w-full h-full gap-1 text-purple-600"
                >
                    <div className="p-1.5 rounded-full bg-purple-50">
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
