import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { tripsAPI, driversAPI, clientsAPI } from '@/lib/api';
import { Route, Plus, Eye, Edit, Trash2, MapPin, MessageCircle, Filter, Search } from 'lucide-react';
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
}

export default function TripsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [tripToRemind, setTripToRemind] = useState<string | null>(null);
  
  // Estados para filtros avançados
  const [showFilters, setShowFilters] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  
  // Dados para dropdowns
  const [clients, setClients] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    loadFiltersData();
    fetchTrips();
  }, []);

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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Viagens</h1>
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <Button onClick={() => navigate('/trips/new')} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Nova Viagem
          </Button>
        )}
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          size="sm"
          className="whitespace-nowrap"
        >
          Todas ({trips.length})
        </Button>
        <Button
          variant={filter === 'PLANNED' ? 'default' : 'outline'}
          onClick={() => setFilter('PLANNED')}
          size="sm"
          className="whitespace-nowrap"
        >
          Planejadas ({trips.filter(t => t.status === 'PLANNED').length})
        </Button>
        <Button
          variant={filter === 'IN_PROGRESS' ? 'default' : 'outline'}
          onClick={() => setFilter('IN_PROGRESS')}
          size="sm"
          className="whitespace-nowrap"
        >
          Em Andamento ({trips.filter(t => t.status === 'IN_PROGRESS').length})
        </Button>
        <Button
          variant={filter === 'COMPLETED' ? 'default' : 'outline'}
          onClick={() => setFilter('COMPLETED')}
          size="sm"
          className="whitespace-nowrap"
        >
          Concluídas ({trips.filter(t => t.status === 'COMPLETED').length})
        </Button>
      </div>

      {/* Filtros avançados */}
      <Card>
        <CardContent className="p-4">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full md:w-auto"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros Avançados'}
          </Button>

          {showFilters && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          )}
        </CardContent>
      </Card>

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
                trip.status === 'DELAYED' ? 'border-red-300 bg-red-50' : 
                trip.status === 'IN_PROGRESS' ? 'border-green-300 bg-green-50' : 
                trip.status === 'COMPLETED' ? 'border-blue-300 bg-blue-50' : ''
              }`}
            >
              <CardHeader className="pb-3 md:pb-4">
                <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 md:gap-3">
                      <MapPin className="h-4 w-4 md:h-5 md:w-5 text-gray-500 flex-shrink-0" />
                      <span className="text-base md:text-lg">{trip.origin} → {trip.destination}</span>
                    </div>
                    {trip.tripCode && (
                      <span className="text-xs text-gray-500 ml-6 md:ml-8">Código: {trip.tripCode}</span>
                    )}
                  </div>
                  <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap w-fit ${statusColors[trip.status]}`}>
                    {statusLabels[trip.status]}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Caminhão</p>
                    <p className="font-medium text-sm md:text-base">{trip.truck.plate}</p>
                    <p className="text-xs md:text-sm text-gray-500">{trip.truck.model}</p>
                  </div>
                  {trip.trailer && (
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Carreta</p>
                      <p className="font-medium text-sm md:text-base">{trip.trailer.plate}</p>
                      {trip.trailer.model && (
                        <p className="text-xs md:text-sm text-gray-500">{trip.trailer.model}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Motorista</p>
                    <p className="font-medium text-sm md:text-base truncate">{trip.driver.name}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Distância</p>
                    <p className="font-medium text-sm md:text-base">{trip.distance} km</p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs md:text-sm text-gray-600">Data</p>
                    <p className="font-medium text-sm md:text-base">
                      {new Date(trip.startDate).toLocaleDateString('pt-BR')}
                      {trip.endDate && ` - ${new Date(trip.endDate).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-3 md:mt-4 pt-3 md:pt-4 border-t gap-3">
                  <div className="grid grid-cols-2 md:flex md:gap-6 gap-3">
                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                      <div>
                        <p className="text-xs text-gray-600">Receita</p>
                        <p className="text-xs md:text-sm font-semibold text-green-600">{formatCurrency(trip.revenue)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-600">Custo</p>
                      <p className="text-xs md:text-sm font-semibold text-red-600">{formatCurrency(trip.totalCost)}</p>
                    </div>
                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                      <>
                        <div>
                          <p className="text-xs text-gray-600">Lucro</p>
                          <p className="text-xs md:text-sm font-semibold text-blue-600">{formatCurrency(trip.profit)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Margem</p>
                          <p className="text-xs md:text-sm font-semibold">{trip.profitMargin.toFixed(2)}%</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex space-x-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/trips/${trip.id}`)}
                      className="touch-manipulation"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && 
                     (trip.status === 'PLANNED' || trip.status === 'DELAYED') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/trips/${trip.id}/edit`)}
                        className="text-blue-600 hover:text-blue-700 touch-manipulation"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendReminder(trip.id)}
                        className="text-green-600 hover:text-green-700 touch-manipulation"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {(user?.role === 'ADMIN' || (user?.role === 'MANAGER' && trip.status === 'PLANNED')) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(trip.id)}
                        className="text-red-600 hover:text-red-700 touch-manipulation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
}
