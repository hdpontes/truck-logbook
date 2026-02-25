import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { tripsAPI, driversAPI, clientsAPI, expensesAPI, trailersAPI, trucksAPI } from '@/lib/api';
import { Plus, Eye, Edit, Trash2, MapPin, MessageCircle, Filter, Search, Clock, Play, CheckCircle, DollarSign, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/contexts/ToastContext';

interface Trip {
  id: string;
  tripCode?: string;
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
  trailer?: {
    id: string;
    plate: string;
    model?: string;
  } | null;
  driver: {
    id: string;
    name: string;
  };
  client?: {
    id: string;
    name: string;
  };
  legs?: Array<{
    id: string;
    status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
    waitingType?: 'LOADING' | 'UNLOADING';
    type: 'NORMAL' | 'AGUARDANDO' | 'REPOSICIONAMENTO';
  }>;
}

export default function TripsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [tripToRemind, setTripToRemind] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Estados para modal de conclusão de viagem
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [tripToFinish, setTripToFinish] = useState<Trip | null>(null);
  const [finalMileage, setFinalMileage] = useState('');
  
  // Estados para modal de despesa
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [tripForExpense, setTripForExpense] = useState<Trip | null>(null);
  const [expenseData, setExpenseData] = useState({
    type: 'FUEL' as 'FUEL' | 'TOLL' | 'MAINTENANCE' | 'TIRE' | 'FOOD' | 'PARKING' | 'INSURANCE' | 'TAX' | 'SALARY' | 'OVERTIME' | 'OTHER',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  
  // Estados para modal de pausar viagem (deixar carreto)
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [tripToPause, setTripToPause] = useState<Trip | null>(null);
  const [pauseMileage, setPauseMileage] = useState('');
  const [pauseLocation, setPauseLocation] = useState('');
  const [waitingType, setWaitingType] = useState<'LOADING' | 'UNLOADING'>('LOADING');
  
  // Estados para modal de quilometragem ao resumir viagem
  const [showResumeMileageModal, setShowResumeMileageModal] = useState(false);
  const [tripToResumeWithMileage, setTripToResumeWithMileage] = useState<Trip | null>(null);
  const [resumeMileage, setResumeMileage] = useState('');
  
  // Estados para filtros avançados
  const [showFilters, setShowFilters] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [tripCodeFilter, setTripCodeFilter] = useState('');
  
  // Dados para dropdowns
  const [clients, setClients] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trailers, setTrailers] = useState<any[]>([]);
  const [selectedTrailerId, setSelectedTrailerId] = useState<string>('');
  const [tripToStart, setTripToStart] = useState<Trip | null>(null);
  // Modal de carreta ao iniciar viagem
  const [showTrailerModal, setShowTrailerModal] = useState(false);

  // Update current time every minute for elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadFiltersData();
    fetchTrips();
  }, []);

  // Auto-refresh trips every 30 seconds for real-time updates
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchTrips();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [startDateFilter, endDateFilter, clientFilter, driverFilter, tripCodeFilter]);

  const loadFiltersData = async () => {
    try {
      const [clientsData, driversData] = await Promise.all([
        clientsAPI.getAll(),
        driversAPI.getAll(),
      ]);
      
      setClients(clientsData.filter((c: any) => c.active !== false));
      setDrivers(driversData.filter((d: any) => d.active !== false));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      
      const params: any = {};
      if (startDateFilter) params.startDate = startDateFilter;
      if (endDateFilter) params.endDate = endDateFilter;
      if (clientFilter) params.clientId = clientFilter;
      if (driverFilter) params.driverId = driverFilter;
      
      const data = await tripsAPI.getAll(params);
      
      // Se for motorista, filtrar apenas suas viagens
      let filteredData = data;
      if (user?.role === 'DRIVER') {
        filteredData = data.filter((trip: Trip) => trip.driver.id === user.id);
      }
      
      // Filtrar por código se especificado
      if (tripCodeFilter) {
        filteredData = filteredData.filter((trip: Trip) => 
          trip.tripCode?.toLowerCase().includes(tripCodeFilter.toLowerCase())
        );
      }
      
      // Ordenar: IN_PROGRESS primeiro, depois por data mais próxima (crescente)
      const sortedTrips = [...filteredData].sort((a: Trip, b: Trip) => {
        // Se um está IN_PROGRESS e o outro não, IN_PROGRESS vem primeiro
        if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
        if (a.status !== 'IN_PROGRESS' && b.status === 'IN_PROGRESS') return 1;
        
        // Se ambos têm o mesmo status, ordenar por data crescente (hoje, amanhã, depois...)
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
      
      setTrips(sortedTrips);
    } catch (error) {
      console.error('Erro ao carregar viagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setTripToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!tripToDelete) return;

    try {
      await tripsAPI.delete(tripToDelete);
      setTrips(trips.filter(trip => trip.id !== tripToDelete));
      toast.success('Viagem excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir viagem:', error);
      if (error.response?.status === 403) {
        toast.error(error.response?.data?.message || 'Você não tem permissão para excluir esta viagem.');
      } else {
        toast.error('Erro ao excluir viagem.');
      }
    } finally {
      setShowDeleteModal(false);
      setTripToDelete(null);
    }
  };

  const handleSendReminder = async (id: string) => {
    setTripToRemind(id);
    setShowReminderModal(true);
  };

  const confirmSendReminder = async () => {
    if (!tripToRemind) return;

    try {
      await tripsAPI.sendReminder(tripToRemind);
      toast.success('Lembrete enviado com sucesso para o motorista!');
    } catch (error: any) {
      console.error('Erro ao enviar lembrete:', error);
      toast.error(error.response?.data?.message || 'Erro ao enviar lembrete');
    } finally {
      setShowReminderModal(false);
      setTripToRemind(null);
    }
  };

  const calculateElapsedTime = (startDate: string) => {
    const start = new Date(startDate).getTime();
    const diff = currentTime - start;
    
    if (diff < 0) return '0h 0m';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const getTripDisplayStatus = (trip: Trip) => {
    if (trip.status !== 'IN_PROGRESS' || !trip.legs || trip.legs.length === 0) {
      return { text: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800' };
    }

    // Verificar se existe leg pausado
    const pausedLeg = trip.legs.find(leg => leg.status === 'PAUSED' && leg.type === 'AGUARDANDO');
    
    if (pausedLeg) {
      if (pausedLeg.waitingType === 'LOADING') {
        return { text: 'Carregando', color: 'bg-purple-100 text-purple-800' };
      } else if (pausedLeg.waitingType === 'UNLOADING') {
        return { text: 'Descarregando', color: 'bg-indigo-100 text-indigo-800' };
      }
    }

    // Se já descarregou, está retornando à garagem
    const stage = getTripWorkflowStage(trip);
    if (stage === 'returning') {
      return { text: 'Retornando à garagem', color: 'bg-blue-100 text-blue-800' };
    }

    return { text: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800' };
  };

  const isTripPaused = (trip: Trip): boolean => {
    if (!trip.legs || trip.legs.length === 0) return false;
    return trip.legs.some(leg => leg.status === 'PAUSED' && leg.type === 'AGUARDANDO');
  };

  const getTripWorkflowStage = (trip: Trip): 'initial' | 'delivering' | 'returning' => {
    if (!trip.legs || trip.legs.length === 0) return 'initial';
    
    // Verificar se já completou o carregamento
    const hasCompletedLoading = trip.legs.some(
      leg => leg.type === 'AGUARDANDO' && 
             leg.waitingType === 'LOADING' && 
             leg.status === 'COMPLETED'
    );
    
    // Verificar se já completou o descarregamento
    const hasCompletedUnloading = trip.legs.some(
      leg => leg.type === 'AGUARDANDO' && 
             leg.waitingType === 'UNLOADING' && 
             leg.status === 'COMPLETED'
    );
    
    if (hasCompletedUnloading) return 'returning'; // Após descarregar, retornando para garagem
    if (hasCompletedLoading) return 'delivering'; // Após carregar, indo para destino
    return 'initial'; // Ainda não carregou
  };

  const handleStartTrip = async (trip: Trip) => {
    // Buscar info do caminhão para saber se é sem capacidade
    try {
      const truck = await trucksAPI.getById(trip.truck.id);
      if (truck.noCapacity) {
        // Buscar carretas disponíveis
        const trailersList = await trailersAPI.getAll();
        setTrailers(trailersList);
        setTripToStart(trip);
        setShowTrailerModal(true);
        setSelectedTrailerId('');
        return;
      }
      // Caminhão com capacidade: inicia direto
      await tripsAPI.start(trip.id);
      toast.success('Viagem iniciada com sucesso!');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao iniciar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao iniciar viagem');
    }
  };

  const handleConfirmTrailer = async () => {
    if (!selectedTrailerId) {
      toast.error('Selecione uma carreta para iniciar a viagem');
      return;
    }
    if (!tripToStart) return;
    try {
      await tripsAPI.start(tripToStart.id, { trailerId: selectedTrailerId });
      toast.success('Viagem iniciada com sucesso!');
      setShowTrailerModal(false);
      setTripToStart(null);
      setSelectedTrailerId('');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao iniciar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao iniciar viagem');
    }
  };

  const handleOpenFinishModal = (trip: Trip) => {
    setTripToFinish(trip);
    setFinalMileage('');
    setShowFinishModal(true);
  };

  const handleFinishTrip = async () => {
    if (!tripToFinish) return;
    
    if (!finalMileage || parseFloat(finalMileage) <= 0) {
      toast.error('Informe a quilometragem final do caminhão');
      return;
    }

    try {
      await tripsAPI.finish(tripToFinish.id, { endMileage: parseFloat(finalMileage) });
      
      toast.success('Viagem concluída com sucesso!');
      setShowFinishModal(false);
      setTripToFinish(null);
      setFinalMileage('');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao concluir viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao concluir viagem');
    }
  };

  const handleOpenExpenseModal = (trip: Trip) => {
    setTripForExpense(trip);
    setExpenseData({
      type: 'FUEL',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
    setShowExpenseModal(true);
  };

  const handleCreateExpense = async () => {
    if (!tripForExpense) return;
    
    if (!expenseData.amount || parseFloat(expenseData.amount) <= 0) {
      toast.error('Informe o valor da despesa');
      return;
    }

    if (!expenseData.description.trim()) {
      toast.error('Informe a descrição da despesa');
      return;
    }

    try {
      await expensesAPI.create({
        ...expenseData,
        amount: parseFloat(expenseData.amount),
        truckId: tripForExpense.truck.id,
        tripId: tripForExpense.id,
      });
      
      toast.success('Despesa adicionada com sucesso!');
      setShowExpenseModal(false);
      setTripForExpense(null);
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao criar despesa:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar despesa');
    }
  };

  const handleOpenPauseModal = (trip: Trip, type: 'LOADING' | 'UNLOADING') => {
    setTripToPause(trip);
    setPauseMileage('');
    setPauseLocation(trip.destination || '');
    setWaitingType(type);
    setShowPauseModal(true);
  };

  const handlePauseTrip = async () => {
    if (!tripToPause) return;
    
    if (!pauseMileage || parseFloat(pauseMileage) <= 0) {
      toast.error('Informe a quilometragem atual do caminhão');
      return;
    }

    if (!pauseLocation.trim()) {
      toast.error('Informe o local onde o carreto ficará');
      return;
    }

    try {
      await tripsAPI.pause(tripToPause.id, {
        currentMileage: parseFloat(pauseMileage),
        location: pauseLocation,
        waitingType,
      });
      
      const successMessage = waitingType === 'LOADING' 
        ? 'Carreto deixado para carregamento. Você pode iniciar outra viagem!'
        : 'Carreto deixado para descarregamento. Você pode iniciar outra viagem!';
      
      toast.success(successMessage);
      setShowPauseModal(false);
      setTripToPause(null);
      setPauseMileage('');
      setPauseLocation('');
      setWaitingType('LOADING');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao pausar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao pausar viagem');
    }
  };

  const handleResumeTrip = async (trip: Trip) => {
    try {
      await tripsAPI.resume(trip.id, {});
      
      const pausedLeg = trip.legs?.find(leg => leg.status === 'PAUSED' && leg.type === 'AGUARDANDO');
      const successMessage = pausedLeg?.waitingType === 'LOADING' 
        ? 'Carreta carregada! Continue para o destino.'
        : pausedLeg?.waitingType === 'UNLOADING'
        ? 'Carreta descarregada! Retornando à garagem.'
        : 'Viagem retomada!';
      
      toast.success(successMessage);
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao continuar viagem:', error);
      
      // Se o erro for sobre precisar informar quilometragem, abrir modal
      if (error.response?.data?.message?.includes('Informe a quilometragem atual')) {
        setTripToResumeWithMileage(trip);
        setResumeMileage('');
        setShowResumeMileageModal(true);
      } else {
        toast.error(error.response?.data?.message || 'Erro ao continuar viagem');
      }
    }
  };

  const handleResumeWithMileage = async () => {
    if (!tripToResumeWithMileage) return;
    
    if (!resumeMileage || parseFloat(resumeMileage) <= 0) {
      toast.error('Informe a quilometragem atual do caminhão');
      return;
    }

    try {
      await tripsAPI.resume(tripToResumeWithMileage.id, { 
        currentMileage: parseFloat(resumeMileage) 
      });
      
      const pausedLeg = tripToResumeWithMileage.legs?.find(leg => leg.status === 'PAUSED' && leg.type === 'AGUARDANDO');
      const successMessage = pausedLeg?.waitingType === 'LOADING' 
        ? 'Carreta carregada! Continue para o destino.'
        : pausedLeg?.waitingType === 'UNLOADING'
        ? 'Carreta descarregada! Retornando à garagem.'
        : 'Viagem retomada!';
      
      toast.success(successMessage);
      setShowResumeMileageModal(false);
      setTripToResumeWithMileage(null);
      setResumeMileage('');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao continuar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao continuar viagem');
    }
  };

  // Removidas funções handleOpenTrailerModal e handleCloseTrailerModal pois não são usadas

  // Separate trips by status for Kanban columns
  const plannedTrips = trips.filter(trip => trip.status === 'PLANNED');
  const inProgressTrips = trips.filter(trip => trip.status === 'IN_PROGRESS');
  const completedTrips = trips.filter(trip => trip.status === 'COMPLETED');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Viagens</h1>
        <div className="flex flex-col md:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full md:w-auto"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <Button onClick={() => navigate('/trips/new')} className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nova Viagem
            </Button>
          )}
        </div>
      </div>

      {/* Filtros avançados */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Código da Viagem</label>
                  <input
                    type="text"
                    list="trip-codes"
                    value={tripCodeFilter}
                    onChange={(e) => setTripCodeFilter(e.target.value)}
                    placeholder="Digite ou selecione"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  <datalist id="trip-codes">
                    {[...new Set(trips.map(t => t.tripCode).filter(Boolean))].map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Data Início</label>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Data Fim</label>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Cliente</label>
                  <select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Todos os clientes</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Motorista</label>
                  <select
                    value={driverFilter}
                    onChange={(e) => setDriverFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Todos os motoristas</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={fetchTrips}>
                  <Search className="mr-2 h-4 w-4" />
                  Aplicar Filtros
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTripCodeFilter('');
                    setStartDateFilter('');
                    setEndDateFilter('');
                    setClientFilter('');
                    setDriverFilter('');
                    fetchTrips();
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: PLANNED (Agendadas) - Blue */}
        <div className="bg-blue-50 rounded-lg p-4 min-h-[600px]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Agendadas</h3>
            <span className="text-sm bg-white px-2 py-1 rounded-full">
              {plannedTrips.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
            {plannedTrips.length === 0 ? (
              <Card className="bg-white/50">
                <CardContent className="p-5 text-center text-sm text-gray-500">
                  Nenhuma viagem agendada
                </CardContent>
              </Card>
            ) : (
              plannedTrips.map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-normal">
                              {trip.origin} → {trip.destination}
                            </p>
                            {trip.tripCode && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Código: {trip.tripCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 bg-blue-100 text-blue-800">
                          Agendada
                        </span>
                      </div>

                      {/* Trip Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Caminhão:</span>
                          <p className="font-medium uppercase">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium uppercase">{trip.trailer.plate}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Motorista:</span>
                          <p className="font-medium truncate">{trip.driver.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Cliente:</span>
                          <p className="font-medium truncate">{trip.client?.name || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Date and Distance in same line */}
                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <div>
                          <span className="text-gray-500">Início:</span>
                          <span className="font-medium ml-1">
                            {new Date(trip.startDate).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {trip.distance > 0 && (
                          <div>
                            <span className="text-gray-500">Distância:</span>
                            <span className="font-medium ml-1">{trip.distance.toFixed(0)} km</span>
                          </div>
                        )}
                      </div>

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Custos:</span>
                            <p className="font-medium text-red-600">
                              {formatCurrency(trip.totalCost)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Lucro:</span>
                            <p className="font-medium text-blue-600">
                              {formatCurrency(trip.profit)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {/* Botão Iniciar Viagem - Motorista */}
                        {user?.role === 'DRIVER' && trip.driver.id === user.id && (
                          <Button
                            size="sm"
                            onClick={() => handleStartTrip(trip)}
                            className="flex-1 min-w-[90px] text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Iniciar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/trips/${trip.id}`)}
                          className="flex-1 min-w-[70px] text-xs h-8"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Ver
                        </Button>
                        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/trips/${trip.id}/edit`)}
                              className="flex-1 min-w-[70px] text-xs h-8"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(trip.id)}
                              className="flex-1 min-w-[70px] text-xs h-8"
                            >
                              <MessageCircle className="w-3 h-3 mr-1" />
                              Avisar
                            </Button>
                            {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(trip.id)}
                                className="flex-1 min-w-[70px] text-xs h-8 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Excluir
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Column 2: IN_PROGRESS (Em Andamento) - Yellow */}
        <div className="bg-yellow-50 rounded-lg p-4 min-h-[600px]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Em Andamento</h3>
            <span className="text-sm bg-white px-2 py-1 rounded-full">
              {inProgressTrips.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
            {inProgressTrips.length === 0 ? (
              <Card className="bg-white/50">
                <CardContent className="p-5 text-center text-sm text-gray-500">
                  Nenhuma viagem em andamento
                </CardContent>
              </Card>
            ) : (
              inProgressTrips.map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-normal">
                              {trip.origin} → {trip.destination}
                            </p>
                            {trip.tripCode && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Código: {trip.tripCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 ${getTripDisplayStatus(trip).color}`}>
                          {getTripDisplayStatus(trip).text}
                        </span>
                      </div>

                      {/* Elapsed Time Badge */}
                      <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-1.5 rounded">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">
                          Tempo decorrido: {calculateElapsedTime(trip.startDate)}
                        </span>
                      </div>

                      {/* Trip Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Caminhão:</span>
                          <p className="font-medium uppercase">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium uppercase">{trip.trailer.plate}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Motorista:</span>
                          <p className="font-medium truncate">{trip.driver.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Cliente:</span>
                          <p className="font-medium truncate">{trip.client?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Início:</span>
                          <p className="font-medium">
                            {new Date(trip.startDate).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        {trip.distance > 0 && (
                          <div>
                            <span className="text-gray-500">Distância:</span>
                            <p className="font-medium">{trip.distance.toFixed(0)} km</p>
                          </div>
                        )}
                      </div>

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Custos:</span>
                            <p className="font-medium text-red-600">
                              {formatCurrency(trip.totalCost)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Lucro:</span>
                            <p className="font-medium text-blue-600">
                              {formatCurrency(trip.profit)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {/* Botões para Motorista da viagem */}
                        {user?.role === 'DRIVER' && trip.driver.id === user.id && (
                          <>
                            {isTripPaused(trip) ? (
                              // Botão contextual quando estiver pausado
                              <Button
                                size="sm"
                                onClick={() => handleResumeTrip(trip)}
                                className="flex-1 min-w-[100px] text-xs h-8 text-white"
                                style={{ backgroundColor: '#86efac', color: 'white' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4ade80'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#86efac'}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                {trip.legs?.find(leg => leg.status === 'PAUSED' && leg.waitingType === 'LOADING')
                                  ? 'Carreta carregada'
                                  : trip.legs?.find(leg => leg.status === 'PAUSED' && leg.waitingType === 'UNLOADING')
                                  ? 'Carreta descarregada'
                                  : 'Continuar'}
                              </Button>
                            ) : (
                              // Botões baseados no estágio do workflow
                              <>
                                {getTripWorkflowStage(trip) === 'initial' && (
                                  // Estágio inicial: só pode carregar (na origem)
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenPauseModal(trip, 'LOADING')}
                                    className="flex-1 min-w-[100px] text-xs h-8 text-white"
                                    style={{ backgroundColor: '#c084fc', color: 'white' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#a855f7'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#c084fc'}
                                  >
                                    <Package className="w-3 h-3 mr-1" />
                                    Carregar
                                  </Button>
                                )}
                                {getTripWorkflowStage(trip) === 'delivering' && (
                                  // Já carregou, indo para destino: só pode descarregar
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenPauseModal(trip, 'UNLOADING')}
                                    className="flex-1 min-w-[100px] text-xs h-8 text-white"
                                    style={{ backgroundColor: '#c084fc', color: 'white' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#a855f7'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#c084fc'}
                                  >
                                    <Package className="w-3 h-3 mr-1" />
                                    Descarregar
                                  </Button>
                                )}
                                {getTripWorkflowStage(trip) === 'returning' && (
                                  // Já descarregou, retornando: pode concluir
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenFinishModal(trip)}
                                    className="flex-1 min-w-[90px] text-xs h-8 text-white"
                                    style={{ backgroundColor: '#86efac', color: 'white' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4ade80'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#86efac'}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Concluir
                                  </Button>
                                )}
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenExpenseModal(trip)}
                              className="flex-1 min-w-[90px] text-xs h-8"
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              Despesa
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/trips/${trip.id}`)}
                          className="flex-1 min-w-[70px] text-xs h-8"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Ver
                        </Button>
                        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenExpenseModal(trip)}
                              className="flex-1 min-w-[90px] text-xs h-8"
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              Despesa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(trip.id)}
                              className="flex-1 min-w-[70px] text-xs h-8"
                            >
                              <MessageCircle className="w-3 h-3 mr-1" />
                              Avisar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(trip.id)}
                              className="flex-1 min-w-[70px] text-xs h-8 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Column 3: COMPLETED (Concluídas) - Green */}
        <div className="bg-green-50 rounded-lg p-4 min-h-[600px]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Concluídas</h3>
            <span className="text-sm bg-white px-2 py-1 rounded-full">
              {completedTrips.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
            {completedTrips.length === 0 ? (
              <Card className="bg-white/50">
                <CardContent className="p-5 text-center text-sm text-gray-500">
                  Nenhuma viagem concluída
                </CardContent>
              </Card>
            ) : (
              completedTrips.map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-normal">
                              {trip.origin} → {trip.destination}
                            </p>
                            {trip.tripCode && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Código: {trip.tripCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 bg-green-100 text-green-800">
                          Concluída
                        </span>
                      </div>

                      {/* Trip Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Caminhão:</span>
                          <p className="font-medium uppercase">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium uppercase">{trip.trailer.plate}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Motorista:</span>
                          <p className="font-medium truncate">{trip.driver.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Cliente:</span>
                          <p className="font-medium truncate">{trip.client?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Concluída em:</span>
                          <p className="font-medium">
                            {trip.endDate ? new Date(trip.endDate).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'N/A'}
                          </p>
                        </div>
                        {trip.distance > 0 && (
                          <div>
                            <span className="text-gray-500">Distância:</span>
                            <p className="font-medium">{trip.distance.toFixed(0)} km</p>
                          </div>
                        )}
                      </div>

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Custos:</span>
                            <p className="font-medium text-red-600">
                              {formatCurrency(trip.totalCost)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Lucro:</span>
                            <p className="font-medium text-blue-600">
                              {formatCurrency(trip.profit)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/trips/${trip.id}`)}
                          className="flex-1 min-w-[70px] text-xs h-8"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Ver
                        </Button>
                        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(trip.id)}
                            className="flex-1 min-w-[70px] text-xs h-8 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Excluir
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

    {/* Modal de Confirmação de Exclusão */}
    {showDeleteModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Confirmar Exclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-6">
              Tem certeza que deseja excluir esta viagem? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setTripToDelete(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Excluir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Confirmação de Envio de Lembrete */}
    {showReminderModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Enviar Lembrete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-6">
              Deseja enviar notificação do lembrete da viagem para o motorista?
            </p>
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowReminderModal(false);
                  setTripToRemind(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmSendReminder}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Enviar Lembrete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Conclusão de Viagem */}
    {showFinishModal && tripToFinish && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Concluir Viagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Viagem: <span className="font-medium">{tripToFinish.origin} → {tripToFinish.destination}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Caminhão: <span className="font-medium uppercase">{tripToFinish.truck.plate}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quilometragem Final do Caminhão *
                </label>
                <input
                  type="number"
                  value={finalMileage}
                  onChange={(e) => setFinalMileage(e.target.value)}
                  placeholder="Ex: 125500"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Informe a quilometragem atual do caminhão ao finalizar a viagem
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowFinishModal(false);
                  setTripToFinish(null);
                  setFinalMileage('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleFinishTrip}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Concluir Viagem
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Pausar Viagem (Deixar Carreto) */}
    {showPauseModal && tripToPause && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className={waitingType === 'LOADING' ? 'text-orange-600' : 'text-purple-600'}>
              {waitingType === 'LOADING' ? 'Deixar Carreto Carregando' : 'Deixar Carreto Descarregando'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Viagem: <span className="font-medium">{tripToPause.origin} → {tripToPause.destination}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Caminhão: <span className="font-medium uppercase">{tripToPause.truck.plate}</span>
                </p>
                {tripToPause.trailer && (
                  <p className="text-sm text-gray-600 mb-4">
                    Carreto: <span className="font-medium uppercase">{tripToPause.trailer.plate}</span>
                  </p>
                )}
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-xs text-yellow-800">
                  <strong>💡 Atenção:</strong> Ao deixar o carreto {waitingType === 'LOADING' ? 'carregando' : 'descarregando'}, você poderá iniciar outra viagem com o mesmo caminhão. O sistema criará automaticamente os trechos necessários.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quilometragem Atual do Caminhão *
                </label>
                <input
                  type="number"
                  value={pauseMileage}
                  onChange={(e) => setPauseMileage(e.target.value)}
                  placeholder="Ex: 50080"
                  min="0"
                  step="0.1"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${waitingType === 'LOADING' ? 'focus:ring-orange-500' : 'focus:ring-purple-500'}`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Local onde o carreto ficará *
                </label>
                <input
                  type="text"
                  value={pauseLocation}
                  onChange={(e) => setPauseLocation(e.target.value)}
                  placeholder="Ex: Cliente X - Endereço"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${waitingType === 'LOADING' ? 'focus:ring-orange-500' : 'focus:ring-purple-500'}`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Informe onde o caminhão está deixando o carreto para {waitingType === 'LOADING' ? 'carregamento' : 'descarregamento'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPauseModal(false);
                  setTripToPause(null);
                  setPauseMileage('');
                  setPauseLocation('');
                  setWaitingType('LOADING');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handlePauseTrip}
                className={waitingType === 'LOADING' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}
              >
                <Package className="w-4 h-4 mr-2" />
                {waitingType === 'LOADING' ? 'Deixar Carregando' : 'Deixar Descarregando'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Quilometragem ao Resumir Viagem */}
    {showResumeMileageModal && tripToResumeWithMileage && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Quilometragem Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Viagem: <span className="font-medium">{tripToResumeWithMileage.origin} → {tripToResumeWithMileage.destination}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Caminhão: <span className="font-medium uppercase">{tripToResumeWithMileage.truck.plate}</span>
                </p>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>💡 Atenção:</strong> O caminhão participou de outras viagens enquanto a carreta estava aguardando. Informe a quilometragem atual do caminhão para continuarmos.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quilometragem Atual do Caminhão *
                </label>
                <input
                  type="number"
                  value={resumeMileage}
                  onChange={(e) => setResumeMileage(e.target.value)}
                  placeholder="Ex: 50150"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Informe a quilometragem atual do caminhão ao retomar a viagem
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowResumeMileageModal(false);
                  setTripToResumeWithMileage(null);
                  setResumeMileage('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleResumeWithMileage}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="w-4 h-4 mr-2" />
                Continuar Viagem
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Adicionar Despesa */}
    {showExpenseModal && tripForExpense && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Adicionar Despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Viagem: <span className="font-medium">{tripForExpense.origin} → {tripForExpense.destination}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Caminhão: <span className="font-medium">{tripForExpense.truck.plate}</span>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Despesa *
                </label>
                <select
                  value={expenseData.type}
                  onChange={(e) => setExpenseData({ ...expenseData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FUEL">Combustível</option>
                  <option value="TOLL">Pedágio</option>
                  <option value="MAINTENANCE">Manutenção</option>
                  <option value="TIRE">Pneus</option>
                  <option value="FOOD">Alimentação</option>
                  <option value="PARKING">Estacionamento</option>
                  <option value="INSURANCE">Seguro</option>
                  <option value="TAX">Impostos</option>
                  {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                    <>
                      <option value="SALARY">Salário</option>
                      <option value="OVERTIME">Hora Extra</option>
                    </>
                  )}
                  <option value="OTHER">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  value={expenseData.amount}
                  onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                  placeholder="Ex: 500.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição *
                </label>
                <textarea
                  value={expenseData.description}
                  onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                  placeholder="Descreva a despesa"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data *
                </label>
                <input
                  type="date"
                  value={expenseData.date}
                  onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowExpenseModal(false);
                  setTripForExpense(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleCreateExpense}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Adicionar Despesa
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Seleção de Carreta ao Iniciar Viagem */}
    {showTrailerModal && (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={() => {
          setShowTrailerModal(false);
          setTripToStart(null);
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
                setTripToStart(null);
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
              <Button onClick={handleConfirmTrailer}>
                <Play className="w-4 h-4 mr-2" />
                Iniciar Viagem
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    </div>
  );
}
