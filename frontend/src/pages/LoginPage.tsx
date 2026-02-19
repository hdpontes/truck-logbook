import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Truck, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => authAPI.login(email, password),
    onSuccess: (response) => {
      const { token, user } = response.data;
      login(token, user);
      navigate('/');
    },
    onError: () => {
      alert('Erro ao fazer login. Verifique suas credenciais.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Truck className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Truck Logbook</h1>
          <p className="text-gray-600 mt-2">Sistema de Gestão de Frotas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 mb-3">👤 Tipos de Usuário:</p>
          <div className="space-y-2 text-xs text-blue-800">
            <div>
              <p className="font-semibold">🔐 Administrador</p>
              <p className="text-blue-700">• Pode agendar e gerenciar corridas</p>
              <p className="text-blue-700">• Define valores e lucros</p>
              <p className="text-blue-700">• Adiciona todos os tipos de despesas</p>
              <p className="text-blue-700">• Gerencia motoristas</p>
            </div>
            <div className="mt-3">
              <p className="font-semibold">🚛 Motorista</p>
              <p className="text-blue-700">• Inicia e finaliza corridas</p>
              <p className="text-blue-700">• Registra abastecimento</p>
              <p className="text-blue-700">• Visualiza informações das viagens</p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600 border-t pt-4">
          <p className="font-semibold mb-2">Credenciais de Demonstração:</p>
          <p>Admin: admin@example.com / admin123</p>
          <p>Motorista: (criar na área administrativa)</p>
        </div>
      </div>
    </div>
  );
}
