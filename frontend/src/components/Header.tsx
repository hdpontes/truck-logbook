import { useAuthStore } from '@/store/auth';
import { Bell, User } from 'lucide-react';

export default function Header() {
  const { user } = useAuthStore();

  return (
    <header className="bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Bem-vindo, {user?.name}!
          </h2>
          <p className="text-sm text-gray-600">
            Gerencie sua frota de forma eficiente
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-lg">
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
