import api from './api';

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface User {
  id: string;
  login: string;
  email: string;
  name: string;
  role: string;
  isTemporaryPassword?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    console.log('🔐 Attempting login:', credentials.login);
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    console.log('✅ Login response:', data);
    
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', userData);
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  async me(): Promise<{ user: User }> {
    const { data } = await api.get<{ user: User }>('/auth/me');
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  getUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  async forgotPassword(identifier: string): Promise<{ message: string; success: boolean }> {
    const { data } = await api.post('/auth/forgot-password', { identifier });
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string; success: boolean }> {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
    return data;
  },

  async changeTemporaryPassword(newPassword: string): Promise<{ message: string; success: boolean }> {
    const { data } = await api.post('/auth/change-temporary-password', { newPassword });
    return data;
  }
};

export default authService;
