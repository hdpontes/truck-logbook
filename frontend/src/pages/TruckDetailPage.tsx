import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { trucksAPI, tripsAPI, expensesAPI, driversAPI } from '@/lib/api';
import {
  Truck,
  MapPin,
  Calendar,
  DollarSign,
  PlusCircle,
  Edit,
  Trash2,
  ArrowLeft,
  // Wrench, // Removido (não usado)
  TrendingUp,
  BarChart3,
  // Fuel, // Removido (não usado)
  // Receipt, // Removido (não usado)
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Truck {
  id: string;
  plateNumber: string;
  model: string;
  year: number;
  capacity: number;
  fuelType: string;
  currentMileage: number;
  status: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
}

interface Trip {
  id: string;
  truckId: string;
  driverId: string;
  origin: string;
  destination: string;
  distance: number;
  startDate: string;
  endDate?: string;
  status: string;
  revenue?: number;
}

interface Expense {
  id: string;
  truckId: string;
  tripId?: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  receipt?: string;
}

const TruckDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [truck, setTruck] = useState<Truck | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTruckDetails(id);
    }
  }, [id]);

  const fetchTruckDetails = async (truckId: string) => {
    try {
      setLoading(true);
      const [truckData, tripsData, expensesData] = await Promise.all([
        trucksAPI.getById(truckId),
        tripsAPI.getByTruck(truckId),
        expensesAPI.getByTruck(truckId),
      ]);
      
      setTruck(truckData);
      setTrips(tripsData);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error fetching truck details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await expensesAPI.delete(expenseId);
      setExpenses(expenses.filter(exp => exp.id !== expenseId));
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Truck not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          The truck you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Button onClick={() => navigate('/trucks')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trucks
          </Button>
        </div>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalRevenue = trips.reduce((sum, trip) => sum + (trip.revenue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/trucks')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {truck.plateNumber}
            </h1>
            <p className="text-gray-500">
              {truck.model} ({truck.year})
            </p>
          </div>
        </div>
        <Button onClick={() => navigate(`/trucks/${id}/edit`)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Truck
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Status</p>
                <p className="text-2xl font-bold text-gray-900">{truck.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MapPin className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Mileage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {truck.currentMileage.toLocaleString()} km
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Expenses</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalExpenses.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Trips</span>
            <Button onClick={() => navigate('/trips/new')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Trip
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <p className="text-gray-500">No trips found for this truck.</p>
          ) : (
            <div className="space-y-4">
              {trips.slice(0, 5).map((trip) => (
                <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {trip.origin} → {trip.destination}
                    </p>
                    <p className="text-sm text-gray-500">
                      {trip.distance} km • {new Date(trip.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${trip.revenue?.toLocaleString() || 0}</p>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        trip.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : trip.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {trip.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Expenses</span>
            <Button onClick={() => navigate('/expenses/new')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-gray-500">No expenses found for this truck.</p>
          ) : (
            <div className="space-y-4">
              {expenses.slice(0, 10).map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{expense.type}</p>
                    <p className="text-sm text-gray-500">
                      {expense.description} • {new Date(expense.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">${expense.amount.toLocaleString()}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TruckDetailPage;
