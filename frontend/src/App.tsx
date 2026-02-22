import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TrucksPage from './pages/TrucksPage';
import TruckDetailPage from './pages/TruckDetailPage';
import TruckFormPage from './pages/TruckFormPage';
import TripsPage from './pages/TripsPage';
import TripFormPage from './pages/TripFormPage';
import ExpensesPage from './pages/ExpensesPage';
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
          <Route index element={<DashboardPage />} />
          <Route path="trucks" element={<TrucksPage />} />
          <Route path="trucks/new" element={<TruckFormPage />} />
          <Route path="trucks/:id" element={<TruckDetailPage />} />
          <Route path="trucks/:id/edit" element={<TruckFormPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/new" element={<TripFormPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="locations" element={<LocationsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
