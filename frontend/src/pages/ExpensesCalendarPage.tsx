import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar as CalendarIcon, 
  DollarSign,
  Truck,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  ExternalLink,
  Trash2,
  Route
} from 'lucide-react';
import { expensesAPI, recurringExpensesAPI } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import RecurringExpensesTab from '@/components/RecurringExpensesTab';

interface Expense {
  id: string;
  type: string;
  amount: number;
  description?: string;
  date: string;
  truckId?: string;
  tripId?: string;
  isPaid: boolean;
  recurringExpenseId?: string;
  truck?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  };
  trip?: {
    id: string;
    origin: string;
    destination: string;
  };
}

interface RecurringExpense {
  id: string;
  type: string;
  description: string;
  amount: number;
  dueDay: number;
  status: string;
  truckId?: string;
  totalInstallments?: number;
  paidInstallments: number;
  truck?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  };
}

export default function ExpensesCalendarPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  
  // Estado do calendário
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDayModal, setShowDayModal] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);

  // Modal de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Estatísticas do mês
  const [monthStats, setMonthStats] = useState({
    paid: 0,
    pending: 0,
    total: 0,
    paidCount: 0,
    pendingCount: 0,
  });

  useEffect(() => {
    fetchExpenses();
    fetchRecurringExpenses();
  }, []);

  useEffect(() => {
    if (currentDate) {
      calculateMonthStats();
    }
  }, [currentDate, expenses, recurringExpenses]);

  const fetchExpenses = async () => {
    try {
      const data = await expensesAPI.getAll();
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Erro ao carregar despesas');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setExpenseToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;

    try {
      await expensesAPI.delete(expenseToDelete);
      await fetchExpenses();
      toast.success('Despesa excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir despesa:', error);
      if (error.response?.status === 403) {
        toast.error(error.response?.data?.message || 'Você não tem permissão para excluir esta despesa.');
      } else {
        toast.error('Erro ao excluir despesa.');
      }
    } finally {
      setShowDeleteModal(false);
      setExpenseToDelete(null);
    }
  };

  const fetchRecurringExpenses = async () => {
    try {
      const data = await recurringExpensesAPI.getAll({ status: 'ACTIVE' });
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      toast.error('Erro ao carregar despesas recorrentes');
    }
  };

  const calculateMonthStats = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Despesas reais do mês
    const monthExpenses = expenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date);
      return expenseDate >= firstDay && expenseDate <= lastDay;
    });

    // Separar despesas pagas e pendentes considerando viagens/caminhões em dias passados
    const paidExpenses = monthExpenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date);
      expenseDate.setHours(0, 0, 0, 0);
      const isPastDay = expenseDate < today;
      
      // Se é dia passado e tem tripId ou truckId, considerar como paga
      if (isPastDay && (e.tripId || e.truckId)) {
        return true;
      }
      return e.isPaid;
    });

    const pendingRealExpenses = monthExpenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date);
      expenseDate.setHours(0, 0, 0, 0);
      const isPastDay = expenseDate < today;
      
      // Se é dia passado e tem tripId ou truckId, não é pendente
      if (isPastDay && (e.tripId || e.truckId)) {
        return false;
      }
      return !e.isPaid;
    });

    // Despesas recorrentes pendentes do mês (incluindo atrasadas)
    const pendingRecurring = recurringExpenses.filter((re: RecurringExpense) => {
      // Verificar se já foi paga este mês
      const alreadyPaid = expenses.some((e: Expense) => 
        e.recurringExpenseId === re.id && 
        new Date(e.date).getMonth() === month &&
        new Date(e.date).getFullYear() === year &&
        e.isPaid
      );
      
      // Verificar se o dia já passou
      const dueDate = new Date(year, month, re.dueDay);
      dueDate.setHours(0, 0, 0, 0);
      const isPastOrToday = dueDate <= today;
      
      // Inclui se não foi paga e o dia já passou ou é hoje
      return !alreadyPaid && isPastOrToday && month === today.getMonth() && year === today.getFullYear();
    });

    // Despesas recorrentes futuras do mês
    const futureRecurring = recurringExpenses.filter((re: RecurringExpense) => {
      const alreadyPaid = expenses.some((e: Expense) => 
        e.recurringExpenseId === re.id && 
        new Date(e.date).getMonth() === month &&
        new Date(e.date).getFullYear() === year
      );
      
      const dueDate = new Date(year, month, re.dueDay);
      dueDate.setHours(0, 0, 0, 0);
      const isFuture = dueDate > today;
      
      return !alreadyPaid && isFuture && month === today.getMonth() && year === today.getFullYear();
    });

    const paidAmount = paidExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
    const pendingAmount = pendingRealExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0) +
                          pendingRecurring.reduce((sum: number, re: RecurringExpense) => sum + re.amount, 0);
    const futureAmount = futureRecurring.reduce((sum: number, re: RecurringExpense) => sum + re.amount, 0);

    setMonthStats({
      paid: paidAmount,
      pending: pendingAmount,
      total: paidAmount + pendingAmount + futureAmount,
      paidCount: paidExpenses.length,
      pendingCount: pendingRealExpenses.length + pendingRecurring.length,
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getExpensesForDay = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dayDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPastDay = dayDate < today;
    
    // Despesas reais do dia
    const realExpenses = expenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date);
      return expenseDate.getDate() === day &&
             expenseDate.getMonth() === month &&
             expenseDate.getFullYear() === year;
    });

    // Separar despesas em pagas e pendentes
    const paidExpenses = realExpenses.filter((e: Expense) => {
      // Se tem tripId ou truckId, considerar como paga se o dia já passou
      if (isPastDay && (e.tripId || e.truckId)) {
        return true;
      }
      return e.isPaid;
    });

    const pendingExpenses = realExpenses.filter((e: Expense) => {
      // Se tem tripId ou truckId e o dia já passou, não é pendente
      if (isPastDay && (e.tripId || e.truckId)) {
        return false;
      }
      return !e.isPaid;
    });

    // Despesas recorrentes do dia
    const recurring = recurringExpenses.filter((re: RecurringExpense) => {
      if (re.dueDay !== day) return false;
      
      // Verificar se já foi paga neste mês
      const alreadyPaid = expenses.some((e: Expense) => 
        e.recurringExpenseId === re.id && 
        new Date(e.date).getMonth() === month &&
        new Date(e.date).getFullYear() === year &&
        e.isPaid
      );
      
      return !alreadyPaid;
    });

    // Identificar recorrentes atrasadas (dia passou e não foi paga)
    const overdueRecurring = recurring.filter(() => isPastDay);
    const futureRecurring = recurring.filter(() => !isPastDay);

    return { 
      paidExpenses, 
      pendingExpenses, 
      overdueRecurring, 
      futureRecurring,
      isPastDay 
    };
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setModalDate(clickedDate);
    setShowDayModal(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: startingDayOfWeek }, (_, i) => i);

  // Filtrar despesas por tipo
  const tripExpenses = expenses.filter(e => e.tripId);
  const truckExpenses = expenses.filter(e => e.truckId && !e.tripId);
  const otherExpenses = expenses.filter(e => !e.tripId && !e.truckId);

  const ExpenseCard = ({ expense }: { expense: Expense }) => (
    <Card key={expense.id} className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">{expense.description || expense.type}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600">
              <div>
                <span className="font-medium">Data:</span>{' '}
                {new Date(expense.date).toLocaleDateString('pt-BR')}
              </div>
              {expense.truck && (
                <div>
                  <span className="font-medium">Caminhão:</span>{' '}
                  {expense.truck.plate}
                </div>
              )}
              {expense.trip && (
                <div className="col-span-2">
                  <button
                    onClick={() => navigate(`/trips/${expense.tripId}`)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <span className="font-medium">Viagem:</span>{' '}
                    {expense.trip.origin} → {expense.trip.destination}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div>
                <span className="font-medium">Tipo:</span>{' '}
                {expense.type}
              </div>
              <div>
                <span className="font-medium">Status:</span>{' '}
                <span className={expense.isPaid ? 'text-green-600' : 'text-orange-600'}>
                  {expense.isPaid ? '✓ Paga' : '⏰ Pendente'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right ml-4">
            <p className="text-2xl font-bold text-red-600 mb-2">
              {formatCurrency(expense.amount)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteExpense(expense.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Despesas</h1>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calendar">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="trips">
            <Route className="w-4 h-4 mr-2" />
            Viagens
          </TabsTrigger>
          <TabsTrigger value="trucks">
            <Truck className="w-4 h-4 mr-2" />
            Caminhões
          </TabsTrigger>
          <TabsTrigger value="other">
            <FileText className="w-4 h-4 mr-2" />
            Outras
          </TabsTrigger>
          <TabsTrigger value="recurring">
            <Clock className="w-4 h-4 mr-2" />
            Recorrentes
          </TabsTrigger>
        </TabsList>

        {/* ABA CALENDÁRIO */}
        <TabsContent value="calendar" className="space-y-4">
          {/* Estatísticas do Mês */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesas Pagas</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(monthStats.paid)}</div>
                <p className="text-xs text-muted-foreground">{monthStats.paidCount} despesas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesas Pendentes</CardTitle>
                <XCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(monthStats.pending)}</div>
                <p className="text-xs text-muted-foreground">{monthStats.pendingCount} despesas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Previsto</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(monthStats.total)}</div>
                <p className="text-xs text-muted-foreground">Pagas + Pendentes + Futuras</p>
              </CardContent>
            </Card>
          </div>

          {/* Calendário */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle>
                  {monthNames[month]} {year}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1.5">
                {/* Cabeçalho dos dias da semana */}
                {weekDays.map(day => (
                  <div key={day} className="text-center font-semibold text-xs py-1.5">
                    {day}
                  </div>
                ))}
                
                {/* Dias vazios antes do primeiro dia do mês */}
                {emptyDays.map(i => (
                  <div key={`empty-${i}`} className="h-20" />
                ))}
                
                {/* Dias do mês */}
                {calendarDays.map(day => {
                  const { paidExpenses, pendingExpenses, overdueRecurring, futureRecurring } = getExpensesForDay(day);
                  const allExpenses = [...paidExpenses, ...pendingExpenses];
                  const totalAmount = [...paidExpenses, ...pendingExpenses, ...overdueRecurring, ...futureRecurring]
                    .reduce((sum: number, item: any) => sum + item.amount, 0);
                  
                  const hasOverdue = overdueRecurring.length > 0;
                  
                  const isToday = day === new Date().getDate() && 
                                  month === new Date().getMonth() && 
                                  year === new Date().getFullYear();

                  return (
                    <button
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`
                        h-20 p-1.5 rounded-lg border transition-colors relative
                        ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                        ${hasOverdue ? 'border-red-400 bg-red-50' : ''}
                        ${allExpenses.length > 0 || overdueRecurring.length > 0 || futureRecurring.length > 0 ? 'hover:bg-gray-100 cursor-pointer' : ''}
                      `}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex items-start justify-between">
                          <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : ''}`}>
                            {day}
                          </span>
                          {hasOverdue && (
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                          )}
                        </div>
                        {(allExpenses.length > 0 || overdueRecurring.length > 0 || futureRecurring.length > 0) && (
                          <div className="mt-auto space-y-0.5">
                            <div className="text-[10px] font-semibold text-red-600 truncate">
                              {formatCurrency(totalAmount)}
                            </div>
                            <div className="flex gap-1 text-[10px] flex-wrap">
                              {paidExpenses.length > 0 && (
                                <span className="text-green-600">✓{paidExpenses.length}</span>
                              )}
                              {pendingExpenses.length > 0 && (
                                <span className="text-orange-600">⏰{pendingExpenses.length}</span>
                              )}
                              {futureRecurring.length > 0 && (
                                <span className="text-purple-600">📅{futureRecurring.length}</span>
                              )}
                              {hasOverdue && (
                                <span className="text-red-600 font-bold">!{overdueRecurring.length}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Modal de Detalhes do Dia */}
          {showDayModal && modalDate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-xl font-bold">
                    Despesas de {modalDate.getDate()} de {monthNames[modalDate.getMonth()]} de {modalDate.getFullYear()}
                  </h2>
                  <button 
                    onClick={() => setShowDayModal(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                  {(() => {
                    const { paidExpenses, pendingExpenses, overdueRecurring, futureRecurring, isPastDay } = getExpensesForDay(modalDate.getDate());
                    const totalPaid = paidExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
                    const totalPending = pendingExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
                    const totalOverdue = overdueRecurring.reduce((sum: number, re: RecurringExpense) => sum + re.amount, 0);
                    const totalFuture = futureRecurring.reduce((sum: number, re: RecurringExpense) => sum + re.amount, 0);
                    const grandTotal = totalPaid + totalPending + totalOverdue + totalFuture;

                    return (
                      <div className="space-y-4">
                        {/* Resumo */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-xs text-green-700">Pagas</p>
                            <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                            <p className="text-xs text-green-600">{paidExpenses.length} despesas</p>
                          </div>
                          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <p className="text-xs text-orange-700">Pendentes</p>
                            <p className="text-lg font-bold text-orange-600">{formatCurrency(totalPending)}</p>
                            <p className="text-xs text-orange-600">{pendingExpenses.length} despesas</p>
                          </div>
                          {overdueRecurring.length > 0 && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                              <p className="text-xs text-red-700">Atrasadas</p>
                              <p className="text-lg font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
                              <p className="text-xs text-red-600">{overdueRecurring.length} recorrentes</p>
                            </div>
                          )}
                          {futureRecurring.length > 0 && (
                            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                              <p className="text-xs text-purple-700">Programadas</p>
                              <p className="text-lg font-bold text-purple-600">{formatCurrency(totalFuture)}</p>
                              <p className="text-xs text-purple-600">{futureRecurring.length} recorrentes</p>
                            </div>
                          )}
                        </div>

                        {/* Total Geral */}
                        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900">Total do Dia</span>
                            <span className="text-2xl font-bold text-blue-600">{formatCurrency(grandTotal)}</span>
                          </div>
                        </div>

                        {/* Despesas Pagas */}
                        {paidExpenses.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-2 text-green-700 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Despesas Pagas ({paidExpenses.length})
                            </h3>
                            <div className="space-y-2">
                              {paidExpenses.map((expense: Expense) => (
                                <div key={expense.id} className="flex justify-between items-start p-3 bg-green-50 rounded-lg border border-green-200">
                                  <div className="flex-1">
                                    <p className="font-medium">{expense.description || expense.type}</p>
                                    <div className="flex gap-2 text-xs text-gray-600 mt-1">
                                      {expense.truck && (
                                        <span className="flex items-center gap-1">
                                          <Truck className="w-3 h-3" />
                                          {expense.truck.plate}
                                        </span>
                                      )}
                                      {expense.trip && (
                                        <button
                                          onClick={() => navigate(`/trips/${expense.tripId}`)}
                                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                          <MapPin className="w-3 h-3" />
                                          {expense.trip.origin} → {expense.trip.destination}
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    {isPastDay && (expense.tripId || expense.truckId) && !expense.isPaid && (
                                      <p className="text-xs text-green-600 mt-1">✓ Marcada como paga (dia passado)</p>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="font-bold text-green-600">{formatCurrency(expense.amount)}</p>
                                    <p className="text-xs text-green-600">✓ Paga</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Despesas Pendentes */}
                        {pendingExpenses.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-2 text-orange-700 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Despesas Pendentes ({pendingExpenses.length})
                            </h3>
                            <div className="space-y-2">
                              {pendingExpenses.map((expense: Expense) => (
                                <div key={expense.id} className="flex justify-between items-start p-3 bg-orange-50 rounded-lg border border-orange-200">
                                  <div className="flex-1">
                                    <p className="font-medium">{expense.description || expense.type}</p>
                                    <div className="flex gap-2 text-xs text-gray-600 mt-1">
                                      {expense.truck && (
                                        <span className="flex items-center gap-1">
                                          <Truck className="w-3 h-3" />
                                          {expense.truck.plate}
                                        </span>
                                      )}
                                      {expense.trip && (
                                        <button
                                          onClick={() => navigate(`/trips/${expense.tripId}`)}
                                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                          <MapPin className="w-3 h-3" />
                                          {expense.trip.origin} → {expense.trip.destination}
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="font-bold text-orange-600">{formatCurrency(expense.amount)}</p>
                                    <p className="text-xs text-orange-600">⏰ Pendente</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pagamentos Atrasados */}
                        {overdueRecurring.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-2 text-red-700 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              Pagamentos Recorrentes Atrasados ({overdueRecurring.length})
                            </h3>
                            <div className="space-y-2">
                              {overdueRecurring.map((re: RecurringExpense) => (
                                <div key={re.id} className="flex justify-between items-start p-3 bg-red-50 rounded-lg border-2 border-red-300">
                                  <div className="flex-1">
                                    <p className="font-medium text-red-900">{re.description}</p>
                                    <div className="flex gap-2 text-xs text-gray-600 mt-1">
                                      {re.truck && (
                                        <span className="flex items-center gap-1">
                                          <Truck className="w-3 h-3" />
                                          {re.truck.plate}
                                        </span>
                                      )}
                                      {re.totalInstallments && (
                                        <span>Parcela {re.paidInstallments + 1}/{re.totalInstallments}</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-red-600 font-semibold mt-1">⚠️ Pagamento não realizado!</p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="font-bold text-red-600">{formatCurrency(re.amount)}</p>
                                    <p className="text-xs text-red-600">! Atrasado</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pagamentos Futuros */}
                        {futureRecurring.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-2 text-purple-700 flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4" />
                              Pagamentos Recorrentes Programados ({futureRecurring.length})
                            </h3>
                            <div className="space-y-2">
                              {futureRecurring.map((re: RecurringExpense) => (
                                <div key={re.id} className="flex justify-between items-start p-3 bg-purple-50 rounded-lg border border-purple-200">
                                  <div className="flex-1">
                                    <p className="font-medium">{re.description}</p>
                                    <div className="flex gap-2 text-xs text-gray-600 mt-1">
                                      {re.truck && (
                                        <span className="flex items-center gap-1">
                                          <Truck className="w-3 h-3" />
                                          {re.truck.plate}
                                        </span>
                                      )}
                                      {re.totalInstallments && (
                                        <span>Parcela {re.paidInstallments + 1}/{re.totalInstallments}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="font-bold text-purple-600">{formatCurrency(re.amount)}</p>
                                    <p className="text-xs text-purple-600">📅 Programado</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {paidExpenses.length === 0 && pendingExpenses.length === 0 && overdueRecurring.length === 0 && futureRecurring.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <p>Nenhuma despesa registrada para este dia</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Outras abas */}
        <TabsContent value="trips" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Despesas de Viagens</h2>
            <p className="text-sm text-gray-600">{tripExpenses.length} despesas encontradas</p>
          </div>
          {tripExpenses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Route className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma despesa de viagem</h3>
                <p className="text-sm text-gray-500">
                  Despesas relacionadas a viagens aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tripExpenses.map((expense) => (
                <ExpenseCard key={expense.id} expense={expense} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trucks" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Despesas de Caminhões</h2>
            <p className="text-sm text-gray-600">{truckExpenses.length} despesas encontradas</p>
          </div>
          {truckExpenses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Truck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma despesa de caminhão</h3>
                <p className="text-sm text-gray-500">
                  Despesas relacionadas diretamente a caminhões (mas não a viagens) aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {truckExpenses.map((expense) => (
                <ExpenseCard key={expense.id} expense={expense} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Outras Despesas</h2>
            <p className="text-sm text-gray-600">{otherExpenses.length} despesas encontradas</p>
          </div>
          {otherExpenses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma outra despesa</h3>
                <p className="text-sm text-gray-500">
                  Despesas avulsas (não relacionadas a viagens ou caminhões) aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {otherExpenses.map((expense) => (
                <ExpenseCard key={expense.id} expense={expense} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringExpensesTab />
        </TabsContent>
      </Tabs>

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Confirmar Exclusão</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-6">
                Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setExpenseToDelete(null);
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
    </div>
  );
}
