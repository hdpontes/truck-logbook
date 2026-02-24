import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { dashboardAPI, tripsAPI, expensesAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { 
  Truck, 
  Route, 
  Receipt, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  const [selectedTruck, setSelectedTruck] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [truckDetails, setTruckDetails] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const response = await dashboardAPI.getOverview();
      return response;
    },
  });

  const { data: performance } = useQuery({
    queryKey: ['truck-performance'],
    queryFn: async () => {
      const response = await dashboardAPI.getTruckPerformance();
      return response;
    },
  });

  const handleTruckClick = async (truck: any) => {
    setSelectedTruck(truck);
    setShowModal(true);
    setModalLoading(true);
    setTruckDetails(null);

    try {
      // Buscar viagens completas do caminhão
      const trips = await tripsAPI.getByTruck(truck.truck.id);
      const completedTrips = trips.filter((t: any) => t.status === 'COMPLETED');
      
      // Buscar despesas do caminhão
      const expenses = await expensesAPI.getByTruck(truck.truck.id);
      
      // Agrupar despesas por tipo
      const expensesByType = expenses.reduce((acc: any, expense: any) => {
        const type = expense.type || 'OTHER';
        if (!acc[type]) {
          acc[type] = { type, total: 0, count: 0 };
        }
        acc[type].total += expense.amount;
        acc[type].count += 1;
        return acc;
      }, {});

      // Calcular totais
      const totalRevenue = completedTrips.reduce((sum: number, trip: any) => sum + (trip.revenue || 0), 0);
      const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
      const totalProfit = totalRevenue - totalExpenses;

      setTruckDetails({
        trips: completedTrips.length,
        totalRevenue,
        totalExpenses,
        totalProfit, 
        expensesByType: Object.values(expensesByType),
      });
    } catch (error) {
      console.error('Erro ao carregar detalhes do caminhão:', error);
    } finally {
      setModalLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl text-gray-600">Carregando...</div>
      </div>
    );
  }

  const overview = data?.stats;

  const metrics = [
    {
      label: 'Caminhões Ativos',
      value: overview?.totalTrucks || 0,
      icon: Truck,
      color: 'blue',
    },
    {
      label: 'Viagens Ativas',
      value: overview?.activeTrips || 0,
      icon: Route,
      color: 'green',
    },
    {
      label: 'Viagens Completas',
      value: overview?.completedTrips || 0,
      icon: Receipt,
      color: 'purple',
    },
    {
      label: 'Caminhões em Manutenção',
      value: overview?.trucksInMaintenance || 0,
      icon: AlertTriangle,
      color: 'yellow',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-gray-600 mt-1">Visão geral da sua frota</p>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
                  <p className="text-3xl font-bold text-gray-800">{metric.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-${metric.color}-100`}>
                  <Icon className={`w-8 h-8 text-${metric.color}-600`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-800">Receita Total</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(overview?.totalRevenue || 0)}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {overview?.completedTrips || 0} viagens realizadas
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingDown className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-800">Custo Total</h3>
          </div>
          <p className="text-3xl font-bold text-red-600">
            {formatCurrency(overview?.totalCost || 0)}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Todas as despesas
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">Lucro Total</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {formatCurrency(overview?.totalProfit || 0)}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Margem: {overview?.totalRevenue > 0 ? ((overview.totalProfit / overview.totalRevenue) * 100).toFixed(2) : 0}%
          </p>
        </div>
      </div>

      {/* Performance dos Caminhões */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Performance dos Caminhões
        </h3>
        {!performance || performance.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Nenhum dado de performance disponível. Complete algumas viagens para ver os dados aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Caminhão
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Viagens
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Receita
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Lucro
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Margem
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    KM
                  </th>
                </tr>
              </thead>
              <tbody>
              {performance?.map((truck: any) => (
                <tr 
                  key={truck.truck.id} 
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleTruckClick(truck)}
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-800">{truck.truck.plate}</p>
                      <p className="text-sm text-gray-600">
                        {truck.truck.brand} {truck.truck.model}
                      </p>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-800">
                    {truck.trips}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-800">
                    {formatCurrency(truck.totalRevenue)}
                  </td>
                  <td className="text-right py-3 px-4">
                    <span
                      className={
                        truck.totalProfit > 0
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }
                    >
                      {formatCurrency(truck.totalProfit)}
                    </span>
                  </td>
                  <td className="text-right py-3 px-4">
                    <span
                      className={
                        truck.avgProfitMargin > 10
                          ? 'text-green-600'
                          : 'text-yellow-600'
                      }
                    >
                      {truck.avgProfitMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-800">
                    {truck.totalDistance.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Modal de Detalhes do Caminhão */}
      {showModal && selectedTruck && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Detalhes do Caminhão</h2>
                <p className="text-gray-500 mt-1">
                  {selectedTruck.truck.plate} - {selectedTruck.truck.brand} {selectedTruck.truck.model}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              {modalLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900"></div>
                </div>
              ) : truckDetails ? (
                <div className="space-y-6">
                  {/* Cards de Resumo */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <Route className="h-8 w-8 text-blue-600" />
                          <div className="ml-3">
                            <p className="text-xs font-medium text-gray-600">Viagens</p>
                            <p className="text-xl font-bold text-blue-700">
                              {truckDetails.trips}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <TrendingUp className="h-8 w-8 text-green-600" />
                          <div className="ml-3">
                            <p className="text-xs font-medium text-gray-600">Receita</p>
                            <p className="text-xl font-bold text-green-700">
                              {formatCurrency(truckDetails.totalRevenue)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <TrendingDown className="h-8 w-8 text-red-600" />
                          <div className="ml-3">
                            <p className="text-xs font-medium text-gray-600">Custos</p>
                            <p className="text-xl font-bold text-red-700">
                              {formatCurrency(truckDetails.totalExpenses)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`border-2 ${truckDetails.totalProfit >= 0 ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <DollarSign className={`h-8 w-8 ${truckDetails.totalProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
                          <div className="ml-3">
                            <p className="text-xs font-medium text-gray-600">Lucro</p>
                            <p className={`text-xl font-bold ${truckDetails.totalProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                              {formatCurrency(truckDetails.totalProfit)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Custos por Tipo */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Custos por Tipo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {truckDetails.expensesByType.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {truckDetails.expensesByType.map((expense: any) => {
                                const expenseLabels: Record<string, string> = {
                                  FUEL: 'Combustível',
                                  TOLL: 'Pedágio',
                                  MAINTENANCE: 'Manutenção',
                                  FOOD: 'Alimentação',
                                  ACCOMMODATION: 'Hospedagem',
                                  TIRE: 'Pneus',
                                  REPAIR: 'Reparo',
                                  INSURANCE: 'Seguro',
                                  TAX: 'Imposto',
                                  PARKING: 'Estacionamento',
                                  SALARY: 'Salário',
                                  OTHER: 'Outros',
                                };
                                
                                return (
                                  <tr key={expense.type}>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                      {expenseLabels[expense.type] || expense.type}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                      {expense.count}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                                      {formatCurrency(expense.total)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-gray-50">
                              <tr>
                                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                  Total:
                                </td>
                                <td className="px-4 py-3 text-sm font-bold text-red-700 text-right">
                                  {formatCurrency(truckDetails.totalExpenses)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">Nenhuma despesa registrada para este caminhão.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
