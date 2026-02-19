const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:4000';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Helper function for API requests
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

// Auth API
export const auth = {
  login: async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

// Dashboard API with all required methods
export const dashboardAPI = {
  getStats: () => apiRequest('/dashboard/stats'),
  getRecentTrips: () => apiRequest('/dashboard/recent-trips'),
  getActiveTrips: () => apiRequest('/dashboard/active-trips'),
  getExpensesSummary: () => apiRequest('/dashboard/expenses-summary'),
  getOverview: () => apiRequest('/dashboard/overview'),
  getTruckPerformance: () => apiRequest('/dashboard/truck-performance'),
};

export const trucksAPI = {
  getAll: () => apiRequest('/trucks'),
  getById: (id: string) => apiRequest(`/trucks/${id}`),
  create: (data: any) => apiRequest('/trucks', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/trucks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/trucks/${id}`, {
    method: 'DELETE',
  }),
};

export const tripsAPI = {
  getAll: () => apiRequest('/trips'),
  getById: (id: string) => apiRequest(`/trips/${id}`),
  getByTruck: (truckId: string) => apiRequest(`/trips/truck/${truckId}`),
  create: (data: any) => apiRequest('/trips', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/trips/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/trips/${id}`, {
    method: 'DELETE',
  }),
  start: (id: string) => apiRequest(`/trips/${id}/start`, {
    method: 'POST',
  }),
  finish: (id: string, data: any) => apiRequest(`/trips/${id}/finish`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const expensesAPI = {
  getAll: () => apiRequest('/expenses'),
  getByTrip: (tripId: string) => apiRequest(`/expenses/trip/${tripId}`),
  getByTruck: (truckId: string) => apiRequest(`/expenses/truck/${truckId}`),
  create: (data: any) => apiRequest('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/expenses/${id}`, {
    method: 'DELETE',
  }),
};

export const driversAPI = {
  getAll: () => apiRequest('/drivers'),
  getById: (id: string) => apiRequest(`/drivers/${id}`),
  create: (data: any) => apiRequest('/drivers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/drivers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/drivers/${id}`, {
    method: 'DELETE',
  }),
};

// Legacy aliases for backward compatibility
export const authAPI = auth;
export const trucks = trucksAPI;
export const trips = tripsAPI;
export const expenses = expensesAPI;
export const drivers = driversAPI;
export const dashboard = dashboardAPI;

// Maintenance API
export const maintenance = {
  getAll: () => apiRequest('/maintenance'),
  getByTruck: (truckId: string) => apiRequest(`/maintenance/truck/${truckId}`),
  create: (data: any) => apiRequest('/maintenance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/maintenance/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/maintenance/${id}`, {
    method: 'DELETE',
  }),
};
