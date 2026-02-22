import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { tripsAPI } from '@/lib/api';
import { Route, Plus, Eye, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

interface Trip {
  id: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate?: string;
  distance: number;
  revenue: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DELAYED';
  truck: {
    id: string;
    plate: string;
    model: string;
  };
  driver: {
    id: string;
    name: string;
  };
}

export default function TripsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'IN_PROGRESS' | 'COMPLETED'>('all');

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const data = await tripsAPI.getAll();
      
      // Se for motorista, filtrar apenas suas viagens
      if (user?.role === 'DRIVER') {
        setTrips(data.filter((trip: Trip) => trip.driver.id === user.id));
      } else {
        setTrips(data);
      }
    } catch (error) {
      console.error('Erro ao carregar viagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta viagem?')) {
      try {
        await tripsAPI.delete(id);
        setTrips(trips.filter(trip => trip.id !== id));
      } catch (error) {
        console.error('Erro ao excluir viagem:', error);
      }
    }
  };

  const filteredTrips = filter === 'all' 
    ? trips 
    : trips.filter(trip => trip.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const statusColors = {
    PLANNED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    DELAYED: 'bg-red-200 text-red-900',
  };

  const statusLabels = {
    PLANNED: 'Planejada',
    IN_PROGRESS: 'Em Andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
    DELAYED: 'Em Atraso',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Viagens</h1>
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <Button onClick={() => navigate('/trips/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Viagem
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          Todas ({trips.length})
        </Button>
        <Button
          variant={filter === 'IN_PROGRESS' ? 'default' : 'outline'}
          onClick={() => setFilter('IN_PROGRESS')}
        >
          Em Andamento ({trips.filter(t => t.status === 'IN_PROGRESS').length})
        </Button>
        <Button
          variant={filter === 'COMPLETED' ? 'default' : 'outline'}
          onClick={() => setFilter('COMPLETED')}
        >
          Concluídas ({trips.filter(t => t.status === 'COMPLETED').length})
        </Button>
      </div>

      {filteredTrips.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Route className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma viagem encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comece adicionando sua primeira viagem.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTrips.map((trip) => (
            <Card 
              key={trip.id} 
              className={`hover:shadow-lg transition-shadow ${
                trip.status === 'DELAYED' ? 'border-red-300 bg-red-50' : ''
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-500" />
                    <span className="text-lg">{trip.origin} → {trip.destination}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[trip.status]}`}>
                    {statusLabels[trip.status]}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Caminhão</p>
                    <p className="font-medium">{trip.truck.plate}</p>
                    <p className="text-sm text-gray-500">{trip.truck.model}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Motorista</p>
                    <p className="font-medium">{trip.driver.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Distância</p>
                    <p className="font-medium">{trip.distance} km</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Data</p>
                    <p className="font-medium">
                      {new Date(trip.startDate).toLocaleDateString('pt-BR')}
                      {trip.endDate && ` - ${new Date(trip.endDate).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-xs text-gray-600">Receita</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(trip.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Custo</p>
                      <p className="text-sm font-semibold text-red-600">{formatCurrency(trip.totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Lucro</p>
                      <p className="text-sm font-semibold text-blue-600">{formatCurrency(trip.profit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Margem</p>
                      <p className="text-sm font-semibold">{trip.profitMargin.toFixed(2)}%</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/trips/${trip.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(trip.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
