import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { tripsAPI, trucksAPI, trailersAPI, driversAPI, clientsAPI } from '@/lib/api';
import { Eye, CheckCircle, XCircle, Clock, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

interface ReceivedTrip {
  id: string;
  tripCode?: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate?: string;
  distance: number;
  revenue: number;
  status: 'RECEIVED';
  notes?: string;
  client?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface Truck {
  id: string;
  plate: string;
  model: string;
}

interface Trailer {
  id: string;
  plate: string;
  model?: string;
}

interface Driver {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
  cnpj: string;
}

export default function ReceivedTripsPage() {
  const toast = useToast();
  
  const [trips, setTrips] = useState<ReceivedTrip[]>([]);
  const [allTrips, setAllTrips] = useState<ReceivedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [tripCodeFilter, setTripCodeFilter] = useState('');
  
  // Modal de detalhes/confirmação
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<ReceivedTrip | null>(null);
  
  // Dados para confirmação
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [confirmData, setConfirmData] = useState({
    truckId: '',
    trailerId: '',
    driverId: '',
    origin: '',
    destination: '',
    startDate: '',
    endDate: '',
    distance: 0,
    revenue: 0,
    notes: '',
  });
  
  // Modal de recusa
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Modal de sincronização
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncData, setSyncData] = useState({
    clientId: '',
    syncDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchReceivedTrips();
    fetchDropdownData();
  }, []);

  const fetchReceivedTrips = async () => {
    try {
      setLoading(true);
      const response = await tripsAPI.getAll({ status: 'RECEIVED' });
      setAllTrips(response);
      setTrips(response);
    } catch (error) {
      toast.error('Erro ao carregar viagens recebidas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const response = await tripsAPI.getAll({ status: 'RECEIVED' });
      setAllTrips(response);
      
      // Reaplicar filtros após atualizar os dados
      let filtered = [...response];

      if (tripCodeFilter) {
        filtered = filtered.filter(trip => 
          trip.tripCode?.toLowerCase().includes(tripCodeFilter.toLowerCase())
        );
      }

      if (clientFilter) {
        filtered = filtered.filter(trip => trip.client?.id === clientFilter);
      }

      if (startDateFilter) {
        filtered = filtered.filter(trip => {
          const tripDate = new Date(trip.startDate);
          const tripDateOnly = new Date(Date.UTC(tripDate.getUTCFullYear(), tripDate.getUTCMonth(), tripDate.getUTCDate()));
          
          const filterDate = new Date(startDateFilter);
          const filterDateOnly = new Date(Date.UTC(filterDate.getUTCFullYear(), filterDate.getUTCMonth(), filterDate.getUTCDate()));
          
          return tripDateOnly.getTime() === filterDateOnly.getTime();
        });
      }

      setTrips(filtered);
      toast.success('Lista atualizada com sucesso');
    } catch (error) {
      toast.error('Erro ao atualizar viagens');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [trucksRes, trailersRes, driversRes, clientsRes] = await Promise.all([
        trucksAPI.getAll(),
        trailersAPI.getAll(),
        driversAPI.getAll(),
        clientsAPI.getAll(),
      ]);
      setTrucks(trucksRes);
      setTrailers(trailersRes);
      setDrivers(driversRes);
      setClients(clientsRes);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...allTrips];

    // Filtro por código da viagem
    if (tripCodeFilter) {
      filtered = filtered.filter(trip => 
        trip.tripCode?.toLowerCase().includes(tripCodeFilter.toLowerCase())
      );
    }

    // Filtro por cliente
    if (clientFilter) {
      filtered = filtered.filter(trip => trip.client?.id === clientFilter);
    }

    // Filtro por data da viagem (comparar apenas data, ignorar horário)
    if (startDateFilter) {
      filtered = filtered.filter(trip => {
        // Extrair apenas a data (sem horário) da viagem usando UTC
        const tripDate = new Date(trip.startDate);
        const tripDateOnly = new Date(Date.UTC(tripDate.getUTCFullYear(), tripDate.getUTCMonth(), tripDate.getUTCDate()));
        
        // Data do filtro em UTC
        const filterDate = new Date(startDateFilter);
        const filterDateOnly = new Date(Date.UTC(filterDate.getUTCFullYear(), filterDate.getUTCMonth(), filterDate.getUTCDate()));
        
        return tripDateOnly.getTime() === filterDateOnly.getTime();
      });
    }

    setTrips(filtered);
  };

  const clearFilters = () => {
    setStartDateFilter('');
    setClientFilter('');
    setTripCodeFilter('');
    setTrips(allTrips); // Restaurar todas as viagens
  };

  const handleOpenDetails = (trip: ReceivedTrip) => {
    setSelectedTrip(trip);
    setConfirmData({
      truckId: '',
      trailerId: '',
      driverId: '',
      origin: trip.origin,
      destination: trip.destination,
      startDate: toDateTimeLocal(trip.startDate),
      endDate: toDateTimeLocal(trip.endDate),
      distance: trip.distance || 0,
      revenue: trip.revenue || 0,
      notes: trip.notes || '',
    });
    setShowDetailModal(true);
  };

  const handleConfirmTrip = async () => {
    if (!selectedTrip) return;

    if (!confirmData.truckId || !confirmData.driverId) {
      toast.error('Caminhão e motorista são obrigatórios');
      return;
    }

    try {
      await tripsAPI.confirmTrip(selectedTrip.id, confirmData);
      toast.success('Viagem confirmada com sucesso');
      setShowDetailModal(false);
      setSelectedTrip(null);
      fetchReceivedTrips();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao confirmar viagem');
    }
  };

  const handleOpenReject = () => {
    setShowDetailModal(false);
    setShowRejectModal(true);
  };

  const handleRejectTrip = async () => {
    if (!selectedTrip) return;

    if (!rejectionReason.trim()) {
      toast.error('Motivo da recusa é obrigatório');
      return;
    }

    try {
      await tripsAPI.rejectTrip(selectedTrip.id, { rejectionReason });
      toast.success('Viagem recusada');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedTrip(null);
      fetchReceivedTrips();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao recusar viagem');
    }
  };

  const handleSync = async () => {
    if (!syncData.clientId) {
      toast.error('Selecione um cliente');
      return;
    }

    if (!syncData.syncDate) {
      toast.error('Selecione uma data');
      return;
    }

    try {
      const selectedClient = clients.find(c => c.id === syncData.clientId);
      
      // Enviar requisição para o backend que disparará o webhook
      await tripsAPI.requestSync({
        clientId: syncData.clientId,
        clientName: selectedClient?.name,
        clientCnpj: selectedClient?.cnpj,
        syncDate: syncData.syncDate,
      });

      toast.success('Solicitação de sincronização enviada com sucesso');
      setShowSyncModal(false);
      setSyncData({
        clientId: '',
        syncDate: new Date().toISOString().split('T')[0],
      });
    } catch (error: any) {
      console.error('Erro ao solicitar sincronização:', error);
      toast.error(error.response?.data?.message || 'Erro ao solicitar sincronização');
    }
  };

  // Converter ISO string para formato datetime-local (YYYY-MM-DDTHH:mm)
  const toDateTimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Usar métodos UTC para evitar conversão de timezone
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'UTC', // Forçar UTC para exibir a hora correta (backend já aplica offset do Brasil)
    }).format(date);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Viagens Recebidas</h1>
          <p className="text-gray-600 mt-1">Viagens enviadas por sistemas externos aguardando confirmação</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <Button
            onClick={() => setShowSyncModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Painel de Filtros */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Código da Viagem</label>
                <input
                  type="text"
                  value={tripCodeFilter}
                  onChange={(e) => setTripCodeFilter(e.target.value)}
                  placeholder="Digite o código..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos os clientes</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data da Viagem</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                onClick={clearFilters}
                variant="outline"
                size="sm"
              >
                Limpar Filtros
              </Button>
              <Button
                onClick={applyFilters}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                Aplicar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : trips.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma viagem recebida</h3>
            <p className="text-gray-500">Não há viagens aguardando confirmação no momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trips.map((trip) => (
            <Card key={trip.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Cliente</p>
                      <p className="font-semibold">{trip.client?.name || 'Não informado'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Código da Viagem</p>
                      <p className="font-semibold">{trip.tripCode || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Data</p>
                      <p className="font-semibold">{formatDate(trip.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Valor</p>
                      <p className="font-semibold text-green-600">{formatCurrency(trip.revenue)}</p>
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      <Clock className="w-4 h-4 mr-1" />
                      Recebida
                    </span>
                    <Button
                      onClick={() => handleOpenDetails(trip)}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes/Confirmação */}
      {showDetailModal && selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold">Detalhes da Viagem</h2>
              <p className="text-gray-600">Código: {selectedTrip.tripCode}</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações do Cliente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Cliente</h3>
                <p>{selectedTrip.client?.name || 'Não informado'}</p>
              </div>

              {/* Campos do formulário */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caminhão * <span className="text-red-500">obrigatório</span>
                  </label>
                  <select
                    value={confirmData.truckId}
                    onChange={(e) => setConfirmData({ ...confirmData, truckId: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um caminhão</option>
                    {trucks.map(truck => (
                      <option key={truck.id} value={truck.id}>
                        {truck.plate} - {truck.model}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carreta</label>
                  <select
                    value={confirmData.trailerId}
                    onChange={(e) => setConfirmData({ ...confirmData, trailerId: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sem carreta</option>
                    {trailers.map(trailer => (
                      <option key={trailer.id} value={trailer.id}>
                        {trailer.plate} - {trailer.model || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motorista * <span className="text-red-500">obrigatório</span>
                  </label>
                  <select
                    value={confirmData.driverId}
                    onChange={(e) => setConfirmData({ ...confirmData, driverId: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um motorista</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                  <input
                    type="text"
                    value={confirmData.origin}
                    onChange={(e) => setConfirmData({ ...confirmData, origin: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                  <input
                    type="text"
                    value={confirmData.destination}
                    onChange={(e) => setConfirmData({ ...confirmData, destination: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora de Início</label>
                  <input
                    type="datetime-local"
                    value={confirmData.startDate}
                    onChange={(e) => setConfirmData({ ...confirmData, startDate: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora de Término</label>
                  <input
                    type="datetime-local"
                    value={confirmData.endDate}
                    onChange={(e) => setConfirmData({ ...confirmData, endDate: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distância (KM)</label>
                  <input
                    type="number"
                    value={confirmData.distance}
                    onChange={(e) => setConfirmData({ ...confirmData, distance: parseFloat(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={confirmData.revenue}
                    onChange={(e) => setConfirmData({ ...confirmData, revenue: parseFloat(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={confirmData.notes}
                    onChange={(e) => setConfirmData({ ...confirmData, notes: e.target.value })}
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedTrip(null);
                }}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleOpenReject}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Recusar Viagem
              </Button>
              <Button
                onClick={handleConfirmTrip}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Viagem
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recusa */}
      {showRejectModal && selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Recusar Viagem</h2>
              <p className="text-gray-600 text-sm mt-1">Código: {selectedTrip.tripCode}</p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo da Recusa *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="Descreva o motivo da recusa..."
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setShowDetailModal(true);
                }}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRejectTrip}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Confirmar Recusa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sincronização */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-blue-600">Sincronizar Viagens</h2>
              <p className="text-gray-600 text-sm mt-1">Solicitar sincronização de viagens do cliente</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente *
                </label>
                <select
                  value={syncData.clientId}
                  onChange={(e) => setSyncData({ ...syncData, clientId: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.cnpj}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data para Sincronização *
                </label>
                <input
                  type="date"
                  value={syncData.syncDate}
                  onChange={(e) => setSyncData({ ...syncData, syncDate: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Selecione a data a partir da qual deseja sincronizar as viagens
                </p>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                onClick={() => {
                  setShowSyncModal(false);
                  setSyncData({
                    clientId: '',
                    syncDate: new Date().toISOString().split('T')[0],
                  });
                }}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSync}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Solicitar Sincronização
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
