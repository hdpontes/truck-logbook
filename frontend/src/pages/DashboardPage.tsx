import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { 
  Truck, 
  Route, 
  Receipt, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

export default function DashboardPage() {
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
      return response.performance;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl text-gray-600">Carregando...</div>
      </div>
    );
  }

  const overview = data?.stats;
  const trips = data?.recentTrips || [];

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
      label: 'Motoristas Ativos',
      value: overview?.totalDrivers || 0,
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

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingDown className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-800">Custo Total</h3>
          </div>
          <p className="text-3xl font-bold text-red-600">
            {formatCurrency(overview?.totalCost || 0)}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Viagens: {overview?.completedTrips || 0}
          </p>
        </div>
      </div>

      {/* Performance dos Caminhões */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Performance dos Caminhões
        </h3>
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
                <tr key={truck.truck.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-800">{truck.truck.plate}</p>
                      <p className="text-sm text-gray-600">
                        {truck.truck.brand} {truck.truck.model}
                      </p>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-800">
                    {truck.metrics.totalTrips}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-800">
                    {formatCurrency(truck.metrics.totalRevenue)}
                  </td>
                  <td className="text-right py-3 px-4">
                    <span
                      className={
                        truck.metrics.totalProfit > 0
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }
                    >
                      {formatCurrency(truck.metrics.totalProfit)}
                    </span>
                  </td>
                  <td className="text-right py-3 px-4">
                    <span
                      className={
                        truck.metrics.avgProfitMargin > 10
                          ? 'text-green-600'
                          : 'text-yellow-600'
                      }
                    >
                      {truck.metrics.avgProfitMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-800">
                    {truck.metrics.totalDistance.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
