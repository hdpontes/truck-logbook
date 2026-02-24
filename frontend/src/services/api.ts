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
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Trucks API
export const trucksAPI = {
  getAll: () => api.get('/trucks').then(res => res.data),
  getById: (id: string) => api.get(`/trucks/${id}`).then(res => res.data),
  create: (data: any) => api.post('/trucks', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/trucks/${id}`, data).then(res => res.data),
  updateStatus: (id: string, status: string) => api.patch(`/trucks/${id}/status`, { status }).then(res => res.data),
  delete: (id: string) => api.delete(`/trucks/${id}`).then(res => res.data),
};

// Trailers API
export const trailersAPI = {
  getAll: () => api.get('/trailers').then(res => res.data),
  getById: (id: string) => api.get(`/trailers/${id}`).then(res => res.data),
  create: (data: any) => api.post('/trailers', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/trailers/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/trailers/${id}`).then(res => res.data),
};

// Trips API
export const tripsAPI = {
  getAll: (params?: any) => api.get('/trips', { params }).then(res => res.data),
  getById: (id: string) => api.get(`/trips/${id}`).then(res => res.data),
  getByTruck: (truckId: string) => api.get(`/trips/truck/${truckId}`).then(res => res.data),
  create: (data: any) => api.post('/trips', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/trips/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/trips/${id}`).then(res => res.data),
  start: (id: string) => api.post(`/trips/${id}/start`).then(res => res.data),
  finish: (id: string, data?: any) => api.post(`/trips/${id}/finish`, data).then(res => res.data),
  pause: (id: string, data: { currentMileage: number; location: string; waitingType: 'LOADING' | 'UNLOADING' }) => api.post(`/trips/${id}/pause`, data).then(res => res.data),
  checkDelayed: () => api.post('/trips/check-delayed').then(res => res.data),
  checkUpcoming: () => api.post('/trips/check-upcoming').then(res => res.data),
  sendReminder: (id: string) => api.post(`/trips/${id}/send-reminder`).then(res => res.data),
  // Trip Legs (Trechos)
  getLegs: (id: string) => api.get(`/trips/${id}/legs`).then(res => res.data),
  finishLeg: (tripId: string, legId: string, data: any) => api.post(`/trips/${tripId}/legs/${legId}/finish`, data).then(res => res.data),
};

// Expenses API
export const expensesAPI = {
  getAll: () => api.get('/expenses').then(res => res.data),
  getById: (id: string) => api.get(`/expenses/${id}`).then(res => res.data),
  getByTruck: (truckId: string) => api.get(`/expenses?truckId=${truckId}`).then(res => res.data),
  getByTrip: (tripId: string) => api.get(`/expenses?tripId=${tripId}`).then(res => res.data),
  create: (data: any) => api.post('/expenses', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/expenses/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/expenses/${id}`).then(res => res.data),
};

// Drivers API
export const driversAPI = {
  getAll: () => api.get('/drivers').then(res => res.data),
  getById: (id: string) => api.get(`/drivers/${id}`).then(res => res.data),
  create: (data: any) => api.post('/drivers', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/drivers/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/drivers/${id}`).then(res => res.data),
  deactivate: (id: string) => api.patch(`/drivers/${id}/deactivate`).then(res => res.data),
};

// Maintenance API
export const maintenanceAPI = {
  getAll: () => api.get('/maintenance').then(res => res.data),
  getById: (id: string) => api.get(`/maintenance/${id}`).then(res => res.data),
  getByTruck: (truckId: string) => api.get(`/maintenance?truckId=${truckId}`).then(res => res.data),
  create: (data: any) => api.post('/maintenance', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/maintenance/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/maintenance/${id}`).then(res => res.data),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats').then(res => res.data),
  getOverview: () => api.get('/dashboard/overview').then(res => res.data),
  getRecentTrips: () => api.get('/dashboard/recent-trips').then(res => res.data),
  getActiveTrips: () => api.get('/dashboard/active-trips').then(res => res.data),
  getExpensesSummary: () => api.get('/dashboard/expenses-summary').then(res => res.data),
  getTruckPerformance: () => api.get('/dashboard/truck-performance').then(res => res.data),
};

// Settings API
export const settingsAPI = {
  get: () => api.get('/settings').then(res => res.data),
  update: (data: any) => api.put('/settings', data).then(res => res.data),
};

// Reports API
export const reportsAPI = {
  getFinancial: (params?: any) => api.get('/reports/financial', { params }).then(res => res.data),
  sendWebhook: (data: any) => api.post('/reports/send-webhook', data).then(res => res.data),
  getMonthly: (year: number, month: number) => api.get(`/reports/monthly/${year}/${month}`).then(res => res.data),
};

// Billing API
export const billingAPI = {
  get: (params?: any) => api.get('/billing', { params }).then(res => res.data),
  sendWebhook: (data: any) => api.post('/billing/send-webhook', data).then(res => res.data),
};

// Clients API
export const clientsAPI = {
  getAll: () => api.get('/clients').then(res => res.data),
  getById: (id: string) => api.get(`/clients/${id}`).then(res => res.data),
  create: (data: any) => api.post('/clients', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/clients/${id}`).then(res => res.data),
};

// Locations API
export const locationsAPI = {
  getAll: () => api.get('/locations').then(res => res.data),
  getById: (id: string) => api.get(`/locations/${id}`).then(res => res.data),
  create: (data: any) => api.post('/locations', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/locations/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/locations/${id}`).then(res => res.data),
};

export default api;
