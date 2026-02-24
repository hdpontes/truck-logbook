import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  login: string;
  email: string;
  name: string;
  role: string;
  isTemporaryPassword?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => {
        console.log('✅ Setting auth:', { token, user });
        set({ token, user, isAuthenticated: true });
      },
      logout: () => {
        console.log('🚪 Logging out');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
