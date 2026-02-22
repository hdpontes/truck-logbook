import { Link, useLocation } from 'react-router-dom';
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
  LogOut
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const getMenuItems = (userRole: string) => {
  const baseItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Truck, label: 'Caminhões', path: '/trucks' },
    { icon: RouteIcon, label: 'Viagens', path: '/trips' },
  ];

  // ADMIN vê tudo incluindo gestão
  if (userRole === 'ADMIN') {
    return [
      ...baseItems,
      { icon: Receipt, label: 'Despesas', path: '/expenses' },
      { icon: Wrench, label: 'Manutenção', path: '/maintenance' },
      { icon: Users, label: 'Motoristas', path: '/drivers' },
      { icon: UserCog, label: 'Usuários', path: '/users' },
      { icon: Building2, label: 'Clientes', path: '/clients' },
      { icon: MapPin, label: 'Localizações', path: '/locations' },
    ];
  }

  // MANAGER vê operacional mas não gestão de usuários
  if (userRole === 'MANAGER') {
    return [
      ...baseItems,
      { icon: Receipt, label: 'Despesas', path: '/expenses' },
      { icon: Wrench, label: 'Manutenção', path: '/maintenance' },
      { icon: Users, label: 'Motoristas', path: '/drivers' },
      { icon: Building2, label: 'Clientes', path: '/clients' },
      { icon: MapPin, label: 'Localizações', path: '/locations' },
    ];
  }

  // DRIVER vê apenas o básico
  return baseItems;
};

export default function Sidebar() {
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const menuItems = getMenuItems(user?.role || 'DRIVER');

  return (
    <aside className="w-64 bg-white shadow-lg">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Truck className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">Truck Logbook</h1>
        </div>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors',
                isActive && 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 w-64 p-6">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-2 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}
