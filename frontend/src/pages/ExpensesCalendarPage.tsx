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
  Clock
} from 'lucide-react';
import { expensesAPI, recurringExpensesAPI } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  
  // Estado do calendário
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarExpenses, setCalendarExpenses] = useState<any[]>([]);

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
      fetchCalendarData();
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

  const fetchRecurringExpenses = async () => {
    try {
      const data = await recurringExpensesAPI.getAll({ status: 'ACTIVE' });
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      toast.error('Erro ao carregar despesas recorrentes');
    }
  };

  const fetchCalendarData = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const data = await recurringExpensesAPI.getCalendar(year, month);
      setCalendarExpenses(data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    }
  };

  const calculateMonthStats = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Despesas reais do mês
    const monthExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate >= firstDay && expenseDate <= lastDay;
    });

    const paidExpenses = monthExpenses.filter(e => e.isPaid);
    const pendingRealExpenses = monthExpenses.filter(e => !e.isPaid);

    // Despesas recorrentes pendentes do mês
    const today = new Date();
    const pendingRecurring = recurringExpenses.filter(re => {
      // Verifica se já foi paga este mês
      const alreadyPaid = expenses.some(e => 
        e.recurringExpenseId === re.id && 
        new Date(e.date).getMonth() === month &&
        new Date(e.date).getFullYear() === year &&
        e.isPaid
      );
      
      // Inclui se não foi paga e o dia de vencimento já passou ou é hoje
      return !alreadyPaid && re.dueDay <= today.getDate() && month === today.getMonth();
    });

    // Despesas recorrentes futuras do mês
    const futureRecurring = recurringExpenses.filter(re => {
      const alreadyPaid = expenses.some(e => 
        e.recurringExpenseId === re.id && 
        new Date(e.date).getMonth() === month &&
        new Date(e.date).getFullYear() === year
      );
      
      return !alreadyPaid && re.dueDay > today.getDate() && month === today.getMonth();
    });

    const paidAmount = paidExpenses.reduce((sum, e) => sum + e.amount, 0);
    const pendingAmount = pendingRealExpenses.reduce((sum, e) => sum + e.amount, 0) +
                          pendingRecurring.reduce((sum, re) => sum + re.amount, 0);
    const futureAmount = futureRecurring.reduce((sum, re) => sum + re.amount, 0);

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
    
    // Despesas reais do dia
    const realExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate.getDate() === day &&
             expenseDate.getMonth() === month &&
             expenseDate.getFullYear() === year;
    });

    // Despesas recorrentes do dia
    const recurring = calendarExpenses.filter(re => 
      re.dueDay === day && !re.isPaidThisMonth
    );

    return { realExpenses, recurring };
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
    setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
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
            <MapPin className="w-4 h-4 mr-2" />
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
              <div className="grid grid-cols-7 gap-2">
                {/* Cabeçalho dos dias da semana */}
                {weekDays.map(day => (
                  <div key={day} className="text-center font-semibold text-sm py-2">
                    {day}
                  </div>
                ))}
                
                {/* Dias vazios antes do primeiro dia do mês */}
                {emptyDays.map(i => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {/* Dias do mês */}
                {calendarDays.map(day => {
                  const { realExpenses, recurring } = getExpensesForDay(day);
                  const totalExpenses = realExpenses.length + recurring.length;
                  const paidExpenses = realExpenses.filter(e => e.isPaid).length;
                  const totalAmount = realExpenses.reduce((sum, e) => sum + e.amount, 0) +
                                     recurring.reduce((sum, re) => sum + re.amount, 0);
                  
                  const isToday = day === new Date().getDate() && 
                                  month === new Date().getMonth() && 
                                  year === new Date().getFullYear();
                  
                  const isSelected = selectedDate && 
                                    day === selectedDate.getDate() &&
                                    month === selectedDate.getMonth() &&
                                    year === selectedDate.getFullYear();

                  return (
                    <button
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`
                        aspect-square p-2 rounded-lg border transition-colors
                        ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                        ${isSelected ? 'ring-2 ring-blue-500' : ''}
                        ${totalExpenses > 0 ? 'hover:bg-gray-100' : ''}
                      `}
                    >
                      <div className="flex flex-col h-full">
                        <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : ''}`}>
                          {day}
                        </span>
                        {totalExpenses > 0 && (
                          <div className="mt-auto space-y-1">
                            <div className="text-xs font-semibold text-red-600">
                              {formatCurrency(totalAmount)}
                            </div>
                            <div className="flex gap-1 text-xs">
                              {paidExpenses > 0 && (
                                <span className="text-green-600">✓{paidExpenses}</span>
                              )}
                              {totalExpenses - paidExpenses > 0 && (
                                <span className="text-orange-600">⏰{totalExpenses - paidExpenses}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detalhes do dia selecionado */}
              {selectedDate && (
                <div className="mt-6 p-4 border-t">
                  <h3 className="font-semibold mb-3">
                    Despesas de {selectedDate.getDate()} de {monthNames[selectedDate.getMonth()]}
                  </h3>
                  {(() => {
                    const { realExpenses, recurring } = getExpensesForDay(selectedDate.getDate());
                    return (
                      <div className="space-y-2">
                        {realExpenses.map(expense => (
                          <div key={expense.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <div>
                              <p className="font-medium">{expense.description || expense.type}</p>
                              <p className="text-sm text-gray-600">
                                {expense.truck && `${expense.truck.plate}`}
                                {expense.trip && ` - ${expense.trip.origin} → ${expense.trip.destination}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-red-600">{formatCurrency(expense.amount)}</p>
                              <p className="text-xs">
                                {expense.isPaid ? (
                                  <span className="text-green-600">✓ Paga</span>
                                ) : (
                                  <span className="text-orange-600">Pendente</span>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                        
                        {recurring.map((re: any) => (
                          <div key={re.id} className="flex justify-between items-center p-2 bg-purple-50 rounded border border-purple-200">
                            <div>
                              <p className="font-medium">{re.description}</p>
                              <p className="text-sm text-gray-600">
                                {re.truck && `${re.truck.plate}`}
                                {re.totalInstallments && ` - Parcela ${re.paidInstallments + 1}/${re.totalInstallments}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-red-600">{formatCurrency(re.amount)}</p>
                              <p className="text-xs text-purple-600">Recorrente</p>
                            </div>
                          </div>
                        ))}

                        {realExpenses.length === 0 && recurring.length === 0 && (
                          <p className="text-gray-500 text-sm">Nenhuma despesa neste dia</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outras abas serão implementadas posteriormente */}
        <TabsContent value="trips">
          <Card>
            <CardHeader>
              <CardTitle>Despesas de Viagens</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trucks">
          <Card>
            <CardHeader>
              <CardTitle>Despesas de Caminhões</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other">
          <Card>
            <CardHeader>
              <CardTitle>Outras Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringExpensesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
