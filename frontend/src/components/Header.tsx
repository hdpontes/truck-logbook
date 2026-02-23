import { useAuthStore } from '@/store/auth';
import { Bell, User, Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="bg-white shadow-sm">
      <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="hidden md:block">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">
            Bem-vindo, {user?.name}!
          </h2>
          <p className="text-xs md:text-sm text-gray-600">
            Gerencie sua frota de forma eficiente
          </p>
        </div>

        {/* Mobile: Show only name */}
        <div className="md:hidden">
          <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <Bell className="w-5 h-5 md:w-6 md:h-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-lg">
            <User className="w-6 h-6 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-800">{user?.name}</p>
              <p className="text-xs text-gray-600">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
