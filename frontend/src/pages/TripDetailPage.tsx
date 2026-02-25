import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { tripsAPI, expensesAPI, trailersAPI, trucksAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/contexts/ToastContext';
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
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface TripData {
  id: string;
  tripCode?: string;
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
  trailer?: {
    id: string;
    plate: string;
    model?: string;
    brand?: string;
  } | null;
  driver: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  calculations?: {
    timeInTransit: { hours: number; minutes: number };
    timeLoading: { hours: number; minutes: number };
    timeUnloading: { hours: number; minutes: number };
    totalDistance: number;
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
  const toast = useToast();
  // Modal de carreta
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [trailers, setTrailers] = useState<any[]>([]);
  const [selectedTrailerId, setSelectedTrailerId] = useState('');

  // Handler para iniciar viagem com verificação de carreta
  const handleStartTripWithTrailer = async () => {
    if (!id || !trip) return;
    try {
      const truck = await trucksAPI.getById(trip.truck.id);
      if (truck.noCapacity) {
        const trailersList = await trailersAPI.getAll();
        setTrailers(trailersList);
        setShowTrailerModal(true);
        setSelectedTrailerId('');
        return;
      }
      await tripsAPI.start(id);
      fetchTripDetails(id);
    } catch (error) {
      toast.error('Erro ao iniciar viagem');
    }
  };
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

  // Substitui handleStartTrip por handleStartTripWithTrailer

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
      toast.error('Quilometragem inválida. Por favor, informe um número válido.');
      return;
    }
    
    if (startMileage > 0 && endMileage < startMileage) {
      toast.error(`A quilometragem final (${endMileage.toFixed(0)} km) não pode ser menor que a inicial (${startMileage.toFixed(0)} km).`);
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
      toast.success('Viagem finalizada com sucesso!');
      fetchTripDetails(id);
    } catch (error: any) {
      console.error('Erro ao finalizar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao finalizar viagem');
    }
  };

  const handleSendReminder = async () => {
    if (!id) return;
    if (!confirm('Deseja enviar notificação do lembrete da viagem para o motorista?')) return;
    try {
      await tripsAPI.sendReminder(id);
      toast.success('Lembrete enviado com sucesso para o motorista!');
    } catch (error: any) {
      console.error('Erro ao enviar lembrete:', error);
      toast.error(error.response?.data?.message || 'Erro ao enviar lembrete');
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-3 md:space-y-0 md:flex md:items-center md:justify-between">
        <div className="flex items-center space-x-3 md:space-x-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/trips')} className="touch-manipulation">
            <ArrowLeft className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Voltar</span>
          </Button>
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-gray-900">
              Detalhes da Viagem
            </h1>
            <p className="text-sm md:text-base text-gray-500">
              {trip.origin} → {trip.destination}
            </p>
            {trip.tripCode && (
              <p className="text-xs md:text-sm text-gray-400 mt-1">
                Código: {trip.tripCode}
              </p>
            )}
          </div>
        </div>
        
        {/* Status and Timer - Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[trip.status as keyof typeof statusColors]}`}>
            {statusLabels[trip.status as keyof typeof statusLabels]}
          </span>
          {trip.status === 'IN_PROGRESS' && elapsedTime && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
              <Clock className="h-3 w-3" />
              <span className="text-xs font-semibold">{elapsedTime}</span>
            </div>
          )}
        </div>
        
        {/* Status and Timer - Desktop */}
        <div className="hidden md:flex md:items-center md:gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[trip.status as keyof typeof statusColors]}`}>
            {statusLabels[trip.status as keyof typeof statusLabels]}
          </span>
          {trip.status === 'IN_PROGRESS' && elapsedTime && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-semibold">{elapsedTime}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-2 md:flex-wrap">
        {(trip.status === 'PLANNED' || trip.status === 'DELAYED') && user?.id === trip.driver.id && (
          <Button onClick={handleStartTripWithTrailer} className="w-full md:w-auto bg-green-600 hover:bg-green-700 touch-manipulation">
            <Play className="mr-2 h-4 w-4" />
            Iniciar Viagem
          </Button>
        )}
            {/* Modal de Seleção de Carreta ao Iniciar Viagem */}
            {showTrailerModal && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={() => {
                  setShowTrailerModal(false);
                  setSelectedTrailerId('');
                }}
              >
                <Card
                  className="w-full max-w-md"
                  onClick={e => e.stopPropagation()} // Impede fechar ao clicar dentro do Card
                >
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-blue-600">Selecione a Carreta</CardTitle>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
                      onClick={() => {
                        setShowTrailerModal(false);
                        setSelectedTrailerId('');
                      }}
                      aria-label="Fechar"
                    >
                      ×
                    </button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Carreta disponível *
                        </label>
                        <select
                          value={selectedTrailerId}
                          onChange={e => setSelectedTrailerId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione uma carreta</option>
                          {trailers.map((trailer: any) => (
                            <option key={trailer.id} value={trailer.id}>
                              {trailer.plate} {trailer.brand && trailer.model ? `- ${trailer.brand} ${trailer.model}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                      <Button
                        onClick={async () => {
                          if (!selectedTrailerId) {
                            toast.error('Selecione uma carreta para iniciar a viagem');
                            return;
                          }
                          setShowTrailerModal(false);
                          if (!id) {
                            toast.error('ID da viagem inválido');
                            return;
                          }
                          try {
                            await tripsAPI.start(id);
                            fetchTripDetails(id);
                          } catch (error) {
                            toast.error('Erro ao iniciar viagem');
                          }
                        }}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar Viagem
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
        {trip.status === 'IN_PROGRESS' && user?.id === trip.driver.id && (
          <Button onClick={handleFinishTrip} className="w-full md:w-auto bg-red-600 hover:bg-red-700 touch-manipulation">
            <StopCircle className="mr-2 h-4 w-4" />
            Finalizar Viagem
          </Button>
        )}
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <Button onClick={handleSendReminder} className="w-full md:w-auto bg-green-600 hover:bg-green-700 touch-manipulation">
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar Lembrete
          </Button>
        )}
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && 
         (trip.status === 'PLANNED' || trip.status === 'DELAYED') && (
          <Button 
            onClick={() => id && navigate(`/trips/${id}/edit`)}
            variant="outline"
            className="w-full md:w-auto border-blue-600 text-blue-600 hover:bg-blue-50 touch-manipulation"
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar Viagem
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <MapPin className="h-6 w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-500">Distância</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{trip.distance || 0} km</p>
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
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-green-600 flex-shrink-0" />
                <div className="ml-3 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500">Receita</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {formatCurrency(trip.revenue || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-red-600 flex-shrink-0" />
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-500">Custo Total</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">
                  {formatCurrency(trip.totalCost || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
                <div className="ml-3 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500">Lucro</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {formatCurrency(trip.profit || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trip Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Route className="h-4 w-4 md:h-5 md:w-5" />
              Informações da Viagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-3">
            <div className="flex justify-between">
              <span className="text-sm md:text-base text-gray-600">Origem:</span>
              <span className="font-medium text-sm md:text-base">{trip.origin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm md:text-base text-gray-600">Destino:</span>
              <span className="font-medium text-sm md:text-base">{trip.destination}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm md:text-base text-gray-600">Data Início:</span>
              <span className="font-medium text-sm md:text-base">{new Date(trip.startDate).toLocaleString('pt-BR')}</span>
            </div>
            {trip.endDate && (
              <div className="flex justify-between">
                <span className="text-sm md:text-base text-gray-600">Data Fim:</span>
                <span className="font-medium text-sm md:text-base">{new Date(trip.endDate).toLocaleString('pt-BR')}</span>
              </div>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
              <div className="flex justify-between">
                <span className="text-sm md:text-base text-gray-600">Margem de Lucro:</span>
                <span className="font-medium text-sm md:text-base">{(trip.profitMargin || 0).toFixed(2)}%</span>
              </div>
            )}
            {trip.notes && (
              <div className="pt-2 md:pt-3 border-t">
                <p className="text-gray-600 text-xs md:text-sm mb-1">Observações:</p>
                <p className="text-xs md:text-sm">{trip.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Truck className="h-4 w-4 md:h-5 md:w-5" />
                Caminhão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm md:text-base text-gray-600">Placa:</span>
                <span className="font-medium text-sm md:text-base uppercase">{trip.truck.plate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm md:text-base text-gray-600">Modelo:</span>
                <span className="font-medium text-sm md:text-base">{trip.truck.brand} {trip.truck.model}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2 touch-manipulation"
                onClick={() => navigate(`/trucks/${trip.truck.id}`)}
              >
                Ver Detalhes do Caminhão
              </Button>
            </CardContent>
          </Card>

          {trip.trailer && (
            <Card>
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Truck className="h-4 w-4 md:h-5 md:w-5" />
                  Carreta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm md:text-base text-gray-600">Placa:</span>
                  <span className="font-medium text-sm md:text-base uppercase">{trip.trailer.plate}</span>
                </div>
                {(trip.trailer.brand || trip.trailer.model) && (
                  <div className="flex justify-between">
                    <span className="text-sm md:text-base text-gray-600">Modelo:</span>
                    <span className="font-medium text-sm md:text-base">
                      {trip.trailer.brand} {trip.trailer.model}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <User className="h-4 w-4 md:h-5 md:w-5" />
                Motorista
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm md:text-base text-gray-600">Nome:</span>
                <span className="font-medium text-sm md:text-base">{trip.driver.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm md:text-base text-gray-600">Email:</span>
                <span className="font-medium text-xs md:text-sm break-all">{trip.driver.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm md:text-base text-gray-600">Telefone:</span>
                <span className="font-medium text-sm md:text-base">{trip.driver.phone}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Breakdown de Custos */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Breakdown de Custos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="p-3 md:p-4 border rounded-lg">
              <p className="text-xs md:text-sm text-gray-600">Combustível</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">{formatCurrency(trip.fuelCost || 0)}</p>
            </div>
            <div className="p-3 md:p-4 border rounded-lg">
              <p className="text-xs md:text-sm text-gray-600">Pedágios</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">{formatCurrency(trip.tollCost || 0)}</p>
            </div>
            <div className="p-3 md:p-4 border rounded-lg">
              <p className="text-xs md:text-sm text-gray-600">Outros Custos</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">{formatCurrency(trip.otherCosts || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown de Tempo */}
      {trip.calculations && (trip.calculations.timeInTransit.hours > 0 || trip.calculations.timeLoading.hours > 0 || trip.calculations.timeUnloading.hours > 0 || 
                             trip.calculations.timeInTransit.minutes > 0 || trip.calculations.timeLoading.minutes > 0 || trip.calculations.timeUnloading.minutes > 0) && (
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Clock className="h-4 w-4 md:h-5 md:w-5" />
              Breakdown de Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {(trip.calculations.timeInTransit.hours > 0 || trip.calculations.timeInTransit.minutes > 0) && (
                <div className="p-3 md:p-4 border rounded-lg bg-yellow-50">
                  <p className="text-xs md:text-sm text-gray-600">Tempo em Trânsito</p>
                  <p className="text-lg md:text-xl font-bold text-gray-900">
                    {trip.calculations.timeInTransit.hours}h {trip.calculations.timeInTransit.minutes}m
                  </p>
                </div>
              )}
              {(trip.calculations.timeLoading.hours > 0 || trip.calculations.timeLoading.minutes > 0) && (
                <div className="p-3 md:p-4 border rounded-lg bg-purple-50">
                  <p className="text-xs md:text-sm text-gray-600">Tempo Carregando</p>
                  <p className="text-lg md:text-xl font-bold text-gray-900">
                    {trip.calculations.timeLoading.hours}h {trip.calculations.timeLoading.minutes}m
                  </p>
                </div>
              )}
              {(trip.calculations.timeUnloading.hours > 0 || trip.calculations.timeUnloading.minutes > 0) && (
                <div className="p-3 md:p-4 border rounded-lg bg-indigo-50">
                  <p className="text-xs md:text-sm text-gray-600">Tempo Descarregando</p>
                  <p className="text-lg md:text-xl font-bold text-gray-900">
                    {trip.calculations.timeUnloading.hours}h {trip.calculations.timeUnloading.minutes}m
                  </p>
                </div>
              )}
            </div>
            {trip.calculations.totalDistance > 0 && (
              <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t">
                <p className="text-xs md:text-sm text-gray-600">Distância Total Calculada dos Trechos</p>
                <p className="text-base md:text-lg font-semibold text-gray-900">{trip.calculations.totalDistance.toFixed(1)} km</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Despesas Relacionadas */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-base md:text-lg">
            <span>Despesas Relacionadas</span>
            {(trip.status === 'IN_PROGRESS' || trip.status === 'COMPLETED') && (
              <Button onClick={() => navigate(`/expenses/new?tripId=${trip.id}`)} className="w-full sm:w-auto touch-manipulation">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Despesa
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm md:text-base text-gray-500">Nenhuma despesa registrada para esta viagem.</p>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 md:p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm md:text-base">{expenseTypeLabels[expense.type] || expense.type}</p>
                    <p className="text-xs md:text-sm text-gray-500">
                      {expense.description} • {new Date(expense.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="font-medium text-sm md:text-base">{formatCurrency(expense.amount)}</span>
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
