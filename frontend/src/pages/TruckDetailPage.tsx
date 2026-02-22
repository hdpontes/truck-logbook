import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { trucksAPI, tripsAPI, expensesAPI } from '@/lib/api';
import {
  Truck,
  MapPin,
  DollarSign,
  PlusCircle,
  Edit,
  Trash2,
  ArrowLeft,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface TruckData {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  color: string;
  capacity: number;
  avgConsumption: number;
  active: boolean;
  _count?: {
    trips: number;
    expenses: number;
    maintenances: number;
  };
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
  revenue: number;
  totalCost: number;
  profit: number;
  driver: {
    name: string;
  };
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
  const [truck, setTruck] = useState<TruckData | null>(null);
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
      console.error('Erro ao carregar detalhes do caminhão:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await expensesAPI.delete(expenseId);
      setExpenses(expenses.filter(exp => exp.id !== expenseId));
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
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
        <h3 className="mt-2 text-sm font-medium text-gray-900">Caminhão não encontrado</h3>
        <p className="mt-1 text-sm text-gray-500">
          O caminhão que você procura não existe.
        </p>
        <div className="mt-6">
          <Button onClick={() => navigate('/trucks')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Frota
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
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {truck.plate}
            </h1>
            <p className="text-gray-500">
              {truck.brand} {truck.model} ({truck.year})
            </p>
          </div>
        </div>
        <Button onClick={() => navigate(`/trucks/${id}/edit`)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar Caminhão
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
                <p className="text-2xl font-bold text-gray-900">{truck.active ? 'Ativo' : 'Inativo'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MapPin className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Viagens</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trips.length}
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
                <p className="text-sm font-medium text-gray-500">Receita</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalRevenue)}
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
                <p className="text-sm font-medium text-gray-500">Despesas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalExpenses)}
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
            <span>Viagens Recentes</span>
            <Button onClick={() => navigate('/trips/new')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Viagem
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <p className="text-gray-500">Nenhuma viagem encontrada para este caminhão.</p>
          ) : (
            <div className="space-y-4">
              {trips.slice(0, 5).map((trip) => (
                <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {trip.origin} → {trip.destination}
                    </p>
                    <p className="text-sm text-gray-500">
                      {trip.distance} km • {new Date(trip.startDate).toLocaleDateString('pt-BR')} • {trip.driver.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(trip.revenue || 0)}</p>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        trip.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : trip.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {trip.status === 'COMPLETED' ? 'Concluída' : trip.status === 'IN_PROGRESS' ? 'Em Andamento' : trip.status}
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
            <span>Despesas</span>
            <Button onClick={() => alert('Nova despesa em breve')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Despesa
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-gray-500">Nenhuma despesa encontrada para este caminhão.</p>
          ) : (
            <div className="space-y-4">
              {expenses.slice(0, 10).map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{expense.type}</p>
                    <p className="text-sm text-gray-500">
                      {expense.description} • {new Date(expense.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{formatCurrency(expense.amount)}</span>
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
