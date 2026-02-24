import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useToast } from '@/contexts/ToastContext';
import { LogIn, X } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { settings, fetchSettings } = useSettingsStore();
  const toast = useToast();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState('');

  useEffect(() => {
    // Buscar settings apenas uma vez ao montar o componente
    fetchSettings().catch(err => {
      console.error('Failed to load settings:', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependencia vazia - executa apenas uma vez

  useEffect(() => {
    setLogoError(false);
  }, [settings?.companyLogo]);

  const loginMutation = useMutation({
    mutationFn: (credentials: { login: string; password: string }) =>
      authService.login(credentials),
    onSuccess: (data) => {
      console.log('✅ Login successful:', data);
      setAuth(data.token, data.user);
      navigate('/');
    },
    onError: (error: any) => {
      console.error('❌ Login error:', error);
      toast.error('Erro ao fazer login. Verifique suas credenciais.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) {
      toast.warning('Preencha todos os campos');
      return;
    }
    loginMutation.mutate({ login, password });
  };

  const forgotPasswordMutation = useMutation({
    mutationFn: (identifier: string) => authService.forgotPassword(identifier),
    onSuccess: (data) => {
      toast.success(data.message);
      setShowForgotPassword(false);
      setForgotPasswordIdentifier('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao processar solicitação');
    },
  });

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordIdentifier) {
      toast.warning('Digite seu login ou email');
      return;
    }
    forgotPasswordMutation.mutate(forgotPasswordIdentifier);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          {settings?.companyLogo && !logoError ? (
            <img 
              src={settings.companyLogo} 
              alt={settings.companyName || 'Logo'} 
              className="mx-auto h-12 w-auto max-w-[120px] object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <LogIn className="mx-auto h-12 w-12 text-blue-600" />
          )}
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {settings?.companyName || 'Truck Logbook'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Faça login para continuar
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="login" className="sr-only">
                Usuário
              </label>
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Usuário"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Esqueci minha senha
            </button>
          </div>
        </form>

        {/* Modal Esqueci Minha Senha */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Esqueci minha senha</h3>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordIdentifier('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Digite seu login ou email e o administrador entrará em contato via WhatsApp para ajudá-lo a recuperar sua senha.
              </p>

              <form onSubmit={handleForgotPassword}>
                <div className="mb-4">
                  <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
                    Login ou Email
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    value={forgotPasswordIdentifier}
                    onChange={(e) => setForgotPasswordIdentifier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Digite seu login ou email"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordIdentifier('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotPasswordMutation.isPending}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forgotPasswordMutation.isPending ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
