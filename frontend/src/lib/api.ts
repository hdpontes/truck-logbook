import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Drivers
export const driversAPI = {
  getAll: () => api.get('/drivers'),
  getById: (id: string) => api.get(`/drivers/${id}`),
  create: (data: any) => api.post('/drivers', data),
  update: (id: string, data: any) => api.put(`/drivers/${id}`, data),
  delete: (id: string) => api.delete(`/drivers/${id}`),
};

// Trucks
export const trucksAPI = {
  getAll: () => api.get('/trucks'),
  getById: (id: string) => api.get(`/trucks/${id}`),
  create: (data: any) => api.post('/trucks', data),
  update: (id: string, data: any) => api.put(`/trucks/${id}`, data),
  delete: (id: string) => api.delete(`/trucks/${id}`),
  getStats: (id: string) => api.get(`/trucks/${id}/stats`),
};
  start: (id: string) => api.post(`/trips/${id}/start`),
  finish: (id: string) => api.post(`/trips/${id}/finish`),

// Trips
export const tripsAPI = {
  getAll: (params?: any) => api.get('/trips', { params }),
  getById: (id: string) => api.get(`/trips/${id}`),
  create: (data: any) => api.post('/trips', data),
  update: (id: string, data: any) => api.put(`/trips/${id}`, data),
  delete: (id: string) => api.delete(`/trips/${id}`),
  calculate: (id: string) => api.post(`/trips/${id}/calculate`),
};

// Expenses
export const expensesAPI = {
  getAll: (params?: any) => api.get('/expenses', { params }),
  getById: (id: string) => api.get(`/expenses/${id}`),
  create: (data: any) => api.post('/expenses', data),
  update: (id: string, data: any) => api.put(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  getSummary: (params?: any) => api.get('/expenses/summary/total', { params }),
};

// Maintenance
export const maintenanceAPI = {
  getAll: (params?: any) => api.get('/maintenance', { params }),
  getById: (id: string) => api.get(`/maintenance/${id}`),
  create: (data: any) => api.post('/maintenance', data),
  update: (id: string, data: any) => api.put(`/maintenance/${id}`, data),
  delete: (id: string) => api.delete(`/maintenance/${id}`),
  getUpcoming: () => api.get('/maintenance/upcoming/all'),
};

// Dashboard
export const dashboardAPI = {
  getOverview: (params?: any) => api.get('/dashboard/overview', { params }),
  getTruckPerformance: (params?: any) => api.get('/dashboard/trucks/performance', { params }),
  getRecentActivities: () => api.get('/dashboard/activities/recent'),
  getFinancialSummary: (params?: any) => api.get('/dashboard/financial/summary', { params }),
};
