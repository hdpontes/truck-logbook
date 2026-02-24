import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/auth';
import { useToast } from '@/contexts/ToastContext';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

interface ForcePasswordChangeModalProps {
  onSuccess: () => void;
}

export default function ForcePasswordChangeModal({ onSuccess }: ForcePasswordChangeModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const toast = useToast();
  const { user, setAuth } = useAuthStore();

  const changePasswordMutation = useMutation({
    mutationFn: (newPassword: string) => authService.changeTemporaryPassword(newPassword),
    onSuccess: (data) => {
      toast.success(data.message);
      
      // Atualizar user no localStorage para remover flag de senha temporária
      if (user) {
        const updatedUser = { ...user, isTemporaryPassword: false };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setAuth(localStorage.getItem('token') || '', updatedUser);
      }
      
      // Limpar campos
      setNewPassword('');
      setConfirmPassword('');
      
      // Chamar callback de sucesso
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao alterar senha');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.warning('Preencha todos os campos');
      return;
    }

    if (newPassword.length < 4) {
      toast.warning('A nova senha deve ter pelo menos 4 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    changePasswordMutation.mutate(newPassword);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
        {/* Ícone de alerta */}
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-yellow-100 rounded-full">
            <AlertTriangle className="h-12 w-12 text-yellow-600" />
          </div>
        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Troca de Senha Obrigatória
        </h2>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          Você está usando uma senha temporária. Por segurança, é necessário criar uma nova senha antes de continuar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nova Senha */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Nova Senha *
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite sua nova senha"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Mínimo de 4 caracteres
            </p>
          </div>

          {/* Confirmar Nova Senha */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Nova Senha *
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirme sua nova senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Lock className="h-5 w-5" />
            {changePasswordMutation.isPending ? 'Alterando...' : 'Confirmar Nova Senha'}
          </button>
        </form>

        {/* Aviso */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Importante:</strong> Escolha uma senha segura. Você não poderá continuar sem alterar a senha temporária.
          </p>
        </div>
      </div>
    </div>
  );
}
