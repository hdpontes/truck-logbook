import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ForcePasswordChangeModal from './ForcePasswordChangeModal';
import { useAuthStore } from '@/store/auth';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuthStore();
  const [showPasswordModal, setShowPasswordModal] = useState(user?.isTemporaryPassword || false);

  const handlePasswordChangeSuccess = () => {
    setShowPasswordModal(false);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Modal de Troca de Senha Obrigatória */}
      {showPasswordModal && user?.isTemporaryPassword && (
        <ForcePasswordChangeModal onSuccess={handlePasswordChangeSuccess} />
      )}

      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
