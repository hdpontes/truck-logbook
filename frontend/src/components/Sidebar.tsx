import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settings';
import { 
  LayoutDashboard, 
  Truck, 
  Route as RouteIcon, 
  Receipt, 
  Wrench,
  Users,
  UserCog,
  Building2,
  MapPin,
  LogOut,
  Clock,
  X,
  FileText,
  CreditCard,
  DollarSign,
  ChevronDown,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface SubMenuItem {
  icon: any;
  label: string;
  path: string;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  submenu?: SubMenuItem[];
}

const getMenuItems = (userRole: string): MenuItem[] => {
  // DRIVER vê apenas Viagens
  if (userRole === 'DRIVER') {
    return [
      { icon: RouteIcon, label: 'Viagens', path: '/trips' },
    ];
  }

  // ADMIN vê tudo incluindo gestão
  if (userRole === 'ADMIN') {
    return [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: RouteIcon, label: 'Viagens', path: '/trips' },
      { icon: Truck, label: 'Caminhões', path: '/trucks' },
      { icon: Truck, label: 'Carretas', path: '/trailers' },
      { icon: Receipt, label: 'Despesas', path: '/expenses-calendar' },
      { icon: Wrench, label: 'Manutenção', path: '/maintenance' },
      { icon: Users, label: 'Motoristas', path: '/drivers' },
      { icon: Building2, label: 'Clientes', path: '/clients' },
      { icon: MapPin, label: 'Localizações', path: '/locations' },
      { 
        icon: FileText, 
        label: 'Relatórios', 
        path: '/reports',
        submenu: [
          { icon: FileText, label: 'Relatório Financeiro', path: '/reports' },
          { icon: BarChart3, label: 'Análise Financeira', path: '/expenses-analysis' },
        ]
      },
      { icon: DollarSign, label: 'Recebimentos', path: '/receivables' },
      { icon: CreditCard, label: 'Cobranças', path: '/billing' },
      { icon: UserCog, label: 'Usuários', path: '/users' },
    ];
  }

  // MANAGER vê operacional mas não gestão de usuários
  if (userRole === 'MANAGER') {
    return [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: RouteIcon, label: 'Viagens', path: '/trips' },
      { icon: Truck, label: 'Caminhões', path: '/trucks' },
      { icon: Truck, label: 'Carretas', path: '/trailers' },
      { icon: Receipt, label: 'Despesas', path: '/expenses-calendar' },
      { icon: Wrench, label: 'Manutenção', path: '/maintenance' },
      { icon: Users, label: 'Motoristas', path: '/drivers' },
      { icon: Building2, label: 'Clientes', path: '/clients' },
      { icon: MapPin, label: 'Localizações', path: '/locations' },
      { 
        icon: FileText, 
        label: 'Relatórios', 
        path: '/reports',
        submenu: [
          { icon: FileText, label: 'Relatório Financeiro', path: '/reports' },
          { icon: BarChart3, label: 'Análise Financeira', path: '/expenses-analysis' },
        ]
      },
      { icon: DollarSign, label: 'Recebimentos', path: '/receivables' },
      { icon: CreditCard, label: 'Cobranças', path: '/billing' },
      { icon: UserCog, label: 'Usuários', path: '/users' },
    ];
  }

  // Default - não deveria chegar aqui
  return [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: RouteIcon, label: 'Viagens', path: '/trips' },
  ];
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const { settings } = useSettingsStore();
  const menuItems = getMenuItems(user?.role || 'DRIVER');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [logoError, setLogoError] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Resetar erro de logo quando as settings mudarem
  useEffect(() => {
    setLogoError(false);
  }, [settings?.companyLogo]);

  const formatDateTime = () => {
    const brasilia = new Date(currentTime.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const date = brasilia.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = brasilia.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return { date, time };
  };

  const { date, time } = formatDateTime();

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  // Auto-expand menu if current path matches submenu item
  useEffect(() => {
    menuItems.forEach(item => {
      if (item.submenu) {
        const hasActiveSubmenu = item.submenu.some(sub => location.pathname === sub.path);
        if (hasActiveSubmenu && !expandedMenus.includes(item.label)) {
          setExpandedMenus(prev => [...prev, item.label]);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="p-4 md:p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings?.companyLogo && !logoError ? (
              <img 
                src={settings.companyLogo} 
                alt={settings.companyName || 'Logo'} 
                className="h-6 md:h-8 w-auto max-w-[32px] object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Truck className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            )}
            <h1 className="text-lg md:text-xl font-bold text-gray-800">
              {settings?.companyName || 'Truck Logbook'}
            </h1>
          </div>
          
          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="mt-2 md:mt-6 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isExpanded = expandedMenus.includes(item.label);
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const hasActiveSubmenu = item.submenu?.some(sub => location.pathname === sub.path);
            
            return (
              <div key={item.path}>
                {hasSubmenu ? (
                  <>
                    {/* Menu item with submenu */}
                    <button
                      onClick={() => toggleMenu(item.label)}
                      className={cn(
                        'flex items-center justify-between w-full gap-3 px-4 md:px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors',
                        (isActive || hasActiveSubmenu) && 'bg-blue-50 text-blue-600'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    
                    {/* Submenu items */}
                    {isExpanded && item.submenu && (
                      <div className="bg-gray-50">
                        {item.submenu.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = location.pathname === subItem.path;
                          
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              onClick={handleLinkClick}
                              className={cn(
                                'flex items-center gap-3 pl-12 md:pl-14 pr-4 md:pr-6 py-2.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors',
                                isSubActive && 'bg-blue-100 text-blue-600 font-medium border-r-4 border-blue-600'
                              )}
                            >
                              <SubIcon className="w-4 h-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  /* Regular menu item without submenu */
                  <Link
                    to={item.path}
                    onClick={handleLinkClick}
                    className={cn(
                      'flex items-center gap-3 px-4 md:px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors',
                      isActive && 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 md:p-6 space-y-3 md:space-y-4 border-t">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold">Horário de Brasília</span>
            </div>
            <div className="text-gray-800 font-mono">
              <div className="text-xs md:text-sm font-medium">{date}</div>
              <div className="text-base md:text-lg font-bold">{time}</div>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              if (onClose) onClose();
            }}
            className="flex items-center gap-3 w-full px-4 py-2 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
