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
  Route,
  Plus
} from 'lucide-react';
import { expensesAPI, recurringExpensesAPI, trucksAPI, tripsAPI, clientsAPI } from '@/lib/api';
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
  supplier?: string;
  location?: string;
  paymentType?: string;
  paymentMethod?: string;
  installmentNumber?: number;
  totalInstallments?: number;
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
    tripCode?: string;
    clientId?: string;
    client?: {
      id: string;
      name: string;
      cnpj: string;
    };
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
  startDate: string;
  truck?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  };
}

interface TruckData {
  id: string;
  plate: string;
  model: string;
  brand: string;
}

interface TripData {
  id: string;
  origin: string;
  destination: string;
  truck?: {
    id: string;
    plate: string;
  };
  truckId?: string;
}

interface ClientData {
  id: string;
  name: string;
  cnpj: string;
  city: string;
  state: string;
  active?: boolean;
}

export default function ExpensesCalendarPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  
  // Filtros
  const [selectedTripFilter, setSelectedTripFilter] = useState<string>('');
  const [selectedTruckFilter, setSelectedTruckFilter] = useState<string>('');
  
  // Estado do calendário
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDayModal, setShowDayModal] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  
  // Modal de despesas da viagem
  const [showTripExpensesModal, setShowTripExpensesModal] = useState(false);
  const [selectedTripExpenses, setSelectedTripExpenses] = useState<{
    tripId: string;
    tripCode?: string;
    origin: string;
    destination: string;
    clientName?: string;
    expenses: Expense[];
  } | null>(null);

  // Modal de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Modal de criação de despesa
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    truckId: '',
    tripId: '',
    clientId: '',
    type: 'FUEL',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentType: 'A_VISTA', // À VISTA ou PARCELADO
    paymentMethod: 'DINHEIRO', // CARTAO_CREDITO, CARTAO_DEBITO, PIX, DINHEIRO, TRANSFERENCIA
    installments: '1',
    dueDay: '',
  });

  // Estatísticas do mês
  const [monthStats, setMonthStats] = useState({
    paid: 0,
    pending: 0,
    total: 0,
    paidCount: 0,
    pendingCount: 0,
  });

  // Função helper para formatar data sem conversão de timezone
  const formatDateOnly = (isoString: string): string => {
    if (!isoString) return '-';
    const dateWithoutZ = isoString.replace('Z', '');
    const date = new Date(dateWithoutZ);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    fetchExpenses();
    fetchRecurringExpenses();
    fetchFormData();
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
      
      // Fechar o modal do dia se estiver aberto
      setShowDayModal(false);
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

  const fetchFormData = async () => {
    try {
      const [trucksData, tripsData, clientsData] = await Promise.all([
        trucksAPI.getAll(),
        tripsAPI.getAll(),
        clientsAPI.getAll(),
      ]);
      setTrucks(trucksData);
      setTrips(tripsData.filter((t: TripData) => t.origin)); // Filtrar viagens válidas
      setClients(clientsData.filter((c: ClientData) => c.active !== false));
    } catch (error) {
      console.error('Error fetching form data:', error);
    }
  };

  const handleCreateExpense = async () => {
    if (!expenseForm.type) {
      toast.error('Selecione o tipo de despesa');
      return;
    }

    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (expenseForm.paymentType === 'PARCELADO') {
      const installments = parseInt(expenseForm.installments);
      if (!installments || installments < 2 || installments > 48) {
        toast.error('Número de parcelas deve ser entre 2 e 48');
        return;
      }

      if (!expenseForm.dueDay || parseInt(expenseForm.dueDay) < 1 || parseInt(expenseForm.dueDay) > 31) {
        toast.error('Informe um dia de vencimento válido (1-31)');
        return;
      }
    }

    try {
      const totalAmount = parseFloat(expenseForm.amount);
      const isInstallment = expenseForm.paymentType === 'PARCELADO';
      const installmentsCount = isInstallment ? parseInt(expenseForm.installments) : 1;
      const installmentAmount = totalAmount / installmentsCount;

      // Criar despesas parceladas
      const expensesToCreate = [];
      
      for (let i = 0; i < installmentsCount; i++) {
        const [year, month, day] = expenseForm.date.split('-');
        
        let expenseDate;
        if (isInstallment) {
          // Para parcelado, usar o dia de vencimento e adicionar meses
          const dueDay = parseInt(expenseForm.dueDay);
          const baseDate = new Date(parseInt(year), parseInt(month) - 1 + i, dueDay);
          expenseDate = new Date(Date.UTC(
            baseDate.getFullYear(), 
            baseDate.getMonth(), 
            baseDate.getDate(), 
            12, 0, 0
          ));
        } else {
          // Para à vista, usar a data selecionada
          expenseDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
        }

        const expenseDescription = isInstallment 
          ? `${expenseForm.description || expenseForm.type} (${i + 1}/${installmentsCount})`
          : expenseForm.description || undefined;

        expensesToCreate.push({
          truckId: expenseForm.truckId || undefined,
          tripId: expenseForm.tripId || undefined,
          clientId: expenseForm.clientId || undefined,
          type: expenseForm.type,
          amount: installmentAmount,
          description: expenseDescription,
          date: expenseDate.toISOString(),
          isPaid: i === 0 && !isInstallment, // Primeira parcela à vista é paga, demais pendentes
          paymentType: expenseForm.paymentType,
          paymentMethod: expenseForm.paymentMethod,
          installmentNumber: isInstallment ? i + 1 : undefined,
          totalInstallments: isInstallment ? installmentsCount : undefined,
        });
      }

      // Criar todas as despesas
      await Promise.all(expensesToCreate.map(expense => expensesAPI.create(expense)));

      const message = isInstallment 
        ? `Despesa criada com sucesso! ${installmentsCount} parcelas de ${formatCurrency(installmentAmount)}`
        : 'Despesa criada com sucesso!';
      
      toast.success(message);
      setShowCreateModal(false);
      
      // Resetar formulário
      setExpenseForm({
        truckId: '',
        tripId: '',
        clientId: '',
        type: 'FUEL',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        paymentType: 'A_VISTA',
        paymentMethod: 'DINHEIRO',
        installments: '1',
        dueDay: '',
      });

      // Recarregar despesas
      fetchExpenses();
    } catch (error: any) {
      console.error('Erro ao criar despesa:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar despesa');
    }
  };

  const calculateMonthStats = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Despesas reais do mês
    const monthExpenses = expenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date.replace('Z', ''));
      return expenseDate.getMonth() === month && 
             expenseDate.getFullYear() === year;
    });

    // Separar despesas pagas e pendentes considerando viagens/caminhões em dias passados
    const paidExpenses = monthExpenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date.replace('Z', ''));
      expenseDate.setHours(0, 0, 0, 0);
      const isPastDay = expenseDate < today;
      
      // Se é dia passado e tem tripId ou truckId, considerar como paga
      if (isPastDay && (e.tripId || e.truckId)) {
        return true;
      }
      return e.isPaid;
    });

    const pendingRealExpenses = monthExpenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date.replace('Z', ''));
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
      // Verificar se a despesa recorrente já estava ativa no mês selecionado
      const startDate = new Date(re.startDate);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      
      // Se a despesa foi criada depois do mês selecionado (comparar apenas ano/mês), ignorar
      if (startYear > year || (startYear === year && startMonth > month)) {
        return false;
      }
      
      // Verificar se já foi paga neste mês
      const alreadyPaid = expenses.some((e: Expense) => 
        e.recurringExpenseId === re.id && 
        new Date(e.date.replace('Z', '')).getMonth() === month &&
        new Date(e.date.replace('Z', '')).getFullYear() === year
      );
      
      // Verificar se o dia já passou no mês selecionado
      const dueDate = new Date(year, month, re.dueDay);
      dueDate.setHours(0, 0, 0, 0);
      const isPastOrToday = dueDate <= today;
      
      // Inclui se não foi paga e o dia já passou ou é hoje (apenas para o mês atual)
      // OU se o mês selecionado é passado e não foi paga
      const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
      const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
      
      if (isPastMonth) {
        // Para meses passados, mostra apenas se não foi paga
        return !alreadyPaid && re.status === 'ACTIVE';
      } else if (isCurrentMonth) {
        // Para mês atual, mostra apenas se o dia já passou e não foi paga
        return !alreadyPaid && isPastOrToday && re.status === 'ACTIVE';
      }
      return false;
    });

    // Despesas recorrentes futuras do mês
    const futureRecurring = recurringExpenses.filter((re: RecurringExpense) => {
      // Verificar se a despesa recorrente já estava ativa no mês selecionado
      const startDate = new Date(re.startDate);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      
      // Se a despesa foi criada depois do mês selecionado (comparar apenas ano/mês), ignorar
      if (startYear > year || (startYear === year && startMonth > month)) {
        return false;
      }
      
      const alreadyPaid = expenses.some((e: Expense) => 
        e.recurringExpenseId === re.id && 
        new Date(e.date.replace('Z', '')).getMonth() === month &&
        new Date(e.date.replace('Z', '')).getFullYear() === year
      );
      
      const dueDate = new Date(year, month, re.dueDay);
      dueDate.setHours(0, 0, 0, 0);
      const isFuture = dueDate > today;
      
      // Apenas para o mês atual mostra despesas futuras
      const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
      const isFutureMonth = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());
      
      if (isFutureMonth) {
        // Para meses futuros, mostra todas as recorrentes ativas não pagas
        return !alreadyPaid && re.status === 'ACTIVE';
      } else if (isCurrentMonth) {
        // Para mês atual, mostra apenas se o dia ainda não passou e não foi paga
        return !alreadyPaid && isFuture && re.status === 'ACTIVE';
      }
      return false;
    });

    const paidAmount = paidExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
    const pendingAmount = pendingRealExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0) +
                          pendingRecurring.reduce((sum: number, re: RecurringExpense) => sum + re.amount, 0);
    const futureAmount = futureRecurring.reduce((sum: number, re: RecurringExpense) => sum + re.amount, 0);

    // Para meses futuros, somar despesas futuras ao pending
    const isFutureMonth = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());
    const totalPendingWithFuture = isFutureMonth ? pendingAmount + futureAmount : pendingAmount;

    setMonthStats({
      paid: paidAmount,
      pending: totalPendingWithFuture,
      total: paidAmount + totalPendingWithFuture,
      paidCount: paidExpenses.length,
      pendingCount: pendingRealExpenses.length + pendingRecurring.length + (isFutureMonth ? futureRecurring.length : 0),
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
    
    // Despesas reais do dia (sem conversão de timezone)
    const realExpenses = expenses.filter((e: Expense) => {
      const expenseDate = new Date(e.date.replace('Z', ''));
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
      
      // Verificar se a despesa recorrente já estava ativa neste dia (comparar ano/mês)
      const startDate = new Date(re.startDate);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      
      // Se a despesa foi criada depois do mês deste dia, ignorar
      if (startYear > year || (startYear === year && startMonth > month)) {
        return false;
      }
      
      // Verificar se já foi paga neste mês/ano (sem conversão de timezone)
      const alreadyPaid = expenses.some((e: Expense) => 
        e.recurringExpenseId === re.id && 
        new Date(e.date.replace('Z', '')).getMonth() === month &&
        new Date(e.date.replace('Z', '')).getFullYear() === year
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

  // Agrupar despesas por viagem
  const groupExpensesByTrip = (expenses: Expense[]) => {
    const tripMap = new Map<string, {
      tripId: string;
      tripCode?: string;
      origin: string;
      destination: string;
      clientName?: string;
      expenses: Expense[];
      total: number;
    }>();

    expenses.forEach(expense => {
      if (expense.tripId && expense.trip) {
        const existing = tripMap.get(expense.tripId);
        if (existing) {
          existing.expenses.push(expense);
          existing.total += expense.amount;
        } else {
          tripMap.set(expense.tripId, {
            tripId: expense.tripId,
            tripCode: expense.trip.tripCode,
            origin: expense.trip.origin,
            destination: expense.trip.destination,
            clientName: expense.trip.client?.name,
            expenses: [expense],
            total: expense.amount,
          });
        }
      }
    });

    return Array.from(tripMap.values());
  };

  // Abrir modal de despesas da viagem
  const handleOpenTripExpenses = (tripData: {
    tripId: string;
    tripCode?: string;
    origin: string;
    destination: string;
    clientName?: string;
    expenses: Expense[];
  }) => {
    setSelectedTripExpenses(tripData);
    setShowTripExpensesModal(true);
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
  // Aplicar filtros
  const tripExpenses = expenses
    .filter((e: Expense) => e.tripId)
    .filter((e: Expense) => !selectedTripFilter || e.tripId === selectedTripFilter);
  
  const truckExpenses = expenses
    .filter((e: Expense) => e.truckId && !e.tripId)
    .filter((e: Expense) => !selectedTruckFilter || e.truckId === selectedTruckFilter);
  
  const otherExpenses = expenses.filter((e: Expense) => !e.tripId && !e.truckId);

  // Obter lista única de viagens e caminhões para os filtros
  const tripsWithExpenses = Array.from(new Set(expenses.filter((e: Expense) => e.tripId).map((e: Expense) => e.tripId)))
    .map(tripId => {
      const expense = expenses.find((e: Expense) => e.tripId === tripId);
      return expense?.trip;
    })
    .filter((trip): trip is NonNullable<typeof trip> => trip !== undefined)
    .sort((a, b) => {
      // Priorizar viagens com código
      if (a.tripCode && !b.tripCode) return -1;
      if (!a.tripCode && b.tripCode) return 1;
      if (a.tripCode && b.tripCode) return a.tripCode.localeCompare(b.tripCode);
      return `${a.origin} → ${a.destination}`.localeCompare(`${b.origin} → ${b.destination}`);
    });

  const trucksWithExpenses = Array.from(new Set(expenses.filter((e: Expense) => e.truckId && !e.tripId).map((e: Expense) => e.truckId)))
    .map(truckId => {
      const expense = expenses.find((e: Expense) => e.truckId === truckId);
      return expense?.truck;
    })
    .filter((truck): truck is NonNullable<typeof truck> => truck !== undefined)
    .sort((a, b) => a.plate.localeCompare(b.plate));

  const ExpenseCard = ({ expense }: { expense: Expense }) => (
    <Card key={expense.id} className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">{expense.description || expense.type}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600">
              <div>
                <span className="font-medium">Data:</span>{' '}
                {formatDateOnly(expense.date)}
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
                    {expense.trip.tripCode ? `#${expense.trip.tripCode}` : `ID: ${expense.tripId?.substring(0, 8)}`} - {expense.trip.origin} → {expense.trip.destination}
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
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Despesa
        </Button>
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
                    const { paidExpenses, pendingExpenses, overdueRecurring, futureRecurring } = getExpensesForDay(modalDate.getDate());
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
                              {/* Despesas de Viagens Agrupadas */}
                              {groupExpensesByTrip(paidExpenses.filter(e => e.tripId)).map((tripGroup) => (
                                <button
                                  key={tripGroup.tripId}
                                  onClick={() => handleOpenTripExpenses(tripGroup)}
                                  className="w-full flex justify-between items-start p-3 bg-blue-50 rounded-lg border border-blue-300 hover:bg-blue-100 transition-colors cursor-pointer"
                                >
                                  <div className="flex-1 text-left">
                                    <p className="font-medium text-blue-900">
                                      🚚 Viagem: {tripGroup.tripCode ? `#${tripGroup.tripCode}` : `ID: ${tripGroup.tripId.substring(0, 8)}`}
                                    </p>
                                    <div className="flex gap-2 text-xs text-gray-600 mt-1">
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {tripGroup.origin} → {tripGroup.destination}
                                      </span>
                                      {tripGroup.clientName && (
                                        <span>• Cliente: {tripGroup.clientName}</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-blue-600 mt-1">{tripGroup.expenses.length} despesa(s)</p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="font-bold text-blue-600">{formatCurrency(tripGroup.total)}</p>
                                    <p className="text-xs text-blue-600">📋 Ver detalhes →</p>
                                  </div>
                                </button>
                              ))}

                              {/* Outras Despesas (Avulsas/Recorrentes) */}
                              {paidExpenses.filter(e => !e.tripId).map((expense: Expense) => (
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
                                      {expense.recurringExpenseId && (
                                        <span className="text-purple-600">🔄 Recorrente</span>
                                      )}
                                      {expense.totalInstallments && expense.totalInstallments > 1 && (
                                        <span className="text-blue-600">
                                          💳 Parcela {expense.installmentNumber}/{expense.totalInstallments}
                                        </span>
                                      )}
                                      {expense.paymentMethod && (
                                        <span className="text-gray-600">
                                          • {expense.paymentMethod.replace('_', ' ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="mb-2">
                                      <p className="font-bold text-green-600">{formatCurrency(expense.amount)}</p>
                                      <p className="text-xs text-green-600">✓ Paga</p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteExpense(expense.id)}
                                      className="text-red-600 hover:text-red-700 h-7"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
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
                              {/* Despesas de Viagens Agrupadas */}
                              {groupExpensesByTrip(pendingExpenses.filter(e => e.tripId)).map((tripGroup) => (
                                <button
                                  key={tripGroup.tripId}
                                  onClick={() => handleOpenTripExpenses(tripGroup)}
                                  className="w-full flex justify-between items-start p-3 bg-blue-50 rounded-lg border border-blue-300 hover:bg-blue-100 transition-colors cursor-pointer"
                                >
                                  <div className="flex-1 text-left">
                                    <p className="font-medium text-blue-900">
                                      🚚 Viagem: {tripGroup.tripCode ? `#${tripGroup.tripCode}` : `ID: ${tripGroup.tripId.substring(0, 8)}`}
                                    </p>
                                    <div className="flex gap-2 text-xs text-gray-600 mt-1">
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {tripGroup.origin} → {tripGroup.destination}
                                      </span>
                                      {tripGroup.clientName && (
                                        <span>• Cliente: {tripGroup.clientName}</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-blue-600 mt-1">{tripGroup.expenses.length} despesa(s)</p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="font-bold text-orange-600">{formatCurrency(tripGroup.total)}</p>
                                    <p className="text-xs text-orange-600">⏰ Pendente • 📋 Ver →</p>
                                  </div>
                                </button>
                              ))}

                              {/* Outras Despesas (Avulsas/Recorrentes) */}
                              {pendingExpenses.filter(e => !e.tripId).map((expense: Expense) => (
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
                                      {expense.recurringExpenseId && (
                                        <span className="text-purple-600">🔄 Recorrente</span>
                                      )}
                                      {expense.totalInstallments && expense.totalInstallments > 1 && (
                                        <span className="text-blue-600">
                                          💳 Parcela {expense.installmentNumber}/{expense.totalInstallments}
                                        </span>
                                      )}
                                      {expense.paymentMethod && (
                                        <span className="text-gray-600">
                                          • {expense.paymentMethod.replace('_', ' ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="mb-2">
                                      <p className="font-bold text-orange-600">{formatCurrency(expense.amount)}</p>
                                      <p className="text-xs text-orange-600">⏰ Pendente</p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteExpense(expense.id)}
                                      className="text-red-600 hover:text-red-700 h-7"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Filtrar por viagem:</label>
                <select
                  value={selectedTripFilter}
                  onChange={(e) => setSelectedTripFilter(e.target.value)}
                  className="px-3 py-1.5 border rounded-md text-sm min-w-[250px]"
                >
                  <option value="">Todas as viagens</option>
                  {tripsWithExpenses.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.tripCode ? `#${trip.tripCode}` : `ID: ${trip.id.substring(0, 8)}`} - {trip.origin} → {trip.destination}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-gray-600">{tripExpenses.length} despesas encontradas</p>
            </div>
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Filtrar por caminhão:</label>
                <select
                  value={selectedTruckFilter}
                  onChange={(e) => setSelectedTruckFilter(e.target.value)}
                  className="px-3 py-1.5 border rounded-md text-sm min-w-[200px]"
                >
                  <option value="">Todos os caminhões</option>
                  {trucksWithExpenses.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plate} - {truck.brand} {truck.model}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-gray-600">{truckExpenses.length} despesas encontradas</p>
            </div>
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

      {/* Modal de Criação de Despesa */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Adicionar Despesa Avulsa</CardTitle>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Data */}
                <div>
                  <label className="block text-sm font-medium mb-1">Data *</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                {/* Tipo de Despesa */}
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Despesa *</label>
                  <select
                    value={expenseForm.type}
                    onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="FUEL">Combustível</option>
                    <option value="TOLL">Pedágio</option>
                    <option value="MAINTENANCE">Manutenção</option>
                    <option value="TIRE">Pneus</option>
                    <option value="FOOD">Alimentação</option>
                    <option value="PARKING">Estacionamento</option>
                    <option value="INSURANCE">Seguro</option>
                    <option value="TAX">Impostos</option>
                    <option value="SALARY">Salário</option>
                    <option value="OVERTIME">Hora Extra</option>
                    <option value="FINANCING">Financiamento</option>
                    <option value="OTHER">Outros</option>
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Total (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="0,00"
                    required
                  />
                </div>

                {/* Tipo de Pagamento */}
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Pagamento *</label>
                  <select
                    value={expenseForm.paymentType}
                    onChange={(e) => {
                      setExpenseForm({ 
                        ...expenseForm, 
                        paymentType: e.target.value,
                        installments: e.target.value === 'PARCELADO' ? '2' : '1'
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="A_VISTA">À Vista</option>
                    <option value="PARCELADO">Parcelado</option>
                  </select>
                </div>

                {/* Forma de Pagamento */}
                <div>
                  <label className="block text-sm font-medium mb-1">Forma de Pagamento *</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="PIX">Pix</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                    <option value="TRANSFERENCIA">Transferência Bancária</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                {/* Campos específicos para parcelado */}
                {expenseForm.paymentType === 'PARCELADO' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Número de Parcelas */}
                      <div>
                        <label className="block text-sm font-medium mb-1">Número de Parcelas *</label>
                        <input
                          type="number"
                          min="2"
                          max="48"
                          value={expenseForm.installments}
                          onChange={(e) => setExpenseForm({ ...expenseForm, installments: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md"
                          required
                        />
                      </div>

                      {/* Dia de Vencimento */}
                      <div>
                        <label className="block text-sm font-medium mb-1">Dia de Vencimento *</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={expenseForm.dueDay}
                          onChange={(e) => setExpenseForm({ ...expenseForm, dueDay: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="Ex: 10"
                          required
                        />
                      </div>
                    </div>

                    {/* Visualização das Parcelas */}
                    {expenseForm.amount && expenseForm.installments && parseInt(expenseForm.installments) >= 2 && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-900 mb-2">Resumo do Parcelamento</p>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-gray-600">Valor total:</span>{' '}
                            <span className="font-semibold">{formatCurrency(parseFloat(expenseForm.amount))}</span>
                          </p>
                          <p>
                            <span className="text-gray-600">Número de parcelas:</span>{' '}
                            <span className="font-semibold">{expenseForm.installments}x</span>
                          </p>
                          <p>
                            <span className="text-gray-600">Valor de cada parcela:</span>{' '}
                            <span className="font-semibold text-blue-600">
                              {formatCurrency(parseFloat(expenseForm.amount) / parseInt(expenseForm.installments))}
                            </span>
                          </p>
                          {expenseForm.dueDay && (
                            <p className="text-xs text-gray-500 mt-2">
                              As parcelas vencerão todo dia {expenseForm.dueDay} de cada mês
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <textarea
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={3}
                    placeholder="Informações adicionais sobre a despesa"
                  />
                </div>

                {/* Vinculações Opcionais */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Vinculações Opcionais</h3>
                  
                  {/* Viagem */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Viagem</label>
                    <select
                      value={expenseForm.tripId}
                      onChange={(e) => {
                        const selectedTrip = trips.find(t => t.id === e.target.value);
                        setExpenseForm({ 
                          ...expenseForm, 
                          tripId: e.target.value,
                          truckId: selectedTrip?.truckId || selectedTrip?.truck?.id || expenseForm.truckId
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Nenhuma viagem</option>
                      {trips.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.origin} → {trip.destination} ({trip.truck?.plate || 'Sem placa'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Caminhão */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Caminhão</label>
                    <select
                      value={expenseForm.truckId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, truckId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Nenhum caminhão</option>
                      {trucks.map((truck) => (
                        <option key={truck.id} value={truck.id}>
                          {truck.plate} - {truck.brand} {truck.model}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cliente */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Cliente</label>
                    <select
                      value={expenseForm.clientId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, clientId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Nenhum cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} - {client.city}/{client.state}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateExpense}
                  >
                    Criar Despesa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Despesas da Viagem */}
      {showTripExpensesModal && selectedTripExpenses && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-blue-50">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-blue-900">
                  Despesas da Viagem: {selectedTripExpenses.tripCode ? `#${selectedTripExpenses.tripCode}` : `ID: ${selectedTripExpenses.tripId.substring(0, 8)}`}
                </h2>
                <div className="flex gap-3 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {selectedTripExpenses.origin} → {selectedTripExpenses.destination}
                  </span>
                  {selectedTripExpenses.clientName && (
                    <span>• Cliente: <strong>{selectedTripExpenses.clientName}</strong></span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowTripExpensesModal(false);
                  setSelectedTripExpenses(null);
                }}
                className="p-1 hover:bg-blue-100 rounded ml-4"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-3">
                {/* Total da Viagem */}
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-blue-900">Total de Despesas da Viagem</span>
                      <p className="text-xs text-gray-600 mt-1">{selectedTripExpenses.expenses.length} despesa(s)</p>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCurrency(selectedTripExpenses.expenses.reduce((sum, e) => sum + e.amount, 0))}
                    </span>
                  </div>
                </div>

                {/* Lista de Despesas */}
                {selectedTripExpenses.expenses.map((expense) => (
                  <div 
                    key={expense.id} 
                    className={`flex justify-between items-start p-4 rounded-lg border-2 ${
                      expense.isPaid 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{expense.description || expense.type}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Tipo: <span className="font-medium">{expense.type}</span>
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className={`text-2xl font-bold ${expense.isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                            {formatCurrency(expense.amount)}
                          </p>
                          <p className={`text-xs ${expense.isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                            {expense.isPaid ? '✓ Paga' : '⏰ Pendente'}
                          </p>
                        </div>
                      </div>

                      {/* Detalhes Adicionais */}
                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div>
                          <span className="text-gray-500">Data:</span>{' '}
                          <span className="font-medium">
                            {formatDateOnly(expense.date)}
                          </span>
                        </div>
                        {expense.truck && (
                          <div>
                            <span className="text-gray-500">Caminhão:</span>{' '}
                            <span className="font-medium flex items-center gap-1 inline-flex">
                              <Truck className="w-3 h-3" />
                              {expense.truck.plate}
                            </span>
                          </div>
                        )}
                        {expense.supplier && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Fornecedor:</span>{' '}
                            <span className="font-medium">{expense.supplier}</span>
                          </div>
                        )}
                        {expense.location && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Local:</span>{' '}
                            <span className="font-medium flex items-center gap-1 inline-flex">
                              <MapPin className="w-3 h-3" />
                              {expense.location}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botão de Fechar */}
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => navigate(`/trips/${selectedTripExpenses.tripId}`)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Ver detalhes da viagem
              </button>
              <Button
                type="button"
                onClick={() => {
                  setShowTripExpensesModal(false);
                  setSelectedTripExpenses(null);
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
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
