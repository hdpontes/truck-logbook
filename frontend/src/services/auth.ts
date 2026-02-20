import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);  // ✅ Sem /api porque já está no baseURL
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
  }
};

export default authService;
