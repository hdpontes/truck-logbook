import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TrucksPage from './pages/TrucksPage';
import TruckDetailPage from './pages/TruckDetailPage';
import TruckFormPage from './pages/TruckFormPage';
import TripsPage from './pages/TripsPage';
import TripFormPage from './pages/TripFormPage';
import TripDetailPage from './pages/TripDetailPage';
import ExpensesPage from './pages/ExpensesPage';
import ExpenseFormPage from './pages/ExpenseFormPage';
import MaintenancePage from './pages/MaintenancePage';
import DriversPage from './pages/DriversPage';
import UsersPage from './pages/UsersPage';
import ClientsPage from './pages/ClientsPage';
import LocationsPage from './pages/LocationsPage';
import Layout from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function RoleRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  // Se o usuário for DRIVER e tentar acessar rota não permitida, redirecionar para trips
  if (user.role === 'DRIVER' && !allowedRoles.includes('DRIVER')) {
    return <Navigate to="/trips" />;
  }
  
  // Se a rota não permite o role do usuário, redirecionar para trips ou dashboard
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'DRIVER' ? '/trips' : '/'} />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><DashboardPage /></RoleRoute>} />
          <Route path="trucks" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><TrucksPage /></RoleRoute>} />
          <Route path="trucks/new" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><TruckFormPage /></RoleRoute>} />
          <Route path="trucks/:id" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><TruckDetailPage /></RoleRoute>} />
          <Route path="trucks/:id/edit" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><TruckFormPage /></RoleRoute>} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/new" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><TripFormPage /></RoleRoute>} />
          <Route path="trips/:id" element={<TripDetailPage />} />
          <Route path="expenses" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><ExpensesPage /></RoleRoute>} />
          <Route path="expenses/new" element={<ExpenseFormPage />} />
          <Route path="maintenance" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><MaintenancePage /></RoleRoute>} />
          <Route path="drivers" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><DriversPage /></RoleRoute>} />
          <Route path="users" element={<RoleRoute allowedRoles={['ADMIN']}><UsersPage /></RoleRoute>} />
          <Route path="clients" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><ClientsPage /></RoleRoute>} />
          <Route path="locations" element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']}><LocationsPage /></RoleRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
