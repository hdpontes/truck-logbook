import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  Truck,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  ArrowUpCircle,
  AlertCircle,
  CheckCircle,
  Target,
  Percent,
  Wallet
} from 'lucide-react';
import { expensesAPI, recurringExpensesAPI, tripsAPI } from '@/services/api';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Expense {
  id: string;
  type: string;
  amount: number;
  date: string;
  isPaid?: boolean;
  recurringExpenseId?: string;
  truck?: { id: string; plate: string; };
  trip?: { id: string; origin: string; destination: string; };
}

interface RecurringExpense {
  id: string;
  type: string;
  amount: number;
  dueDay: number;
  description: string;
  status: string;
  truck?: { id: string; plate: string; };
}

interface Trip {
  id: string;
  revenue: number;
  status: string;
  startDate?: string;
  endDate?: string;
}

interface Receivable {
  id: string;
  amount: number;
  dueDate: string;
  paidAmount: number;
  status: string;
}

interface AnalysisData {
  totalMonth: number;
  totalPaid: number;
  totalScheduled: number;
  totalExpected: number;
  avgPerDay: number;
  predicted: number;
  variation: number;
  // Novos campos financeiros
  revenue: number;
  billing: number;
  receivables: number;
  profit: number;
  profitMargin: number;
  breakEven: number;
  roi: number;
  cashFlow: number;
  // Categorizações
  byCategory: { [key: string]: number };
  byTruck: { [key: string]: number };
  monthlyTrend: { month: string; amount: number }[];
  monthlyRevenue: { month: string; amount: number }[];
  dailyTrend: { day: string; amount: number; revenue: number; profit: number }[];
  topCategories: { category: string; amount: number; percentage: number }[];
}

export default function ExpensesAnalysisPage() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('monthly');
  const [analysisData, setAnalysisData] = useState<AnalysisData>({
    totalMonth: 0,
    totalPaid: 0,
    totalScheduled: 0,
    totalExpected: 0,
    avgPerDay: 0,
    predicted: 0,
    variation: 0,
    revenue: 0,
    billing: 0,
    receivables: 0,
    profit: 0,
    profitMargin: 0,
    breakEven: 0,
    roi: 0,
    cashFlow: 0,
    byCategory: {},
    byTruck: {},
    monthlyTrend: [],
    monthlyRevenue: [],
    dailyTrend: [],
    topCategories: [],
  });

  useEffect(() => {
    fetchExpenses();
    fetchRecurringExpenses();
    fetchTrips();
    fetchReceivables();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (expenses.length >= 0) {
      calculateAnalysis();
    }
  }, [expenses, recurringExpenses, trips, receivables]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await expensesAPI.getAll();
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecurringExpenses = async () => {
    try {
      const data = await recurringExpensesAPI.getAll({ status: 'ACTIVE' });
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      const data = await tripsAPI.getAll();
      setTrips(data);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const fetchReceivables = async () => {
    try {
      const response = await api.get('/receivables');
      setReceivables(response.data);
    } catch (error) {
      console.error('Error fetching receivables:', error);
    }
  };

  const calculateAnalysis = () => {
    const currentMonthExpenses = expenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date);
      return expenseDate.getMonth() === selectedMonth && 
             expenseDate.getFullYear() === selectedYear;
    });

    // Total de TODAS as despesas registradas no mês (independente de estarem pagas ou não)
    const totalMonth = currentMonthExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);

    // Total já pago:
    // - Despesas com isPaid = true (explicitamente pagas)
    // - Despesas sem recurringExpenseId (despesas avulsas/viagem são consideradas pagas)
    // - Despesas antigas sem flag isPaid (undefined) para compatibilidade
    const totalPaid = currentMonthExpenses
      .filter((e: Expense) => {
        // Se tem isPaid definido, usar esse valor
        if (e.isPaid !== undefined) {
          return e.isPaid === true;
        }
        // Se não tem isPaid (despesa antiga), considerar paga
        // EXCETO se for uma recorrente não paga (tem recurringExpenseId mas não foi marcada como paga)
        if (e.recurringExpenseId) {
          return false; // Recorrente sem isPaid = não paga ainda
        }
        // Despesa avulsa/viagem sem isPaid = considerada paga
        return true;
      })
      .reduce((sum: number, e: Expense) => sum + e.amount, 0);

    // Despesas recorrentes programadas para este mês (ainda não pagas)
    const now = new Date(selectedYear, selectedMonth + 1, 0);
    const daysInCurrentMonth = now.getDate();
    const scheduledThisMonth = recurringExpenses.filter((re: RecurringExpense) => {
      // Verifica se o dia de vencimento está dentro do mês
      return re.dueDay >= 1 && re.dueDay <= daysInCurrentMonth && re.status === 'ACTIVE';
    });

    // Verificar quais já foram pagas
    const totalScheduled = scheduledThisMonth.reduce((sum: number, re: RecurringExpense) => {
      // Verificar se já existe uma despesa paga para esta recorrente específica no mês/ano selecionado
      const alreadyPaid = expenses.some((e: Expense) => {
        const expenseDate = new Date(e.date);
        return e.recurringExpenseId === re.id && 
               expenseDate.getMonth() === selectedMonth &&
               expenseDate.getFullYear() === selectedYear;
      });
      return alreadyPaid ? sum : sum + re.amount;
    }, 0);

    // Total esperado = todas as despesas registradas + recorrentes não pagas
    const totalExpected = totalMonth + totalScheduled;

    // Média por dia
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const avgPerDay = totalMonth / daysInMonth;

    // Despesas por categoria
    const byCategory: { [key: string]: number } = {};
    currentMonthExpenses.forEach((e: Expense) => {
      byCategory[e.type] = (byCategory[e.type] || 0) + e.amount;
    });

    // Despesas por caminhão
    const byTruck: { [key: string]: number } = {};
    currentMonthExpenses.forEach((e: Expense) => {
      if (e.truck) {
        const key = e.truck.plate;
        byTruck[key] = (byTruck[key] || 0) + e.amount;
      }
    });

    // Tendência mensal (últimos 6 meses)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(selectedYear, selectedMonth - i, 1);
      const monthExpenses = expenses.filter((e: Expense) => {
        const ed = new Date(e.date);
        return ed.getMonth() === date.getMonth() && ed.getFullYear() === date.getFullYear();
      });
      const total = monthExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
      monthlyTrend.push({
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        amount: total,
      });
    }

    // Top categorias
    const topCategories = Object.entries(byCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / totalMonth) * 100,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Previsão (média dos últimos 3 meses)
    const lastThreeMonths = monthlyTrend.slice(-3);
    const predicted = lastThreeMonths.reduce((sum: number, m: any) => sum + m.amount, 0) / 3;

    // Variação (baseada no total esperado)
    const variation = predicted > 0 ? ((totalExpected - predicted) / predicted) * 100 : 0;

    // ========== CÁLCULOS FINANCEIROS ==========
    
    // Viagens do mês atual (completadas)
    const currentMonthTrips = trips.filter((t: Trip) => {
      if (!t.endDate) return false;
      const tripDate = new Date(t.endDate);
      return tripDate.getMonth() === selectedMonth && 
             tripDate.getFullYear() === selectedYear &&
             (t.status === 'COMPLETED' || t.status === 'FINISHED');
    });

    // Faturamento (viagens completadas)
    const billing = currentMonthTrips.reduce((sum: number, t: Trip) => sum + (t.revenue || 0), 0);

    // Recebimentos do mês (valores pagos)
    const currentMonthReceivables = receivables.filter((r: Receivable) => {
      const dueDate = new Date(r.dueDate);
      return dueDate.getMonth() === selectedMonth && 
             dueDate.getFullYear() === selectedYear;
    });

    const receivablesTotal = currentMonthReceivables.reduce((sum: number, r: Receivable) => 
      sum + (r.paidAmount || 0), 0
    );

    // Receita total = Faturamento + Recebimentos
    const revenue = billing + receivablesTotal;

    // Lucro = Receita - Despesas Totais Esperadas
    const profit = revenue - totalExpected;

    // Margem de lucro = (Lucro / Receita) * 100
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Break-even: quanto ainda precisa faturar para empatar
    const breakEven = totalExpected - revenue;

    // ROI = (Lucro / Investimento) * 100 (usando despesas como investimento)
    const roi = totalExpected > 0 ? (profit / totalExpected) * 100 : 0;

    // Fluxo de caixa = Receitas já recebidas - Despesas já pagas
    const cashFlow = receivablesTotal - totalPaid;

    // Tendência de receitas (últimos 6 meses)
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(selectedYear, selectedMonth - i, 1);
      
      // Viagens do mês
      const monthTrips = trips.filter((t: Trip) => {
        if (!t.endDate) return false;
        const td = new Date(t.endDate);
        return td.getMonth() === date.getMonth() && 
               td.getFullYear() === date.getFullYear() &&
               (t.status === 'COMPLETED' || t.status === 'FINISHED');
      });
      
      // Recebimentos do mês
      const monthReceivables = receivables.filter((r: Receivable) => {
        const rd = new Date(r.dueDate);
        return rd.getMonth() === date.getMonth() && rd.getFullYear() === date.getFullYear();
      });
      
      const monthBilling = monthTrips.reduce((sum: number, t: Trip) => sum + (t.revenue || 0), 0);
      const monthReceivablesTotal = monthReceivables.reduce((sum: number, r: Receivable) => 
        sum + (r.paidAmount || 0), 0
      );
      
      monthlyRevenue.push({
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        amount: monthBilling + monthReceivablesTotal,
      });
    }

    // Tendência diária (mês selecionado)
    const dailyTrend = [];
    const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    for (let day = 1; day <= daysInSelectedMonth; day++) {
      // Despesas do dia (incluindo todas as despesas registradas)
      const dayExpenses = expenses.filter((e: Expense) => {
        const ed = new Date(e.date);
        return ed.getDate() === day && 
               ed.getMonth() === selectedMonth && 
               ed.getFullYear() === selectedYear;
      });
      
      // Adicionar despesas recorrentes se caírem neste dia e ainda não foram pagas
      const recurringForDay = recurringExpenses.filter((re: RecurringExpense) => {
        if (re.dueDay !== day || re.status !== 'ACTIVE') return false;
        
        // Verificar se já foi paga neste dia
        const alreadyPaid = expenses.some((e: Expense) => {
          const ed = new Date(e.date);
          return e.recurringExpenseId === re.id && 
                 ed.getDate() === day &&
                 ed.getMonth() === selectedMonth &&
                 ed.getFullYear() === selectedYear;
        });
        
        return !alreadyPaid;
      });
      
      const dayExpensesTotal = dayExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
      const recurringTotal = recurringForDay.reduce((sum: number, re: RecurringExpense) => sum + re.amount, 0);
      const totalDayExpenses = dayExpensesTotal + recurringTotal;
      
      // Receitas do dia (viagens completadas)
      const dayTrips = trips.filter((t: Trip) => {
        if (!t.endDate) return false;
        const td = new Date(t.endDate);
        return td.getDate() === day && 
               td.getMonth() === selectedMonth && 
               td.getFullYear() === selectedYear &&
               (t.status === 'COMPLETED' || t.status === 'FINISHED');
      });
      
      // Recebimentos do dia
      const dayReceivables = receivables.filter((r: Receivable) => {
        const rd = new Date(r.dueDate);
        return rd.getDate() === day && 
               rd.getMonth() === selectedMonth && 
               rd.getFullYear() === selectedYear;
      });
      
      const dayRevenue = dayTrips.reduce((sum: number, t: Trip) => sum + (t.revenue || 0), 0) +
                        dayReceivables.reduce((sum: number, r: Receivable) => sum + (r.paidAmount || 0), 0);
      
      const dayProfit = dayRevenue - totalDayExpenses;
      
      dailyTrend.push({
        day: day.toString().padStart(2, '0'),
        amount: totalDayExpenses,
        revenue: dayRevenue,
        profit: dayProfit,
      });
    }

    setAnalysisData({
      totalMonth,
      totalPaid,
      totalScheduled,
      totalExpected,
      avgPerDay,
      predicted,
      variation,
      revenue,
      billing,
      receivables: receivablesTotal,
      profit,
      profitMargin,
      breakEven,
      roi,
      cashFlow,
      byCategory,
      byTruck,
      monthlyTrend,
      monthlyRevenue,
      dailyTrend,
      topCategories,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const categoryLabels: { [key: string]: string } = {
    FUEL: 'Combustível',
    TOLL: 'Pedágio',
    MAINTENANCE: 'Manutenção',
    TIRE: 'Pneus',
    FOOD: 'Alimentação',
    PARKING: 'Estacionamento',
    INSURANCE: 'Seguro',
    TAX: 'Impostos',
    SALARY: 'Salário',
    OVERTIME: 'Hora Extra',
    FINANCING: 'Financiamento',
    OTHER: 'Outros',
  };

  // Dados para gráfico de evolução mensal
  const monthlyTrendData = {
    labels: analysisData.monthlyTrend.map((m: any) => m.month),
    datasets: [
      {
        label: 'Despesas',
        data: analysisData.monthlyTrend.map((m: any) => m.amount),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Dados para gráfico de pizza (categorias)
  const categoryColors = [
    'rgba(239, 68, 68, 0.8)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(139, 92, 246, 0.8)',
  ];

  const categoryPieData = {
    labels: analysisData.topCategories.map((c: any) => categoryLabels[c.category] || c.category),
    datasets: [
      {
        data: analysisData.topCategories.map((c: any) => c.amount),
        backgroundColor: categoryColors,
        borderColor: categoryColors.map((c: string) => c.replace('0.8', '1')),
        borderWidth: 1,
      },
    ],
  };

  // Dados para gráfico de barras (top caminhões)
  const topTrucks = Object.entries(analysisData.byTruck)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  const truckBarData = {
    labels: topTrucks.map(([truck]) => truck),
    datasets: [
      {
        label: 'Despesas por Caminhão',
        data: topTrucks.map(([, amount]) => amount),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  // Gráfico comparativo: Receitas vs Despesas
  const revenueVsExpensesData = {
    labels: viewMode === 'daily' 
      ? analysisData.dailyTrend.map((d: any) => d.day)
      : analysisData.monthlyTrend.map((m: any) => m.month),
    datasets: [
      {
        label: 'Receitas',
        data: viewMode === 'daily'
          ? analysisData.dailyTrend.map((d: any) => d.revenue)
          : analysisData.monthlyRevenue.map((m: any) => m.amount),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Despesas',
        data: viewMode === 'daily'
          ? analysisData.dailyTrend.map((d: any) => d.amount)
          : analysisData.monthlyTrend.map((m: any) => m.amount),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Lucro',
        data: viewMode === 'daily'
          ? analysisData.dailyTrend.map((d: any) => d.profit)
          : analysisData.monthlyRevenue.map((m: any, i: number) => 
              m.amount - (analysisData.monthlyTrend[i]?.amount || 0)
            ),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Despesas</h1>
          <p className="text-gray-600">Insights e tendências dos seus gastos</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            {months.map((month, index) => (
              <option key={index} value={index}>{month}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            {[2024, 2025, 2026, 2027].map((year: number) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPIs Principais */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Resumo Financeiro do Mês</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900">Total do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{formatCurrency(analysisData.totalMonth)}</div>
              <p className="text-xs text-red-700">
                Todas as despesas registradas (pagas: {formatCurrency(analysisData.totalPaid)})
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-yellow-900">Recorrentes Não Pagas</CardTitle>
              <Calendar className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-700">{formatCurrency(analysisData.totalScheduled)}</div>
              <p className="text-xs text-yellow-700">
                Despesas recorrentes pendentes deste mês
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Total Previsto</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{formatCurrency(analysisData.totalExpected)}</div>
              <p className="text-xs text-blue-700">
                Todas as despesas do mês + Recorrentes não pagas
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KPIs de Rentabilidade e Saúde Financeira */}
      <div>
        <h2 className="text-lg font-semibold mb-3">📊 Rentabilidade e Saúde Financeira</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Faturamento */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Faturamento</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{formatCurrency(analysisData.billing)}</div>
              <p className="text-xs text-blue-700">
                Viagens completadas
              </p>
            </CardContent>
          </Card>

          {/* Recebimentos */}
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900">Recebimentos</CardTitle>
              <Wallet className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">{formatCurrency(analysisData.receivables)}</div>
              <p className="text-xs text-emerald-700">
                Valores já recebidos
              </p>
            </CardContent>
          </Card>

          {/* Receita Total */}
          <Card className="border-cyan-200 bg-cyan-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-cyan-900">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-700">{formatCurrency(analysisData.revenue)}</div>
              <p className="text-xs text-cyan-700">
                Faturamento + Recebimentos
              </p>
            </CardContent>
          </Card>

          {/* Lucro/Prejuízo */}
          <Card className={`border-2 ${analysisData.profit >= 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${analysisData.profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {analysisData.profit >= 0 ? 'Lucro' : 'Prejuízo'}
              </CardTitle>
              {analysisData.profit >= 0 ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analysisData.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(Math.abs(analysisData.profit))}
              </div>
              <p className={`text-xs ${analysisData.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Receita - Despesas
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Indicadores Adicionais */}
      <div>
        <h2 className="text-lg font-semibold mb-3">💡 Indicadores de Gestão</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Margem de Lucro */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
              <Percent className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analysisData.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analysisData.profitMargin.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {analysisData.profitMargin >= 20 ? 'Excelente' : analysisData.profitMargin >= 10 ? 'Bom' : analysisData.profitMargin >= 0 ? 'Atenção' : 'Crítico'}
              </p>
            </CardContent>
          </Card>

          {/* Break-Even */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Break-Even</CardTitle>
              <Target className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analysisData.breakEven <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {analysisData.breakEven <= 0 ? 'Alcançado!' : formatCurrency(analysisData.breakEven)}
              </div>
              <p className="text-xs text-muted-foreground">
                {analysisData.breakEven <= 0 ? 'Meta superada' : 'Falta faturar para empatar'}
              </p>
            </CardContent>
          </Card>

          {/* ROI */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analysisData.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analysisData.roi.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Retorno sobre investimento
              </p>
            </CardContent>
          </Card>

          {/* Fluxo de Caixa */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fluxo de Caixa</CardTitle>
              <Activity className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analysisData.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(analysisData.cashFlow))}
              </div>
              <p className="text-xs text-muted-foreground">
                {analysisData.cashFlow >= 0 ? 'Positivo' : 'Negativo'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KPIs Analíticos */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Indicadores de Análise</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Dia</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analysisData.avgPerDay)}</div>
              <p className="text-xs text-muted-foreground">
                Baseado em despesas pagas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Previsão Histórica</CardTitle>
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analysisData.predicted)}</div>
              <p className="text-xs text-muted-foreground">
                Média dos últimos 3 meses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Variação</CardTitle>
              {analysisData.variation >= 0 ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analysisData.variation >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {analysisData.variation >= 0 ? '+' : ''}{analysisData.variation.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Total previsto vs. histórico
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receitas vs Despesas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                {viewMode === 'daily' 
                  ? `Receitas vs Despesas (${months[selectedMonth]} ${selectedYear} - Por Dia)`
                  : 'Receitas vs Despesas (Últimos 6 Meses)'
                }
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={viewMode === 'monthly' ? 'default' : 'outline'}
                  onClick={() => setViewMode('monthly')}
                  className="text-xs"
                >
                  Por Mês
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'daily' ? 'default' : 'outline'}
                  onClick={() => setViewMode('daily')}
                  className="text-xs"
                >
                  Por Dia
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={revenueVsExpensesData} options={chartOptions} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  {viewMode === 'daily' ? 'Receita do Mês' : 'Receita Média'}
                </p>
                <p className="text-lg font-bold text-green-600">
                  {viewMode === 'daily'
                    ? formatCurrency(analysisData.dailyTrend.reduce((sum: number, d: any) => sum + d.revenue, 0))
                    : formatCurrency(analysisData.monthlyRevenue.reduce((sum: number, m: any) => sum + m.amount, 0) / analysisData.monthlyRevenue.length)
                  }
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  {viewMode === 'daily' ? 'Despesa do Mês' : 'Despesa Média'}
                </p>
                <p className="text-lg font-bold text-red-600">
                  {viewMode === 'daily'
                    ? formatCurrency(analysisData.dailyTrend.reduce((sum: number, d: any) => sum + d.amount, 0))
                    : formatCurrency(analysisData.monthlyTrend.reduce((sum: number, m: any) => sum + m.amount, 0) / analysisData.monthlyTrend.length)
                  }
                </p>
              </div>
              <div className={`p-3 rounded-lg ${analysisData.profit >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <p className="text-sm text-gray-600">
                  {viewMode === 'daily' ? 'Lucro do Mês' : 'Saldo Médio'}
                </p>
                <p className={`text-lg font-bold ${analysisData.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {viewMode === 'daily'
                    ? formatCurrency(analysisData.dailyTrend.reduce((sum: number, d: any) => sum + d.profit, 0))
                    : formatCurrency((analysisData.monthlyRevenue.reduce((sum: number, m: any) => sum + m.amount, 0) - analysisData.monthlyTrend.reduce((sum: number, m: any) => sum + m.amount, 0)) / 6)
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evolução Mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Despesas - Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={monthlyTrendData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Despesas por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {analysisData.topCategories.length > 0 ? (
                <Doughnut data={categoryPieData} options={chartOptions} />
              ) : (
                <p className="text-center text-gray-500 py-20">Nenhuma despesa neste período</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Caminhões */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Top 5 Caminhões (Despesas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topTrucks.length > 0 ? (
                <Bar data={truckBarData} options={chartOptions} />
              ) : (
                <p className="text-center text-gray-500 py-20">Nenhuma despesa vinculada a caminhões</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Categorias */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {analysisData.topCategories.length > 0 ? (
                <table className="w-full">
                  <thead className="text-sm border-b">
                    <tr>
                      <th className="text-left py-2">Categoria</th>
                      <th className="text-right py-2">Total</th>
                      <th className="text-right py-2">%</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {analysisData.topCategories.map((cat, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">{categoryLabels[cat.category] || cat.category}</td>
                        <td className="text-right font-medium">{formatCurrency(cat.amount)}</td>
                        <td className="text-right text-gray-600">{cat.percentage.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500 py-10">Nenhuma despesa neste período</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Insights e Recomendações Financeiras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Insight de Lucro/Prejuízo */}
            {analysisData.profit >= 0 ? (
              <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                <p className="text-sm text-green-900">
                  <strong>🎉 Excelente!</strong> A empresa está operando com <strong>LUCRO</strong> de {formatCurrency(analysisData.profit)} neste mês.
                  {analysisData.profitMargin >= 20 && ' Margem de lucro excelente!'}
                  {analysisData.profitMargin >= 10 && analysisData.profitMargin < 20 && ' Margem de lucro saudável.'}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                <p className="text-sm text-red-900">
                  <strong>⚠️ ATENÇÃO:</strong> A empresa está operando no <strong>PREJUÍZO</strong> de {formatCurrency(Math.abs(analysisData.profit))} neste mês.
                  É necessário aumentar o faturamento em {formatCurrency(analysisData.breakEven)} para alcançar o ponto de equilíbrio.
                </p>
              </div>
            )}

            {/* Insight de Break-Even */}
            {analysisData.breakEven > 0 && analysisData.profit < 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  🎯 <strong>Meta:</strong> Para empatar custos, a empresa precisa faturar mais {formatCurrency(analysisData.breakEven)}. 
                  Isso representa {((analysisData.breakEven / analysisData.totalExpected) * 100).toFixed(1)}% das despesas atuais.
                </p>
              </div>
            )}

            {/* Insight de Margem de Lucro */}
            {analysisData.profitMargin < 10 && analysisData.profitMargin > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Margem Baixa:</strong> A margem de lucro de {analysisData.profitMargin.toFixed(2)}% está abaixo do ideal (mínimo 10%). 
                  Considere reduzir custos ou aumentar preços.
                </p>
              </div>
            )}

            {/* Insight de Fluxo de Caixa */}
            {analysisData.cashFlow < 0 && (
              <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg">
                <p className="text-sm text-pink-800">
                  💸 <strong>Fluxo de Caixa Negativo:</strong> Você gastou {formatCurrency(Math.abs(analysisData.cashFlow))} a mais do que recebeu. 
                  Priorize cobranças de recebíveis pendentes.
                </p>
              </div>
            )}

            {/* Insight de ROI */}
            {analysisData.roi < 0 && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm text-indigo-800">
                  📉 <strong>ROI Negativo:</strong> O retorno sobre investimento está em {analysisData.roi.toFixed(2)}%. 
                  Revise a eficiência operacional e busque otimizar processos.
                </p>
              </div>
            )}

            {analysisData.variation > 10 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  ⚠️ <strong>Alerta:</strong> Despesas {analysisData.variation.toFixed(1)}% acima do previsto. 
                  Revise os gastos de {categoryLabels[analysisData.topCategories[0]?.category] || 'principal categoria'}.
                </p>
              </div>
            )}
            
            {analysisData.variation < -10 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ <strong>Ótimo!</strong> Despesas {Math.abs(analysisData.variation).toFixed(1)}% abaixo do previsto. 
                  Continue monitorando para manter essa economia.
                </p>
              </div>
            )}

            {analysisData.topCategories.length > 0 && analysisData.topCategories[0].percentage > 50 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  💡 <strong>Dica:</strong> {categoryLabels[analysisData.topCategories[0].category]} representa {analysisData.topCategories[0].percentage.toFixed(1)}% 
                  dos gastos. Considere negociar melhores condições com fornecedores.
                </p>
              </div>
            )}

            {topTrucks.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  📊 <strong>Destaque:</strong> Caminhão {topTrucks[0][0]} teve maior custo ({formatCurrency(topTrucks[0][1])}). 
                  Verifique se necessita manutenção preventiva.
                </p>
              </div>
            )}

            {analysisData.totalScheduled > 0 && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-800">
                  📅 <strong>Atenção:</strong> Há {formatCurrency(analysisData.totalScheduled)} em despesas recorrentes 
                  programadas para vencer ainda este mês. Garanta saldo disponível.
                </p>
              </div>
            )}

            {analysisData.totalScheduled === 0 && analysisData.totalPaid > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ <strong>Parabéns!</strong> Todas as despesas recorrentes programadas para este mês já foram quitadas.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
