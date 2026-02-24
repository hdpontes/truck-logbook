import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { tripsAPI, driversAPI, clientsAPI } from '@/lib/api';
import { Plus, Eye, Edit, Trash2, MapPin, MessageCircle, Filter, Search, Clock } from 'lucide-react';
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [tripToRemind, setTripToRemind] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Viagens - Kanban</h1>
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
                <CardContent className="p-4 text-center text-sm text-gray-500">
                  Nenhuma viagem agendada
                </CardContent>
              </Card>
            ) : (
              plannedTrips.map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-tight">
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
                          <p className="font-medium">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium">{trip.trailer.plate}</p>
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

                      <div className="text-xs">
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

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
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
                <CardContent className="p-4 text-center text-sm text-gray-500">
                  Nenhuma viagem em andamento
                </CardContent>
              </Card>
            ) : (
              inProgressTrips.map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-tight">
                              {trip.origin} → {trip.destination}
                            </p>
                            {trip.tripCode && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Código: {trip.tripCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 bg-yellow-100 text-yellow-800">
                          Em Andamento
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
                          <p className="font-medium">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium">{trip.trailer.plate}</p>
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

                      <div className="text-xs">
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

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
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
                            onClick={() => handleSendReminder(trip.id)}
                            className="flex-1 min-w-[70px] text-xs h-8"
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            Avisar
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
                <CardContent className="p-4 text-center text-sm text-gray-500">
                  Nenhuma viagem concluída
                </CardContent>
              </Card>
            ) : (
              completedTrips.map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-tight">
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
                          <p className="font-medium">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium">{trip.trailer.plate}</p>
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

                      <div className="text-xs">
                        <span className="text-gray-500">Concluída em:</span>
                        <span className="font-medium ml-1">
                          {trip.endDate ? new Date(trip.endDate).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </span>
                      </div>

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
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
    </div>
  );
}
