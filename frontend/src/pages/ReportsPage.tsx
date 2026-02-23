import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { reportsAPI, trucksAPI, driversAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  DollarSign,
  Filter,
  Download,
  Send,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';

interface ReportItem {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  description: string;
  tripCode?: string;
  category: string;
  amount: number;
  revenue?: number;
  cost?: number;
  profit?: number;
  isTrip: boolean;
  expenseType?: string;
  truck?: {
    id: string;
    plate: string;
  };
  driver?: {
    id: string;
    name: string;
  };
}

interface ReportData {
  items: ReportItem[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    profit: number;
    itemCount: number;
  };
}

const ReportsPage: React.FC = () => {
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [sending, setSending] = useState(false);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  // Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [tripCodeFilter, setTripCodeFilter] = useState('');
  const [truckFilter, setTruckFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'driver' | 'income' | 'expense'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Carregar dados iniciais (últimos 30 dias)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    
    // Carregar trucks e drivers para filtros
    loadFiltersData();
    fetchReportData();
  }, []);

  const loadFiltersData = async () => {
    try {
      const [trucksData, driversData] = await Promise.all([
        trucksAPI.getAll(),
        driversAPI.getAll(),
      ]);
      setTrucks(trucksData);
      setDrivers(driversData);
    } catch (error) {
      console.error('Erro ao carregar filtros:', error);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (tripCodeFilter) params.tripCode = tripCodeFilter;
      if (truckFilter) params.truckId = truckFilter;
      if (driverFilter) params.driverId = driverFilter;

      const data = await reportsAPI.getFinancial(params);
      
      // Aplicar ordenação local
      const sortedItems = [...data.items].sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'date':
            comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
            break;
          case 'driver':
            comparison = (a.driver?.name || '').localeCompare(b.driver?.name || '');
            break;
          case 'income':
            comparison = (a.type === 'INCOME' ? a.amount : 0) - (b.type === 'INCOME' ? b.amount : 0);
            break;
          case 'expense':
            comparison = (a.type === 'EXPENSE' ? a.amount : 0) - (b.type === 'EXPENSE' ? b.amount : 0);
            break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
      
      setReportData({ ...data, items: sortedItems });
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
      alert('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchReportData();
  };

  const handleClearFilters = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    setTypeFilter('ALL');
    setTripCodeFilter('');
    setTruckFilter('');
    setDriverFilter('');
    setSortBy('date');
    setSortOrder('desc');
    
    setTimeout(fetchReportData, 100);
  };

  const handleSendReport = async () => {
    if (!reportRef.current) return;

    try {
      setSending(true);

      // Usar html2canvas para capturar screenshot
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      // Converter canvas para JPEG base64
      const imageData = canvas.toDataURL('image/jpeg', 0.9);

      // Enviar para o backend
      await reportsAPI.sendWebhook({
        imageData,
        filters: {
          startDate,
          endDate,
          type: typeFilter,
          tripCode: tripCodeFilter,
        },
      });

      alert('Relatório enviado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao enviar relatório:', error);
      alert(error.response?.data?.message || 'Erro ao enviar relatório');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!reportRef.current) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      // Baixar como JPEG
      const link = document.createElement('a');
      link.download = `relatorio-${new Date().toISOString().split('T')[0]}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (error) {
      console.error('Erro ao baixar relatório:', error);
      alert('Erro ao baixar relatório');
    }
  };

  if (loading && !reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Relatório Financeiro
          </h1>
          <p className="text-sm md:text-base text-gray-500">
            Visualize e exporte relatórios de receitas e despesas
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full md:w-auto touch-manipulation"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadReport}
            disabled={!reportData}
            className="w-full md:w-auto touch-manipulation"
          >
            <Download className="mr-2 h-4 w-4" />
            Baixar
          </Button>
          <Button
            onClick={handleSendReport}
            disabled={sending || !reportData}
            className="w-full md:w-auto bg-green-600 hover:bg-green-700 touch-manipulation"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? 'Enviando...' : 'Enviar via Webhook'}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Filter className="h-4 w-4 md:h-5 md:w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                >
                  <option value="ALL">Todos</option>
                  <option value="INCOME">Somente Entradas</option>
                  <option value="EXPENSE">Somente Saídas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código Viagem
                </label>
                <input
                  type="text"
                  value={tripCodeFilter}
                  onChange={(e) => setTripCodeFilter(e.target.value)}
                  placeholder="Filtrar por código..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caminhão
                </label>
                <select
                  value={truckFilter}
                  onChange={(e) => setTruckFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                >
                  <option value="">Todos os Caminhões</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plate} - {truck.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motorista
                </label>
                <select
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                >
                  <option value="">Todos os Motoristas</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ordenar Por
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                >
                  <option value="date">Data</option>
                  <option value="driver">Motorista</option>
                  <option value="income">Entradas</option>
                  <option value="expense">Saídas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ordem
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                >
                  <option value="desc">Decrescente</option>
                  <option value="asc">Crescente</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-2 mt-4">
              <Button
                onClick={handleApplyFilters}
                disabled={loading}
                className="w-full md:w-auto touch-manipulation"
              >
                <Search className="mr-2 h-4 w-4" />
                Aplicar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full md:w-auto touch-manipulation"
              >
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Área capturável para screenshot */}
      <div ref={reportRef} className="space-y-4 md:space-y-6 bg-white p-4 md:p-6 rounded-lg">
        {/* Cards de Resumo */}
        {reportData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center">
                  <ArrowUpCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600 flex-shrink-0" />
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm font-medium text-gray-600">Total Entradas</p>
                    <p className="text-lg md:text-2xl font-bold text-green-700">
                      {formatCurrency(reportData.summary.totalIncome)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center">
                  <ArrowDownCircle className="h-6 w-6 md:h-8 md:w-8 text-red-600 flex-shrink-0" />
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm font-medium text-gray-600">Total Saídas</p>
                    <p className="text-lg md:text-2xl font-bold text-red-700">
                      {formatCurrency(reportData.summary.totalExpense)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center">
                  <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm font-medium text-gray-600">Lucro</p>
                    <p className={`text-lg md:text-2xl font-bold ${
                      reportData.summary.profit >= 0 ? 'text-blue-700' : 'text-red-700'
                    }`}>
                      {formatCurrency(reportData.summary.profit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-purple-600 flex-shrink-0" />
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm font-medium text-gray-600">Transações</p>
                    <p className="text-lg md:text-2xl font-bold text-purple-700">
                      {reportData.summary.itemCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela de Transações */}
        {reportData && (
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-base md:text-lg">Transações Detalhadas</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.items.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nenhuma transação encontrada para os filtros selecionados.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Tipo
                            </th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Data
                            </th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                              Código
                            </th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Descrição
                            </th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                              Motorista
                            </th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                              Caminhão
                            </th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                              Receita
                            </th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Custo
                            </th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                              Lucro
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reportData.items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-2 md:px-4 py-3 md:py-4 whitespace-nowrap">
                                {item.isTrip ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                    Viagem
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                    {item.expenseType === 'FUEL' && 'Combustível'}
                                    {item.expenseType === 'TOLL' && 'Pedágio'}
                                    {item.expenseType === 'MAINTENANCE' && 'Manutenção'}
                                    {item.expenseType === 'FOOD' && 'Alimentação'}
                                    {item.expenseType === 'ACCOMMODATION' && 'Hospedagem'}
                                    {item.expenseType === 'SALARY' && 'Salário'}
                                    {item.expenseType === 'OTHER' && 'Outro'}
                                    {!item.expenseType && 'Despesa'}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 md:px-4 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-900">
                                {new Date(item.date).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-2 md:px-4 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500 hidden lg:table-cell">
                                {item.tripCode || '-'}
                              </td>
                              <td className="px-2 md:px-4 py-3 md:py-4 text-xs md:text-sm text-gray-900 max-w-xs">
                                <div className="truncate" title={item.description}>
                                  {item.description}
                                </div>
                                {/* Mostrar informações extras em mobile */}
                                <div className="block md:hidden text-xs text-gray-500 mt-1">
                                  {item.driver?.name && <span className="block">{item.driver.name}</span>}
                                  {item.truck?.plate && <span className="block">{item.truck.plate}</span>}
                                </div>
                              </td>
                              <td className="px-2 md:px-4 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-700 hidden md:table-cell">
                                {item.driver?.name || '-'}
                              </td>
                              <td className="px-2 md:px-4 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-700 hidden sm:table-cell">
                                {item.truck?.plate || '-'}
                              </td>
                              <td className="px-2 md:px-4 py-3 md:py-4 whitespace-nowrap text-right text-xs md:text-sm font-medium text-green-700 hidden xl:table-cell">
                                {item.revenue ? formatCurrency(item.revenue) : '-'}
                              </td>
                              <td className="px-2 md:px-4 py-3 md:py-4 whitespace-nowrap text-right text-xs md:text-sm font-medium text-red-700">
                                {formatCurrency(item.cost || item.amount)}
                              </td>
                              <td className="px-2 md:px-4 py-3 md:py-4 whitespace-nowrap text-right text-xs md:text-sm font-medium text-blue-700 hidden lg:table-cell">
                                {item.profit !== undefined && item.profit !== null ? formatCurrency(item.profit) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
