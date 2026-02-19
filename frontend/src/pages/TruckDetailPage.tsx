import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trucksAPI, tripsAPI, expensesAPI, driversAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Wrench,
  TrendingUp,
  TrendingDown,
  Plus,
  Play,
  Square,
  Fuel,
  Receipt,
} from 'lucide-react';

export default function TruckDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isDriver = user?.role === 'DRIVER';

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledDate: '',
    origin: '',
    destination: '',
    driverId: '',
    expectedRevenue: '',
  });
  const [expenseForm, setExpenseForm] = useState({
    type: 'FUEL',
    amount: '',
    description: '',
    liters: '',
  });

  // Queries
  const { data: truckData, isLoading: loadingTruck } = useQuery({
    queryKey: ['truck', id],
    queryFn: async () => {
      const response = await trucksAPI.getById(id);
      return response.data;
    },
  });

  const { data: tripsData } = useQuery({
    queryKey: ['trips', id],
    queryFn: async () => {
      const response = await tripsAPI.getAll({ truckId: id });
      return response.data.trips;
    },
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const response = await driversAPI.getAll();
      return response.data.drivers;
    },
  });

  // Mutations
  const createTripMutation = useMutation({
    mutationFn: (data: any) => tripsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', id] });
      queryClient.invalidateQueries({ queryKey: ['truck', id] });
      setShowScheduleModal(false);
      setScheduleForm({
        scheduledDate: '',
        origin: '',
        destination: '',
        driverId: '',
        expectedRevenue: '',
      });
    },
  });

  const startTripMutation = useMutation({
    mutationFn: (tripId: string) => tripsAPI.start(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', id] });
    },
  });

  const finishTripMutation = useMutation({
    mutationFn: (tripId: string) => tripsAPI.finish(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', id] });
      queryClient.invalidateQueries({ queryKey: ['truck', id] });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: any) => expensesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck', id] });
      setShowExpenseModal(false);
      setExpenseForm({
        type: 'FUEL',
        amount: '',
        description: '',
        liters: '',
      });
    },
  });

  const handleScheduleTrip = () => {
    createTripMutation.mutate({
      truckId: id,
      driverId: scheduleForm.driverId,
      origin: scheduleForm.origin,
      destination: scheduleForm.destination,
      status: 'PLANNED',
      scheduledDate: new Date(scheduleForm.scheduledDate).toISOString(),
      expectedRevenue: parseFloat(scheduleForm.expectedRevenue),
    });
  };

  const handleAddExpense = () => {
    const expenseData: any = {
      truckId: id,
      type: expenseForm.type,
      amount: parseFloat(expenseForm.amount),
      description: expenseForm.description,
    };

    if (expenseForm.type === 'FUEL' && expenseForm.liters) {
      expenseData.liters = parseFloat(expenseForm.liters);
    }

    createExpenseMutation.mutate(expenseData);
  };

  if (loadingTruck) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl text-gray-600">Carregando...</div>
      </div>
    );
  }

  const truck = truckData?.truck;
  const stats = truckData?.stats;
  const activeTrip = tripsData?.find((t: any) => t.status === 'IN_PROGRESS');
  const plannedTrips = tripsData?.filter((t: any) => t.status === 'PLANNED') || [];
  const completedTrips = tripsData?.filter((t: any) => t.status === 'COMPLETED') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/trucks')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-gray-800">{truck?.plate}</h2>
          <p className="text-gray-600 mt-1">
            {truck?.brand} {truck?.model} - {truck?.year}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {isDriver ? 'Adicionar Abastecimento' : 'Adicionar Despesa'}
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Agendar Corrida
            </button>
          )}
        </div>
      </div>

      {/* Cards de Métricas - Apenas para ADMIN */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Faturamento</p>
                <p className="text-2xl font-bold text-gray-800">
                  R$ {stats?.totalRevenue?.toLocaleString('pt-BR') || '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Despesas</p>
                <p className="text-2xl font-bold text-gray-800">
                  R$ {stats?.totalExpenses?.toLocaleString('pt-BR') || '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Lucro</p>
                <p className="text-2xl font-bold text-gray-800">
                  R$ {stats?.totalProfit?.toLocaleString('pt-BR') || '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total de Viagens</p>
                <p className="text-2xl font-bold text-gray-800">{stats?.totalTrips || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corrida Ativa */}
      {activeTrip && (
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Corrida em Andamento</h3>
              <p className="text-green-100">
                {activeTrip.origin} → {activeTrip.destination}
              </p>
              <p className="text-sm text-green-100 mt-1">
                Motorista: {activeTrip.driver?.name}
              </p>
            </div>
            <button
              onClick={() => finishTripMutation.mutate(activeTrip.id)}
              disabled={finishTripMutation.isPending}
              className="flex items-center gap-2 bg-white text-green-600 px-6 py-3 rounded-lg hover:bg-green-50 transition-colors font-semibold"
            >
              <Square className="w-5 h-5" />
              Finalizar Corrida
            </button>
          </div>
        </div>
      )}

      {/* Corridas Agendadas */}
      {plannedTrips.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Corridas Agendadas</h3>
          <div className="space-y-3">
            {plannedTrips.map((trip: any) => (
              <div
                key={trip.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {trip.origin} → {trip.destination}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(trip.scheduledDate).toLocaleString('pt-BR')} - Motorista:{' '}
                    {trip.driver?.name}
                  </p>
                </div>
                <button
                  onClick={() => startTripMutation.mutate(trip.id)}
                  disabled={startTripMutation.isPending || !!activeTrip}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                >
                  <Play className="w-4 h-4" />
                  Iniciar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de Corridas */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Corridas Finalizadas</h3>
        {completedTrips.length > 0 ? (
          <div className="space-y-3">
            {completedTrips.slice(0, 5).map((trip: any) => (
              <div
                key={trip.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {trip.origin} → {trip.destination}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(trip.endDate).toLocaleDateString('pt-BR')} - Motorista:{' '}
                    {trip.driver?.name}
                  </p>
                </div>
                {isAdmin && (
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">
                      R$ {trip.revenue?.toLocaleString('pt-BR')}
                    </p>
                    <p
                      className={`text-sm ${
                        trip.profit > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      Lucro: R$ {trip.profit?.toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Nenhuma corrida finalizada</p>
        )}
      </div>

      {/* Modal de Agendamento */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Agendar Corrida</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e Hora
                </label>
                <input
                  type="datetime-local"
                  value={scheduleForm.scheduledDate}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                <input
                  type="text"
                  value={scheduleForm.origin}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, origin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Cidade de origem"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                <input
                  type="text"
                  value={scheduleForm.destination}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, destination: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Cidade de destino"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motorista</label>
                <select
                  value={scheduleForm.driverId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, driverId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um motorista</option>
                  {driversData?.map((driver: any) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faturamento Esperado (R$)
                </label>
                <input
                  type="number"
                  value={scheduleForm.expectedRevenue}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, expectedRevenue: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleScheduleTrip}
                disabled={createTripMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {createTripMutation.isPending ? 'Agendando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Despesa */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              {isDriver ? 'Adicionar Abastecimento' : 'Adicionar Despesa'}
            </h3>
            <div className="space-y-4">
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Despesa
                  </label>
                  <select
                    value={expenseForm.type}
                    onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="FUEL">Combustível</option>
                    <option value="TOLL">Pedágio</option>
                    <option value="MAINTENANCE">Manutenção</option>
                    <option value="OTHER">Outros</option>
                  </select>
                </div>
              )}

              {(expenseForm.type === 'FUEL' || isDriver) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Litros
                  </label>
                  <input
                    type="number"
                    value={expenseForm.liters}
                    onChange={(e) => setExpenseForm({ ...expenseForm, liters: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Detalhes da despesa"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                disabled={createExpenseMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
              >
                {createExpenseMutation.isPending ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
