import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { tripsAPI, expensesAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  Route,
  MapPin,
  DollarSign,
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  Truck,
  User,
  Play,
  StopCircle,
  Clock,
  Plus,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface TripData {
  id: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate?: string;
  distance: number;
  startMileage?: number;
  endMileage?: number;
  revenue: number;
  fuelCost: number;
  tollCost: number;
  otherCosts: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  status: string;
  notes?: string;
  truck: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  };
  driver: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

interface Expense {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
}

const TripDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [trip, setTrip] = useState<TripData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState<string>('');

  useEffect(() => {
    if (id) {
      fetchTripDetails(id);
    }
  }, [id]);

  useEffect(() => {
    if (trip?.status === 'IN_PROGRESS' && trip.startDate) {
      const interval = setInterval(() => {
        const start = new Date(trip.startDate).getTime();
        const now = new Date().getTime();
        const diff = now - start;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        setElapsedTime(`${hours}h ${minutes}m`);
      }, 60000); // Atualiza a cada minuto
      
      // Calcula imediatamente
      const start = new Date(trip.startDate).getTime();
      const now = new Date().getTime();
      const diff = now - start;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setElapsedTime(`${hours}h ${minutes}m`);
      
      return () => clearInterval(interval);
    }
  }, [trip]);

  const fetchTripDetails = async (tripId: string) => {
    try {
      setLoading(true);
      const [tripData, expensesData] = await Promise.all([
        tripsAPI.getById(tripId),
        expensesAPI.getByTrip(tripId),
      ]);
      
      setTrip(tripData);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Erro ao carregar detalhes da viagem:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async () => {
    if (!id) return;
    try {
      await tripsAPI.start(id);
      fetchTripDetails(id);
    } catch (error) {
      console.error('Erro ao iniciar viagem:', error);
      alert('Erro ao iniciar viagem');
    }
  };

  const handleFinishTrip = async () => {
    if (!id || !trip) return;
    
    // Pedir quilometragem final
    const startMileage = trip.startMileage || 0;
    const suggestedEndMileage = startMileage > 0 ? startMileage + 100 : 1000;
    
    const endMileageStr = prompt(
      `Quilometragem inicial do caminhão: ${startMileage.toFixed(0)} km\n\n` +
      `Informe a quilometragem final do caminhão:`,
      suggestedEndMileage.toString()
    );
    
    if (!endMileageStr) {
      console.log('Usuário cancelou a entrada de quilometragem');
      return; // Usuário cancelou
    }
    
    const endMileage = parseFloat(endMileageStr.replace(',', '.'));
    
    // Validar quilometragem
    if (isNaN(endMileage) || endMileage < 0) {
      alert('Quilometragem inválida. Por favor, informe um número válido.');
      return;
    }
    
    if (startMileage > 0 && endMileage < startMileage) {
      alert(`A quilometragem final (${endMileage.toFixed(0)} km) não pode ser menor que a inicial (${startMileage.toFixed(0)} km).`);
      return;
    }
    
    const distance = startMileage > 0 ? endMileage - startMileage : endMileage;
    
    const confirmMessage = startMileage > 0 
      ? `Confirmar finalização da viagem?\n\n` +
        `Quilometragem inicial: ${startMileage.toFixed(0)} km\n` +
        `Quilometragem final: ${endMileage.toFixed(0)} km\n` +
        `Distância percorrida: ${distance.toFixed(1)} km\n\n` +
        `Esta ação calculará os custos finais.`
      : `Confirmar finalização da viagem?\n\n` +
        `Quilometragem registrada: ${endMileage.toFixed(0)} km\n\n` +
        `Esta ação calculará os custos finais.`;
    
    if (!confirm(confirmMessage)) {
      console.log('Usuário cancelou a confirmação');
      return;
    }
    
    try {
      console.log('Finalizando viagem com quilometragem:', endMileage);
      await tripsAPI.finish(id, { endMileage });
      alert('Viagem finalizada com sucesso!');
      fetchTripDetails(id);
    } catch (error: any) {
      console.error('Erro ao finalizar viagem:', error);
      alert(error.response?.data?.message || 'Erro ao finalizar viagem');
    }
  };

  const handleSendReminder = async () => {
    if (!id) return;
    if (!confirm('Deseja enviar notificação do lembrete da viagem para o motorista?')) return;
    try {
      await tripsAPI.sendReminder(id);
      alert('Lembrete enviado com sucesso para o motorista!');
    } catch (error: any) {
      console.error('Erro ao enviar lembrete:', error);
      alert(error.response?.data?.message || 'Erro ao enviar lembrete');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Viagem não encontrada</h3>
        <p className="mt-1 text-sm text-gray-500">
          A viagem que você procura não existe.
        </p>
        <div className="mt-6">
          <Button onClick={() => navigate('/trips')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Viagens
          </Button>
        </div>
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

  const expenseTypeLabels: Record<string, string> = {
    FUEL: 'Combustível',
    TOLL: 'Pedágio',
    MAINTENANCE: 'Manutenção',
    FOOD: 'Alimentação',
    ACCOMMODATION: 'Hospedagem',
    REPAIR: 'Reparo',
    TIRE: 'Pneu',
    INSURANCE: 'Seguro',
    TAX: 'Imposto',
    OTHER: 'Outros',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/trips')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Detalhes da Viagem
            </h1>
            <p className="text-gray-500">
              {trip.origin} → {trip.destination}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[trip.status as keyof typeof statusColors]}`}>
            {statusLabels[trip.status as keyof typeof statusLabels]}
          </span>
          {trip.status === 'IN_PROGRESS' && elapsedTime && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-semibold">{elapsedTime}</span>
            </div>
          )}
          {(trip.status === 'PLANNED' || trip.status === 'DELAYED') && user?.id === trip.driver.id && (
            <Button onClick={handleStartTrip} className="bg-green-600 hover:bg-green-700">
              <Play className="mr-2 h-4 w-4" />
              Iniciar Viagem
            </Button>
          )}
          {trip.status === 'IN_PROGRESS' && user?.id === trip.driver.id && (
            <Button onClick={handleFinishTrip} className="bg-red-600 hover:bg-red-700">
              <StopCircle className="mr-2 h-4 w-4" />
              Finalizar Viagem
            </Button>
          )}
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <Button onClick={handleSendReminder} className="bg-green-600 hover:bg-green-700">
              <MessageCircle className="mr-2 h-4 w-4" />
              Enviar Lembrete
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MapPin className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Distância</p>
                <p className="text-2xl font-bold text-gray-900">{trip.distance || 0} km</p>
                {trip.startMileage != null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {trip.startMileage.toFixed(0)} km → {trip.endMileage != null ? trip.endMileage.toFixed(0) : '...'} km
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Receita</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(trip.revenue || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Custo Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(trip.totalCost || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Lucro</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(trip.profit || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trip Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Informações da Viagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Origem:</span>
              <span className="font-medium">{trip.origin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Destino:</span>
              <span className="font-medium">{trip.destination}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Data Início:</span>
              <span className="font-medium">{new Date(trip.startDate).toLocaleString('pt-BR')}</span>
            </div>
            {trip.endDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Data Fim:</span>
                <span className="font-medium">{new Date(trip.endDate).toLocaleString('pt-BR')}</span>
              </div>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
              <div className="flex justify-between">
                <span className="text-gray-600">Margem de Lucro:</span>
                <span className="font-medium">{(trip.profitMargin || 0).toFixed(2)}%</span>
              </div>
            )}
            {trip.notes && (
              <div className="pt-3 border-t">
                <p className="text-gray-600 text-sm mb-1">Observações:</p>
                <p className="text-sm">{trip.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Caminhão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Placa:</span>
                <span className="font-medium">{trip.truck.plate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Modelo:</span>
                <span className="font-medium">{trip.truck.brand} {trip.truck.model}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => navigate(`/trucks/${trip.truck.id}`)}
              >
                Ver Detalhes do Caminhão
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Motorista
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Nome:</span>
                <span className="font-medium">{trip.driver.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium text-sm">{trip.driver.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Telefone:</span>
                <span className="font-medium">{trip.driver.phone}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Breakdown de Custos */}
      <Card>
        <CardHeader>
          <CardTitle>Breakdown de Custos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Combustível</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(trip.fuelCost || 0)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Pedágios</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(trip.tollCost || 0)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Outros Custos</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(trip.otherCosts || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Despesas Relacionadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Despesas Relacionadas</span>
            {user?.role === 'DRIVER' && (trip.status === 'IN_PROGRESS' || trip.status === 'COMPLETED') && (
              <Button onClick={() => navigate(`/expenses/new?tripId=${trip.id}`)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Despesa
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-gray-500">Nenhuma despesa registrada para esta viagem.</p>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{expenseTypeLabels[expense.type] || expense.type}</p>
                    <p className="text-sm text-gray-500">
                      {expense.description} • {new Date(expense.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="font-medium">{formatCurrency(expense.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TripDetailPage;
