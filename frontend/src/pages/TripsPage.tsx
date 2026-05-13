import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { tripsAPI, driversAPI, clientsAPI, expensesAPI, trailersAPI, trucksAPI } from '@/lib/api';
import { Plus, Eye, Edit, Trash2, MapPin, Filter, Search, Clock, Play, CheckCircle, DollarSign, Package, Download, Upload, FileDown, XCircle } from 'lucide-react';
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
  notes?: string;
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
  legs?: Array<{
    id: string;
    status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
    waitingType?: 'LOADING' | 'UNLOADING';
    type: 'NORMAL' | 'AGUARDANDO' | 'REPOSICIONAMENTO';
  }>;
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
  // Send message modal (for in-progress trips)
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [tripToMessage, setTripToMessage] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Estados para modal de conclusão de viagem
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [tripToFinish, setTripToFinish] = useState<Trip | null>(null);
  const [finalMileage, setFinalMileage] = useState('');
  
  // Estados para modal de despesa
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [tripForExpense, setTripForExpense] = useState<Trip | null>(null);
  const [expenseData, setExpenseData] = useState({
    type: 'FUEL' as 'FUEL' | 'TOLL' | 'MAINTENANCE' | 'TIRE' | 'FOOD' | 'PARKING' | 'INSURANCE' | 'TAX' | 'SALARY' | 'OVERTIME' | 'OTHER',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  
  // Estados para modal de pausar viagem (deixar carreto)
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [tripToPause, setTripToPause] = useState<Trip | null>(null);
  const [pauseMileage, setPauseMileage] = useState('');
  const [pauseLocation, setPauseLocation] = useState('');
  const [waitingType, setWaitingType] = useState<'LOADING' | 'UNLOADING'>('LOADING');
  
  // Estados para modal de quilometragem ao resumir viagem
  const [showResumeMileageModal, setShowResumeMileageModal] = useState(false);
  const [tripToResumeWithMileage, setTripToResumeWithMileage] = useState<Trip | null>(null);
  const [resumeMileage, setResumeMileage] = useState('');
  
  // Estados para filtros avançados
  const [showFilters, setShowFilters] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [tripCodeFilter, setTripCodeFilter] = useState('');

  // Estados para modal de conclusão retroativa
  const [showCompleteRetroactiveModal, setShowCompleteRetroactiveModal] = useState(false);
  const [tripToCompleteRetroactive, setTripToCompleteRetroactive] = useState<Trip | null>(null);
  const [completeRetroactiveData, setCompleteRetroactiveData] = useState({
    endDate: new Date().toISOString().split('T')[0],
    endMileage: '',
    distance: '',
    fuelExpenses: [] as Array<{ description: string; amount: string; date: string }>,
    tollExpenses: [] as Array<{ description: string; amount: string; date: string }>,
    otherExpenses: [] as Array<{ description: string; amount: string; date: string; type: string }>,
  });
  
  // Estados para importação CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  
  // Dados para dropdowns
  const [clients, setClients] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trailers, setTrailers] = useState<any[]>([]);
  const [selectedTrailerId, setSelectedTrailerId] = useState<string>('');
  const [tripToStart, setTripToStart] = useState<Trip | null>(null);
  // Modal de carreta ao iniciar viagem
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  
  // Estados para modal de viagem retroativa
  const [showRetroactiveModal, setShowRetroactiveModal] = useState(false);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [tripCodeExists, setTripCodeExists] = useState(false);
  const [checkingTripCode, setCheckingTripCode] = useState(false);
  const [retroactiveData, setRetroactiveData] = useState({
    truckId: '',
    trailerId: '',
    driverId: '',
    clientId: '',
    tripCode: '',
    origin: '',
    destination: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    distance: '',
    revenue: '',
    expenses: [] as Array<{
      type: string;
      amount: string;
      description: string;
    }>
  });

  // Estados para modal de edição de viagem
  const [showEditModal, setShowEditModal] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<Trip | null>(null);
  const [editData, setEditData] = useState({
    truckId: '',
    trailerId: '',
    driverId: '',
    clientId: '',
    tripCode: '',
    origin: '',
    destination: '',
    startDate: '',
    endDate: '',
    distance: '',
    revenue: '',
    notes: '',
  });

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

  // Auto-refresh trips every 30 seconds for real-time updates
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchTrips();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [startDateFilter, endDateFilter, clientFilter, driverFilter, tripCodeFilter]);

  const loadFiltersData = async () => {
    try {
      const [clientsData, driversData, trailersData, trucksData] = await Promise.all([
        clientsAPI.getAll(),
        driversAPI.getAll(),
        trailersAPI.getAll(),
        trucksAPI.getAll(),
      ]);
      
      setClients(clientsData.filter((c: any) => c.active !== false));
      setDrivers(driversData.filter((d: any) => d.active !== false));
      setTrailers(trailersData.filter((t: any) => t.active !== false));
      setTrucks(trucksData.filter((t: any) => t.active !== false));
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
      
      // Se for motorista, filtrar apenas suas viagens (Manager e Admin veem todas)
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

  // Função para exportar todas as viagens para CSV
  const handleExportAllTrips = async () => {
    try {
      // Buscar despesas de todas as viagens
      const tripsWithExpenses = await Promise.all(
        trips.map(async (trip) => {
          try {
            const expenses = await expensesAPI.getByTrip(trip.id);
            return { ...trip, expenses };
          } catch (error) {
            return { ...trip, expenses: [] };
          }
        })
      );

      // Preparar dados CSV
      const csvRows = [];
      
      // Cabeçalho
      csvRows.push([
        'ID',
        'Código',
        'Origem',
        'Destino',
        'Data Início',
        'Data Fim',
        'Status',
        'Distância (km)',
        'Receita (R$)',
        'Custo Total (R$)',
        'Lucro (R$)',
        'Margem (%)',
        'Caminhão Placa',
        'Carreta Placa',
        'Motorista',
        'Cliente',
        'Observações',
        'Total Despesas',
        'Despesas Detalhadas'
      ].join(';'));

      // Dados
      tripsWithExpenses.forEach(trip => {
        const expensesDetail = trip.expenses.map((e: any) => 
          `${e.type}:${e.amount}:${e.description || ''}`
        ).join('|');
        
        const totalExpenses = trip.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);

        csvRows.push([
          trip.id,
          trip.tripCode || '',
          trip.origin,
          trip.destination,
          formatDateTime(trip.startDate),
          formatDateTime(trip.endDate),
          trip.status,
          trip.distance,
          trip.revenue,
          trip.totalCost,
          trip.profit,
          trip.profitMargin.toFixed(2),
          trip.truck.plate,
          trip.trailer?.plate || '',
          trip.driver.name,
          trip.client?.name || '',
          (trip.notes || '').replace(/;/g, ',').replace(/\n/g, ' '),
          totalExpenses,
          expensesDetail
        ].join(';'));
      });

      // Criar blob e download
      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `viagens_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${trips.length} viagens exportadas com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar viagens:', error);
      toast.error('Erro ao exportar viagens');
    }
  };

  // Função para importar viagens do CSV
  const handleImportCSV = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    try {
      const text = await importFile.text();
      const lines = text.split('\n');
      
      if (lines.length < 2) {
        toast.error('Arquivo CSV vazio ou inválido');
        return;
      }

      // Pular o cabeçalho
      const dataLines = lines.slice(1).filter(line => line.trim());
      
      let imported = 0;
      let errors = 0;

      for (const line of dataLines) {
        try {
          const columns = line.split(';');
          
          // Validação básica
          if (columns.length < 10) {
            errors++;
            continue;
          }

          // TODO: Implementar criação de viagem via API
          // const tripData = {
          //   tripCode: columns[1] || undefined,
          //   origin: columns[2],
          //   destination: columns[3],
          //   startDate: columns[4],
          //   status: columns[6] as any,
          //   distance: parseFloat(columns[7]) || 0,
          //   revenue: parseFloat(columns[8]) || 0,
          //   // Adicione outros campos conforme necessário
          // };
          // await tripsAPI.create(tripData);
          
          imported++;
        } catch (error) {
          console.error('Erro ao importar linha:', error);
          errors++;
        }
      }

      toast.success(`Importação concluída! ${imported} viagens importadas${errors > 0 ? `, ${errors} com erro` : ''}`);
      setShowImportModal(false);
      setImportFile(null);
      fetchTrips();
    } catch (error) {
      console.error('Erro ao importar CSV:', error);
      toast.error('Erro ao processar arquivo CSV');
    }
  };

  // Função para exportar uma viagem específica para CSV
  const handleExportSingleTrip = async (trip: Trip) => {
    try {
      // Buscar despesas da viagem
      const expenses = await expensesAPI.getByTrip(trip.id);
      
      // Preparar dados CSV
      const csvRows = [];
      
      // Cabeçalho da viagem
      csvRows.push(['DADOS DA VIAGEM']);
      csvRows.push(['Campo', 'Valor']);
      csvRows.push(['ID', trip.id]);
      csvRows.push(['Código', trip.tripCode || '']);
      csvRows.push(['Origem', trip.origin]);
      csvRows.push(['Destino', trip.destination]);
      csvRows.push(['Data Início', formatDateTime(trip.startDate)]);
      csvRows.push(['Data Fim', formatDateTime(trip.endDate)]);
      csvRows.push(['Status', trip.status]);
      csvRows.push(['Distância (km)', trip.distance]);
      csvRows.push(['Receita (R$)', trip.revenue]);
      csvRows.push(['Custo Total (R$)', trip.totalCost]);
      csvRows.push(['Lucro (R$)', trip.profit]);
      csvRows.push(['Margem (%)', trip.profitMargin.toFixed(2)]);
      csvRows.push(['Caminhão', trip.truck.plate + ' - ' + trip.truck.model]);
      csvRows.push(['Carreta', trip.trailer?.plate || 'N/A']);
      csvRows.push(['Motorista', trip.driver.name]);
      csvRows.push(['Cliente', trip.client?.name || 'N/A']);
      csvRows.push(['Observações', (trip.notes || '').replace(/;/g, ',').replace(/\n/g, ' ')]);
      csvRows.push([]);
      
      // Cabeçalho de despesas
      csvRows.push(['DESPESAS DA VIAGEM']);
      csvRows.push(['Data', 'Tipo', 'Descrição', 'Valor (R$)']);
      
      // Despesas
      if (expenses && expenses.length > 0) {
        expenses.forEach((expense: any) => {
          csvRows.push([
            formatDateOnly(expense.date),
            expense.type,
            (expense.description || '').replace(/;/g, ','),
            expense.amount.toFixed(2)
          ]);
        });
      } else {
        csvRows.push(['Nenhuma despesa registrada']);
      }

      // Criar blob e download
      const csvContent = csvRows.map(row => row.join(';')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const fileName = `viagem_${trip.tripCode || trip.id.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Dados da viagem exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar viagem:', error);
      toast.error('Erro ao exportar dados da viagem');
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

  

  const handleOpenMessageModal = async (id: string) => {
    setTripToMessage(id);
    setMessageText('');
    setShowMessageModal(true);
  };

  const confirmSendMessage = async () => {
    if (!tripToMessage) return;
    if (!messageText.trim()) {
      toast.error('Digite a mensagem para enviar');
      return;
    }
    try {
      await tripsAPI.sendMessage(tripToMessage, messageText.trim());
      toast.success('Mensagem enviada com sucesso ao motorista!');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao enviar mensagem');
    } finally {
      setShowMessageModal(false);
      setTripToMessage(null);
      setMessageText('');
    }
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

  const getTripDisplayStatus = (trip: Trip) => {
    if (trip.status !== 'IN_PROGRESS' || !trip.legs || trip.legs.length === 0) {
      return { text: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800' };
    }

    // Verificar se existe leg pausado
    const pausedLeg = trip.legs.find(leg => leg.status === 'PAUSED' && leg.type === 'AGUARDANDO');
    
    if (pausedLeg) {
      if (pausedLeg.waitingType === 'LOADING') {
        return { text: 'Carregando', color: 'bg-purple-100 text-purple-800' };
      } else if (pausedLeg.waitingType === 'UNLOADING') {
        return { text: 'Descarregando', color: 'bg-indigo-100 text-indigo-800' };
      }
    }

    // Se já descarregou, está retornando à garagem
    const stage = getTripWorkflowStage(trip);
    if (stage === 'returning') {
      return { text: 'Retornando à garagem', color: 'bg-blue-100 text-blue-800' };
    }

    return { text: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800' };
  };

  const isTripPaused = (trip: Trip): boolean => {
    if (!trip.legs || trip.legs.length === 0) return false;
    return trip.legs.some(leg => leg.status === 'PAUSED' && leg.type === 'AGUARDANDO');
  };

  const getTripWorkflowStage = (trip: Trip): 'initial' | 'delivering' | 'returning' => {
    if (!trip.legs || trip.legs.length === 0) return 'initial';
    
    // Verificar se já completou o carregamento
    const hasCompletedLoading = trip.legs.some(
      leg => leg.type === 'AGUARDANDO' && 
             leg.waitingType === 'LOADING' && 
             leg.status === 'COMPLETED'
    );
    
    // Verificar se já completou o descarregamento
    const hasCompletedUnloading = trip.legs.some(
      leg => leg.type === 'AGUARDANDO' && 
             leg.waitingType === 'UNLOADING' && 
             leg.status === 'COMPLETED'
    );
    
    if (hasCompletedUnloading) return 'returning'; // Após descarregar, retornando para garagem
    if (hasCompletedLoading) return 'delivering'; // Após carregar, indo para destino
    return 'initial'; // Ainda não carregou
  };

  const handleStartTrip = async (trip: Trip) => {
    // Buscar info do caminhão para saber se é sem capacidade
    try {
      const truck = await trucksAPI.getById(trip.truck.id);
      if (truck.noCapacity) {
        // Buscar carretas disponíveis
        const trailersList = await trailersAPI.getAll();
        setTrailers(trailersList);
        setTripToStart(trip);
        setShowTrailerModal(true);
        setSelectedTrailerId('');
        return;
      }
      // Caminhão com capacidade: inicia direto
      await tripsAPI.start(trip.id);
      toast.success('Viagem iniciada com sucesso!');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao iniciar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao iniciar viagem');
    }
  };

  const handleConfirmTrailer = async () => {
    if (!selectedTrailerId) {
      toast.error('Selecione uma carreta para iniciar a viagem');
      return;
    }
    if (!tripToStart) return;
    try {
      await tripsAPI.start(tripToStart.id, { trailerId: selectedTrailerId });
      toast.success('Viagem iniciada com sucesso!');
      setShowTrailerModal(false);
      setTripToStart(null);
      setSelectedTrailerId('');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao iniciar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao iniciar viagem');
    }
  };

  const handleOpenFinishModal = (trip: Trip) => {
    setTripToFinish(trip);
    setFinalMileage('');
    setShowFinishModal(true);
  };

  const handleFinishTrip = async () => {
    if (!tripToFinish) return;
    
    if (!finalMileage || parseFloat(finalMileage) <= 0) {
      toast.error('Informe a quilometragem final do caminhão');
      return;
    }

    try {
      await tripsAPI.finish(tripToFinish.id, { endMileage: parseFloat(finalMileage) });
      
      toast.success('Viagem concluída com sucesso!');
      setShowFinishModal(false);
      setTripToFinish(null);
      setFinalMileage('');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao concluir viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao concluir viagem');
    }
  };

  const handleOpenExpenseModal = (trip: Trip) => {
    setTripForExpense(trip);
    setExpenseData({
      type: 'FUEL',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
    setShowExpenseModal(true);
  };

  const handleCreateExpense = async () => {
    if (!tripForExpense) return;
    
    if (!expenseData.amount || parseFloat(expenseData.amount) <= 0) {
      toast.error('Informe o valor da despesa');
      return;
    }

    if (!expenseData.description.trim()) {
      toast.error('Informe a descrição da despesa');
      return;
    }

    try {
      // Criar data no meio-dia para evitar problemas de timezone
      const [year, month, day] = expenseData.date.split('-');
      const dateAtNoon = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
      
      await expensesAPI.create({
        ...expenseData,
        amount: parseFloat(expenseData.amount),
        truckId: tripForExpense.truck.id,
        tripId: tripForExpense.id,
        date: dateAtNoon.toISOString(),
      });
      
      toast.success('Despesa adicionada com sucesso!');
      setShowExpenseModal(false);
      setTripForExpense(null);
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao criar despesa:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar despesa');
    }
  };

  const handleOpenPauseModal = (trip: Trip, type: 'LOADING' | 'UNLOADING') => {
    setTripToPause(trip);
    setPauseMileage('');
    setPauseLocation(trip.destination || '');
    setWaitingType(type);
    setShowPauseModal(true);
  };

  const handlePauseTrip = async () => {
    if (!tripToPause) return;
    
    if (!pauseMileage || parseFloat(pauseMileage) <= 0) {
      toast.error('Informe a quilometragem atual do caminhão');
      return;
    }

    if (!pauseLocation.trim()) {
      toast.error('Informe o local onde o carreto ficará');
      return;
    }

    try {
      await tripsAPI.pause(tripToPause.id, {
        currentMileage: parseFloat(pauseMileage),
        location: pauseLocation,
        waitingType,
      });
      
      const successMessage = waitingType === 'LOADING' 
        ? 'Carreto deixado para carregamento. Você pode iniciar outra viagem!'
        : 'Carreto deixado para descarregamento. Você pode iniciar outra viagem!';
      
      toast.success(successMessage);
      setShowPauseModal(false);
      setTripToPause(null);
      setPauseMileage('');
      setPauseLocation('');
      setWaitingType('LOADING');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao pausar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao pausar viagem');
    }
  };

  const handleResumeTrip = async (trip: Trip) => {
    try {
      await tripsAPI.resume(trip.id, {});
      
      const pausedLeg = trip.legs?.find(leg => leg.status === 'PAUSED' && leg.type === 'AGUARDANDO');
      const successMessage = pausedLeg?.waitingType === 'LOADING' 
        ? 'Carreta carregada! Continue para o destino.'
        : pausedLeg?.waitingType === 'UNLOADING'
        ? 'Carreta descarregada! Retornando à garagem.'
        : 'Viagem retomada!';
      
      toast.success(successMessage);
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao continuar viagem:', error);
      
      // Se o erro for sobre precisar informar quilometragem, abrir modal
      if (error.response?.data?.message?.includes('Informe a quilometragem atual')) {
        setTripToResumeWithMileage(trip);
        setResumeMileage('');
        setShowResumeMileageModal(true);
      } else {
        toast.error(error.response?.data?.message || 'Erro ao continuar viagem');
      }
    }
  };

  const handleResumeWithMileage = async () => {
    if (!tripToResumeWithMileage) return;
    
    if (!resumeMileage || parseFloat(resumeMileage) <= 0) {
      toast.error('Informe a quilometragem atual do caminhão');
      return;
    }

    try {
      await tripsAPI.resume(tripToResumeWithMileage.id, { 
        currentMileage: parseFloat(resumeMileage) 
      });
      
      const pausedLeg = tripToResumeWithMileage.legs?.find(leg => leg.status === 'PAUSED' && leg.type === 'AGUARDANDO');
      const successMessage = pausedLeg?.waitingType === 'LOADING' 
        ? 'Carreta carregada! Continue para o destino.'
        : pausedLeg?.waitingType === 'UNLOADING'
        ? 'Carreta descarregada! Retornando à garagem.'
        : 'Viagem retomada!';
      
      toast.success(successMessage);
      setShowResumeMileageModal(false);
      setTripToResumeWithMileage(null);
      setResumeMileage('');
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao continuar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao continuar viagem');
    }
  };

  // Removidas funções handleOpenTrailerModal e handleCloseTrailerModal pois não são usadas

  // Funções para viagem retroativa
  const handleAddExpense = () => {
    setRetroactiveData({
      ...retroactiveData,
      expenses: [
        ...retroactiveData.expenses,
        { type: 'TOLL', amount: '', description: '' }
      ]
    });
  };

  const handleRemoveExpense = (index: number) => {
    setRetroactiveData({
      ...retroactiveData,
      expenses: retroactiveData.expenses.filter((_, i) => i !== index)
    });
  };

  const handleExpenseChange = (index: number, field: string, value: string) => {
    const newExpenses = [...retroactiveData.expenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setRetroactiveData({ ...retroactiveData, expenses: newExpenses });
  };

  // Verificar se o código da viagem já existe
  const checkTripCode = async (tripCode: string) => {
    if (!tripCode || tripCode.trim() === '') {
      setTripCodeExists(false);
      return;
    }

    try {
      setCheckingTripCode(true);
      const response = await tripsAPI.checkTripCode(tripCode.trim());
      setTripCodeExists(response.exists);
      
      if (response.exists) {
        toast.error(`Código "${tripCode}" já existe em outra viagem`);
      }
    } catch (error) {
      console.error('Erro ao verificar código da viagem:', error);
    } finally {
      setCheckingTripCode(false);
    }
  };

  // Função para tratar mudança no código da viagem com debounce
  const handleTripCodeChange = (tripCode: string) => {
    setRetroactiveData({...retroactiveData, tripCode});
    
    // Debounce: aguardar 500ms antes de verificar
    if ((window as any).tripCodeTimeout) {
      clearTimeout((window as any).tripCodeTimeout);
    }
    
    (window as any).tripCodeTimeout = setTimeout(() => {
      checkTripCode(tripCode);
    }, 500);
  };

  const handleSubmitRetroactive = async () => {
    try {
      // Verificar se o código da viagem já existe
      if (tripCodeExists) {
        toast.error('Não é possível criar viagem com código duplicado');
        return;
      }

      // Validações
      if (!retroactiveData.truckId || !retroactiveData.driverId || !retroactiveData.origin || 
          !retroactiveData.destination || !retroactiveData.startDate || !retroactiveData.startTime ||
          !retroactiveData.endDate || !retroactiveData.endTime || !retroactiveData.distance || 
          !retroactiveData.revenue) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      // Combinar data e hora
      const startDateTime = new Date(`${retroactiveData.startDate}T${retroactiveData.startTime}`);
      const endDateTime = new Date(`${retroactiveData.endDate}T${retroactiveData.endTime}`);

      // Validar datas
      if (endDateTime <= startDateTime) {
        toast.error('A data de término deve ser posterior à data de início');
        return;
      }

      if (endDateTime > new Date()) {
        toast.error('A data de término não pode ser futura');
        return;
      }

      // Criar viagem
      const tripData = {
        truckId: retroactiveData.truckId,
        trailerId: retroactiveData.trailerId || undefined,
        driverId: retroactiveData.driverId,
        clientId: retroactiveData.clientId || undefined,
        tripCode: retroactiveData.tripCode || undefined,
        origin: retroactiveData.origin,
        destination: retroactiveData.destination,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        distance: parseFloat(retroactiveData.distance),
        revenue: parseFloat(retroactiveData.revenue),
        status: 'COMPLETED',
        isRetroactive: true,
      };

      const createdTrip = await tripsAPI.create(tripData);

      // Adicionar despesas adicionais se houver (combustível é calculado automaticamente)
      if (retroactiveData.expenses.length > 0) {
        for (const expense of retroactiveData.expenses) {
          if (expense.amount && parseFloat(expense.amount) > 0) {
            // Criar data no meio-dia para evitar problemas de timezone
            const [year, month, day] = retroactiveData.startDate.split('-');
            const expenseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
            
            await expensesAPI.create({
              tripId: createdTrip.id,
              truckId: retroactiveData.truckId,
              type: expense.type,
              amount: parseFloat(expense.amount),
              description: expense.description || undefined,
              date: expenseDate.toISOString(),
              isPaid: true, // Viagens retroativas já aconteceram, despesas já foram pagas
            });
          }
        }
      }

      toast.success('Viagem retroativa criada com sucesso!');
      setShowRetroactiveModal(false);
      setTripCodeExists(false);
      setCheckingTripCode(false);
      setRetroactiveData({
        truckId: '',
        trailerId: '',
        driverId: '',
        clientId: '',
        tripCode: '',
        origin: '',
        destination: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        distance: '',
        revenue: '',
        expenses: []
      });
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao criar viagem retroativa:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar viagem retroativa');
    }
  };

  // Função para concluir viagem agendada retroativamente
  const handleCompleteRetroactive = async () => {
    if (!tripToCompleteRetroactive) return;

    // Validações básicas
    if (!completeRetroactiveData.endDate) {
      toast.error('Informe a data de conclusão');
      return;
    }

    if (!completeRetroactiveData.distance || parseFloat(completeRetroactiveData.distance) <= 0) {
      toast.error('Informe a distância percorrida');
      return;
    }

    try {
      const payload = {
        endDate: completeRetroactiveData.endDate,
        endMileage: completeRetroactiveData.endMileage ? parseFloat(completeRetroactiveData.endMileage) : undefined,
        distance: parseFloat(completeRetroactiveData.distance),
        fuelExpenses: completeRetroactiveData.fuelExpenses.filter(e => e.amount && parseFloat(e.amount) > 0).map(e => ({
          description: e.description || 'Combustível',
          amount: parseFloat(e.amount),
          date: e.date || completeRetroactiveData.endDate,
        })),
        tollExpenses: completeRetroactiveData.tollExpenses.filter(e => e.amount && parseFloat(e.amount) > 0).map(e => ({
          description: e.description || 'Pedágio',
          amount: parseFloat(e.amount),
          date: e.date || completeRetroactiveData.endDate,
        })),
        otherExpenses: completeRetroactiveData.otherExpenses.filter(e => e.amount && parseFloat(e.amount) > 0).map(e => ({
          type: e.type || 'OTHER',
          description: e.description || 'Outras despesas',
          amount: parseFloat(e.amount),
          date: e.date || completeRetroactiveData.endDate,
        })),
      };

      await tripsAPI.completeRetroactive(tripToCompleteRetroactive.id, payload);
      toast.success('Viagem concluída com sucesso!');
      setShowCompleteRetroactiveModal(false);
      setTripToCompleteRetroactive(null);
      setCompleteRetroactiveData({
        endDate: new Date().toISOString().split('T')[0],
        endMileage: '',
        distance: '',
        fuelExpenses: [],
        tollExpenses: [],
        otherExpenses: [],
      });
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao concluir viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao concluir viagem');
    }
  };

  // Função para abrir modal de edição
  const handleOpenEditModal = (trip: Trip) => {
    setTripToEdit(trip);
    setEditData({
      truckId: trip.truck.id,
      trailerId: trip.trailer?.id || '',
      driverId: trip.driver.id,
      clientId: trip.client?.id || '',
      tripCode: trip.tripCode || '',
      origin: trip.origin,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate || '',
      distance: trip.distance?.toString() || '',
      revenue: trip.revenue?.toString() || '',
      notes: trip.notes || '',
    });
    setShowEditModal(true);
  };

  // Converter data ISO para formato datetime-local (sem conversão de timezone)
  const formatDateTimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    // Remover o 'Z' e pegar apenas YYYY-MM-DDTHH:mm
    return isoString.slice(0, 16);
  };

  // Formatar data para exibição sem conversão de timezone
  const formatDateTime = (isoString: string | null | undefined): string => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  };

  // Formatar data curta (DD/MM, HH:mm) para o Kanban
  const formatDateShort = (isoString: string | null | undefined): string => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}, ${hours}:${minutes}`;
  };

  // Formatar apenas data (DD/MM/YYYY)
  const formatDateOnly = (isoString: string | null | undefined): string => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Função para salvar alterações da viagem
  const handleSaveEdit = async () => {
    if (!tripToEdit) return;


    // Validações básicas
    if (!editData.truckId || !editData.driverId || !editData.clientId) {
      toast.error('Caminhão, motorista e cliente são obrigatórios');
      return;
    }

    if (!editData.origin || !editData.destination) {
      toast.error('Origem e destino são obrigatórios');
      return;
    }

    try {
      await tripsAPI.update(tripToEdit.id, {
        ...editData,
        distance: parseFloat(editData.distance) || 0,
        revenue: parseFloat(editData.revenue) || 0,
      });

      toast.success('Viagem atualizada com sucesso');
      setShowEditModal(false);
      setTripToEdit(null);
      setEditData({
        truckId: '',
        trailerId: '',
        driverId: '',
        clientId: '',
        tripCode: '',
        origin: '',
        destination: '',
        startDate: '',
        endDate: '',
        distance: '',
        revenue: '',
        notes: '',
      });
      fetchTrips();
    } catch (error: any) {
      console.error('Erro ao atualizar viagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao atualizar viagem');
    }
  };

  // Separate trips by status for Kanban columns
  const plannedTrips = trips.filter(trip => trip.status === 'PLANNED' || trip.status === 'DELAYED');
  const inProgressTrips = trips.filter(trip => trip.status === 'IN_PROGRESS');
  const completedTrips = trips.filter(trip => trip.status === 'COMPLETED');

  // On mobile, for drivers we want the in-progress column to appear first
  const driverHasInProgress = !!(user && user.role === 'DRIVER' && inProgressTrips.some(t => t.driver.id === user.id));
  // Sorted arrays: for drivers, ensure their in-progress trip and next planned trip appear first
  const sortedInProgress = [...inProgressTrips].sort((a, b) => {
    if (!user) return 0;
    const aIsDriver = a.driver.id === user.id;
    const bIsDriver = b.driver.id === user.id;
    if (aIsDriver && !bIsDriver) return -1;
    if (!aIsDriver && bIsDriver) return 1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const sortedPlanned = [...plannedTrips].sort((a, b) => {
    if (!user) return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    const aIsDriver = a.driver.id === user.id;
    const bIsDriver = b.driver.id === user.id;
    if (aIsDriver && !bIsDriver) return -1;
    if (!aIsDriver && bIsDriver) return 1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const sortedCompleted = [...completedTrips].sort((a, b) => {
    // most recent completed first
    return (new Date(b.endDate || 0).getTime()) - (new Date(a.endDate || 0).getTime());
  });

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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Viagens</h1>
        <div className="flex flex-col md:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full md:w-auto"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportAllTrips}
            className="w-full md:w-auto border-green-500 text-green-700 hover:bg-green-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="w-full md:w-auto border-blue-500 text-blue-700 hover:bg-blue-50"
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </Button>
              <Button onClick={() => navigate('/trips/new')} className="w-full md:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nova Viagem
              </Button>
              <Button 
                onClick={() => setShowRetroactiveModal(true)} 
                variant="outline"
                className="w-full md:w-auto border-purple-500 text-purple-700 hover:bg-purple-50"
              >
                <Clock className="mr-2 h-4 w-4" />
                Viagem Retroativa
              </Button>
            </>
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
        <div className={`${driverHasInProgress ? 'order-2 lg:order-none' : ''} bg-blue-50 rounded-lg p-4 min-h-[600px]`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Agendadas</h3>
            <span className="text-sm bg-white px-2 py-1 rounded-full">
              {plannedTrips.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
            {plannedTrips.length === 0 ? (
              <Card className="bg-white/50">
                <CardContent className="p-5 text-center text-sm text-gray-500">
                  Nenhuma viagem agendada
                </CardContent>
              </Card>
            ) : (
              sortedPlanned.map((trip) => {
                const start = new Date(trip.startDate).getTime();
                const overdue = (trip.status === 'DELAYED') || (start < currentTime && trip.status === 'PLANNED');
                return (
                <Card key={trip.id} className={`hover:shadow-lg transition-shadow ${overdue ? 'bg-red-50 border border-red-100' : 'bg-white'}`}>
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-normal">
                              {trip.origin} → {trip.destination}
                            </p>
                            {trip.tripCode && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Código: {trip.tripCode}
                              </p>
                            )}
                          </div>
                        </div>
                        {(() => {
                          const start = new Date(trip.startDate).getTime();
                          const overdue = (trip.status === 'DELAYED') || (start < currentTime && trip.status === 'PLANNED');
                          return (
                            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 ${overdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                              {overdue ? 'Atrasada' : 'Agendada'}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Trip Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Caminhão:</span>
                          <p className="font-medium uppercase">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium uppercase">{trip.trailer.plate}</p>
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

                      {/* Date and Distance in same line */}
                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <div>
                          <span className="text-gray-500">Início:</span>
                          <span className="font-medium ml-1">
                            {formatDateShort(trip.startDate)}
                          </span>
                        </div>
                        {trip.distance > 0 && (
                          <div>
                            <span className="text-gray-500">Distância:</span>
                            <span className="font-medium ml-1">{trip.distance.toFixed(0)} km</span>
                          </div>
                        )}
                      </div>

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Custos:</span>
                            <p className="font-medium text-red-600">
                              {formatCurrency(trip.totalCost)}
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
                        {/* Botão Iniciar Viagem - Motorista e Manager */}
                        {((user?.role === 'DRIVER' && trip.driver.id === user.id) || user?.role === 'MANAGER') && (
                          <Button
                            size="sm"
                            onClick={() => handleStartTrip(trip)}
                            className="flex-1 min-w-[90px] text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Iniciar
                          </Button>
                        )}
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
                              onClick={() => handleOpenEditModal(trip)}
                              className="flex-1 min-w-[70px] text-xs h-8"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setTripToCompleteRetroactive(trip);
                                setCompleteRetroactiveData({
                                  endDate: new Date().toISOString().split('T')[0],
                                  endMileage: '',
                                  distance: trip.distance ? trip.distance.toString() : '',
                                  fuelExpenses: [],
                                  tollExpenses: [],
                                  otherExpenses: [],
                                });
                                setShowCompleteRetroactiveModal(true);
                              }}
                              className="flex-1 min-w-[90px] text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Concluir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenMessageModal(trip.id)}
                              className="flex-1 min-w-[70px] text-xs h-8"
                            >
                              <svg className="w-3 h-3 mr-1 text-green-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path fill="currentColor" d="M20.52 3.48A11.94 11.94 0 0012 0C5.37 0 .01 5.37.01 12a11.9 11.9 0 001.64 6.05L0 24l6.11-1.6A11.94 11.94 0 0012 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.2-3.48-8.52zM12 21.5c-1.72 0-3.38-.46-4.85-1.33l-.35-.21-3.62.95.98-3.53-.22-.36A8.5 8.5 0 013.5 12C3.5 7.26 7.26 3.5 12 3.5S20.5 7.26 20.5 12 16.74 21.5 12 21.5z" />
                                <path fill="currentColor" d="M15.57 14.24c-.28-.14-1.66-.82-1.92-.91-.26-.09-.45-.14-.64.14s-.73.91-.9 1.1c-.17.18-.34.2-.63.07-.29-.14-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.59.13-.12.29-.31.43-.47.14-.16.19-.27.29-.45.09-.18.05-.34-.02-.48-.07-.14-.64-1.54-.88-2.12-.23-.56-.47-.48-.64-.49-.17-.01-.37-.01-.57-.01-.19 0-.5.07-.76.34-.26.27-1 1-1 2.43 0 1.43 1.03 2.81 1.17 3.01.14.2 2.02 3.08 4.9 4.32 2.14.94 2.98 1.02 3.22.96.25-.07 1.66-.68 1.9-1.33.25-.65.25-1.2.17-1.33-.07-.13-.26-.19-.54-.33z" />
                              </svg>
                              Mensagem
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
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: IN_PROGRESS (Em Andamento) - Yellow */}
        <div className={`${driverHasInProgress ? 'order-1 lg:order-none' : ''} bg-yellow-50 rounded-lg p-4 min-h-[600px]`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Em Andamento</h3>
            <span className="text-sm bg-white px-2 py-1 rounded-full">
              {inProgressTrips.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
            {inProgressTrips.length === 0 ? (
              <Card className="bg-white/50">
                <CardContent className="p-5 text-center text-sm text-gray-500">
                  Nenhuma viagem em andamento
                </CardContent>
              </Card>
            ) : (
              sortedInProgress.map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-normal">
                              {trip.origin} → {trip.destination}
                            </p>
                            {trip.tripCode && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Código: {trip.tripCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 ${getTripDisplayStatus(trip).color}`}>
                          {getTripDisplayStatus(trip).text}
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
                          <p className="font-medium uppercase">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium uppercase">{trip.trailer.plate}</p>
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
                        <div>
                          <span className="text-gray-500">Início:</span>
                          <p className="font-medium">
                            {formatDateTime(trip.startDate)}
                          </p>
                        </div>
                        {trip.distance > 0 && (
                          <div>
                            <span className="text-gray-500">Distância:</span>
                            <p className="font-medium">{trip.distance.toFixed(0)} km</p>
                          </div>
                        )}
                      </div>

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Custos:</span>
                            <p className="font-medium text-red-600">
                              {formatCurrency(trip.totalCost)}
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
                        {/* Botões para Motorista da viagem e Manager */}
                        {((user?.role === 'DRIVER' && trip.driver.id === user.id) || user?.role === 'MANAGER') && (
                          <>
                            {isTripPaused(trip) ? (
                              // Botão contextual quando estiver pausado
                              <Button
                                size="sm"
                                onClick={() => handleResumeTrip(trip)}
                                className="flex-1 min-w-[100px] text-xs h-8 text-white"
                                style={{ backgroundColor: '#86efac', color: 'white' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4ade80'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#86efac'}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                {trip.legs?.find(leg => leg.status === 'PAUSED' && leg.waitingType === 'LOADING')
                                  ? 'Carreta carregada'
                                  : trip.legs?.find(leg => leg.status === 'PAUSED' && leg.waitingType === 'UNLOADING')
                                  ? 'Carreta descarregada'
                                  : 'Continuar'}
                              </Button>
                            ) : (
                              // Botões baseados no estágio do workflow
                              <>
                                {getTripWorkflowStage(trip) === 'initial' && (
                                  // Estágio inicial: só pode carregar (na origem)
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenPauseModal(trip, 'LOADING')}
                                    className="flex-1 min-w-[100px] text-xs h-8 text-white"
                                    style={{ backgroundColor: '#c084fc', color: 'white' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#a855f7'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#c084fc'}
                                  >
                                    <Package className="w-3 h-3 mr-1" />
                                    Carregar
                                  </Button>
                                )}
                                {getTripWorkflowStage(trip) === 'delivering' && (
                                  // Já carregou, indo para destino: só pode descarregar
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenPauseModal(trip, 'UNLOADING')}
                                    className="flex-1 min-w-[100px] text-xs h-8 text-white"
                                    style={{ backgroundColor: '#c084fc', color: 'white' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#a855f7'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#c084fc'}
                                  >
                                    <Package className="w-3 h-3 mr-1" />
                                    Descarregar
                                  </Button>
                                )}
                                {getTripWorkflowStage(trip) === 'returning' && (
                                  // Já descarregou, retornando: pode concluir
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenFinishModal(trip)}
                                    className="flex-1 min-w-[90px] text-xs h-8 text-white"
                                    style={{ backgroundColor: '#86efac', color: 'white' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4ade80'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#86efac'}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Concluir
                                  </Button>
                                )}
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenExpenseModal(trip)}
                              className="flex-1 min-w-[90px] text-xs h-8"
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              Despesa
                            </Button>
                          </>
                        )}
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
                              onClick={() => handleOpenExpenseModal(trip)}
                              className="flex-1 min-w-[90px] text-xs h-8"
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              Despesa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenMessageModal(trip.id)}
                              className="flex-1 min-w-[70px] text-xs h-8"
                            >
                              <svg className="w-3 h-3 mr-1 text-green-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path fill="currentColor" d="M20.52 3.48A11.94 11.94 0 0012 0C5.37 0 .01 5.37.01 12a11.9 11.9 0 001.64 6.05L0 24l6.11-1.6A11.94 11.94 0 0012 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.2-3.48-8.52zM12 21.5c-1.72 0-3.38-.46-4.85-1.33l-.35-.21-3.62.95.98-3.53-.22-.36A8.5 8.5 0 013.5 12C3.5 7.26 7.26 3.5 12 3.5S20.5 7.26 20.5 12 16.74 21.5 12 21.5z" />
                                <path fill="currentColor" d="M15.57 14.24c-.28-.14-1.66-.82-1.92-.91-.26-.09-.45-.14-.64.14s-.73.91-.9 1.1c-.17.18-.34.2-.63.07-.29-.14-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.59.13-.12.29-.31.43-.47.14-.16.19-.27.29-.45.09-.18.05-.34-.02-.48-.07-.14-.64-1.54-.88-2.12-.23-.56-.47-.48-.64-.49-.17-.01-.37-.01-.57-.01-.19 0-.5.07-.76.34-.26.27-1 1-1 2.43 0 1.43 1.03 2.81 1.17 3.01.14.2 2.02 3.08 4.9 4.32 2.14.94 2.98 1.02 3.22.96.25-.07 1.66-.68 1.9-1.33.25-.65.25-1.2.17-1.33-.07-.13-.26-.19-.54-.33z" />
                              </svg>
                              Mensagem
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(trip.id)}
                              className="flex-1 min-w-[70px] text-xs h-8 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Excluir
                            </Button>
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

        {/* Column 3: COMPLETED (Concluídas) - Green */}
        <div className={`${driverHasInProgress ? 'order-3 lg:order-none' : ''} bg-green-50 rounded-lg p-4 min-h-[600px]`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Concluídas</h3>
            <span className="text-sm bg-white px-2 py-1 rounded-full">
              {completedTrips.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
            {completedTrips.length === 0 ? (
              <Card className="bg-white/50">
                <CardContent className="p-5 text-center text-sm text-gray-500">
                  Nenhuma viagem concluída
                </CardContent>
              </Card>
            ) : (
              sortedCompleted.map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-normal">
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
                          <p className="font-medium uppercase">{trip.truck.plate}</p>
                        </div>
                        {trip.trailer && (
                          <div>
                            <span className="text-gray-500">Reboque:</span>
                            <p className="font-medium uppercase">{trip.trailer.plate}</p>
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
                        <div>
                          <span className="text-gray-500">Concluída em:</span>
                          <p className="font-medium">
                            {trip.endDate ? formatDateTime(trip.endDate) : 'N/A'}
                          </p>
                        </div>
                        {trip.distance > 0 && (
                          <div>
                            <span className="text-gray-500">Distância:</span>
                            <p className="font-medium">{trip.distance.toFixed(0)} km</p>
                          </div>
                        )}
                      </div>

                      {/* Financial Data */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-gray-500">Receita:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(trip.revenue)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Custos:</span>
                            <p className="font-medium text-red-600">
                              {formatCurrency(trip.totalCost)}
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportSingleTrip(trip)}
                          className="flex-1 min-w-[70px] text-xs h-8 text-green-600 hover:text-green-700"
                        >
                          <FileDown className="w-3 h-3 mr-1" />
                          CSV
                        </Button>
                        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditModal(trip)}
                              className="flex-1 min-w-[70px] text-xs h-8"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(trip.id)}
                              className="flex-1 min-w-[70px] text-xs h-8 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Excluir
                            </Button>
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

    {/* Modal de Importação CSV */}
    {showImportModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Importar Viagens (CSV)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-700 mb-3">
                  Selecione um arquivo CSV para importar viagens. O arquivo deve seguir o formato exportado pelo sistema.
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">
                      {importFile ? importFile.name : 'Clique para selecionar arquivo'}
                    </span>
                  </label>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Atenção:</strong> A importação criará novas viagens. Certifique-se de que os dados estão corretos antes de importar.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleImportCSV}
                disabled={!importFile}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar
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

    {/* Modal de Enviar Mensagem (para viagens em andamento) */}
    {showMessageModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Enviar Mensagem</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">Digite a mensagem que será enviada ao motorista:</p>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-4 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowMessageModal(false);
                  setTripToMessage(null);
                  setMessageText('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmSendMessage}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Enviar Mensagem
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Conclusão de Viagem */}
    {showFinishModal && tripToFinish && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Concluir Viagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Viagem: <span className="font-medium">{tripToFinish.origin} → {tripToFinish.destination}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Caminhão: <span className="font-medium uppercase">{tripToFinish.truck.plate}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quilometragem Final do Caminhão *
                </label>
                <input
                  type="number"
                  value={finalMileage}
                  onChange={(e) => setFinalMileage(e.target.value)}
                  placeholder="Ex: 125500"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Informe a quilometragem atual do caminhão ao finalizar a viagem
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowFinishModal(false);
                  setTripToFinish(null);
                  setFinalMileage('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleFinishTrip}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Concluir Viagem
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Pausar Viagem (Deixar Carreto) */}
    {showPauseModal && tripToPause && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className={waitingType === 'LOADING' ? 'text-orange-600' : 'text-purple-600'}>
              {waitingType === 'LOADING' ? 'Deixar Carreto Carregando' : 'Deixar Carreto Descarregando'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Viagem: <span className="font-medium">{tripToPause.origin} → {tripToPause.destination}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Caminhão: <span className="font-medium uppercase">{tripToPause.truck.plate}</span>
                </p>
                {tripToPause.trailer && (
                  <p className="text-sm text-gray-600 mb-4">
                    Carreto: <span className="font-medium uppercase">{tripToPause.trailer.plate}</span>
                  </p>
                )}
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-xs text-yellow-800">
                  <strong>💡 Atenção:</strong> Ao deixar o carreto {waitingType === 'LOADING' ? 'carregando' : 'descarregando'}, você poderá iniciar outra viagem com o mesmo caminhão. O sistema criará automaticamente os trechos necessários.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quilometragem Atual do Caminhão *
                </label>
                <input
                  type="number"
                  value={pauseMileage}
                  onChange={(e) => setPauseMileage(e.target.value)}
                  placeholder="Ex: 50080"
                  min="0"
                  step="0.1"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${waitingType === 'LOADING' ? 'focus:ring-orange-500' : 'focus:ring-purple-500'}`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Local onde o carreto ficará *
                </label>
                <input
                  type="text"
                  value={pauseLocation}
                  onChange={(e) => setPauseLocation(e.target.value)}
                  placeholder="Ex: Cliente X - Endereço"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${waitingType === 'LOADING' ? 'focus:ring-orange-500' : 'focus:ring-purple-500'}`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Informe onde o caminhão está deixando o carreto para {waitingType === 'LOADING' ? 'carregamento' : 'descarregamento'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPauseModal(false);
                  setTripToPause(null);
                  setPauseMileage('');
                  setPauseLocation('');
                  setWaitingType('LOADING');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handlePauseTrip}
                className={waitingType === 'LOADING' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}
              >
                <Package className="w-4 h-4 mr-2" />
                {waitingType === 'LOADING' ? 'Deixar Carregando' : 'Deixar Descarregando'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Quilometragem ao Resumir Viagem */}
    {showResumeMileageModal && tripToResumeWithMileage && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Quilometragem Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Viagem: <span className="font-medium">{tripToResumeWithMileage.origin} → {tripToResumeWithMileage.destination}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Caminhão: <span className="font-medium uppercase">{tripToResumeWithMileage.truck.plate}</span>
                </p>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>💡 Atenção:</strong> O caminhão participou de outras viagens enquanto a carreta estava aguardando. Informe a quilometragem atual do caminhão para continuarmos.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quilometragem Atual do Caminhão *
                </label>
                <input
                  type="number"
                  value={resumeMileage}
                  onChange={(e) => setResumeMileage(e.target.value)}
                  placeholder="Ex: 50150"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Informe a quilometragem atual do caminhão ao retomar a viagem
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowResumeMileageModal(false);
                  setTripToResumeWithMileage(null);
                  setResumeMileage('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleResumeWithMileage}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="w-4 h-4 mr-2" />
                Continuar Viagem
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Conclusão Retroativa */}
    {showCompleteRetroactiveModal && tripToCompleteRetroactive && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <Card className="w-full max-w-4xl my-8">
          <CardHeader>
            <CardTitle className="text-purple-600">Concluir Viagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Informações da Viagem */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium mb-2">{tripToCompleteRetroactive.origin} → {tripToCompleteRetroactive.destination}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600">
                  <p>Código: <span className="font-medium">{tripToCompleteRetroactive.tripCode || '-'}</span></p>
                  <p>Caminhão: <span className="font-medium uppercase">{tripToCompleteRetroactive.truck.plate}</span></p>
                  <p>Motorista: <span className="font-medium">{tripToCompleteRetroactive.driver.name}</span></p>
                </div>
              </div>

              {/* Dados de Conclusão */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Conclusão *</label>
                  <input
                    type="date"
                    value={completeRetroactiveData.endDate}
                    onChange={(e) => setCompleteRetroactiveData({ ...completeRetroactiveData, endDate: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quilometragem Final</label>
                  <input
                    type="number"
                    value={completeRetroactiveData.endMileage}
                    onChange={(e) => setCompleteRetroactiveData({ ...completeRetroactiveData, endMileage: e.target.value })}
                    placeholder="Ex: 125000"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distância (KM) *</label>
                  <input
                    type="number"
                    value={completeRetroactiveData.distance}
                    onChange={(e) => setCompleteRetroactiveData({ ...completeRetroactiveData, distance: e.target.value })}
                    placeholder="Ex: 430"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>

              {/* Despesas de Combustível */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Despesas de Combustível</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCompleteRetroactiveData({
                      ...completeRetroactiveData,
                      fuelExpenses: [...completeRetroactiveData.fuelExpenses, { description: '', amount: '', date: completeRetroactiveData.endDate }]
                    })}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
                {completeRetroactiveData.fuelExpenses.map((expense, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Descrição"
                      value={expense.description}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.fuelExpenses];
                        newExpenses[index].description = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, fuelExpenses: newExpenses });
                      }}
                      className="col-span-5 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor (R$)"
                      value={expense.amount}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.fuelExpenses];
                        newExpenses[index].amount = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, fuelExpenses: newExpenses });
                      }}
                      className="col-span-3 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="date"
                      value={expense.date}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.fuelExpenses];
                        newExpenses[index].date = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, fuelExpenses: newExpenses });
                      }}
                      className="col-span-3 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCompleteRetroactiveData({
                        ...completeRetroactiveData,
                        fuelExpenses: completeRetroactiveData.fuelExpenses.filter((_, i) => i !== index)
                      })}
                      className="col-span-1 text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Despesas de Pedágio */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Despesas de Pedágio</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCompleteRetroactiveData({
                      ...completeRetroactiveData,
                      tollExpenses: [...completeRetroactiveData.tollExpenses, { description: '', amount: '', date: completeRetroactiveData.endDate }]
                    })}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
                {completeRetroactiveData.tollExpenses.map((expense, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Descrição"
                      value={expense.description}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.tollExpenses];
                        newExpenses[index].description = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, tollExpenses: newExpenses });
                      }}
                      className="col-span-5 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor (R$)"
                      value={expense.amount}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.tollExpenses];
                        newExpenses[index].amount = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, tollExpenses: newExpenses });
                      }}
                      className="col-span-3 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="date"
                      value={expense.date}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.tollExpenses];
                        newExpenses[index].date = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, tollExpenses: newExpenses });
                      }}
                      className="col-span-3 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCompleteRetroactiveData({
                        ...completeRetroactiveData,
                        tollExpenses: completeRetroactiveData.tollExpenses.filter((_, i) => i !== index)
                      })}
                      className="col-span-1 text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Outras Despesas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Outras Despesas</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCompleteRetroactiveData({
                      ...completeRetroactiveData,
                      otherExpenses: [...completeRetroactiveData.otherExpenses, { description: '', amount: '', date: completeRetroactiveData.endDate, type: 'OTHER' }]
                    })}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
                {completeRetroactiveData.otherExpenses.map((expense, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                    <select
                      value={expense.type}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.otherExpenses];
                        newExpenses[index].type = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, otherExpenses: newExpenses });
                      }}
                      className="col-span-2 p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="OTHER">Outro</option>
                      <option value="MAINTENANCE">Manutenção</option>
                      <option value="TIRE">Pneu</option>
                      <option value="FOOD">Alimentação</option>
                      <option value="PARKING">Estacionamento</option>
                      <option value="INSURANCE">Seguro</option>
                      <option value="TAX">Impostos</option>
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <>
                          <option value="SALARY">Salário</option>
                          <option value="OVERTIME">Hora Extra</option>
                        </>
                      )}
                    </select>
                    <input
                      type="text"
                      placeholder="Descrição"
                      value={expense.description}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.otherExpenses];
                        newExpenses[index].description = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, otherExpenses: newExpenses });
                      }}
                      className="col-span-4 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor (R$)"
                      value={expense.amount}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.otherExpenses];
                        newExpenses[index].amount = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, otherExpenses: newExpenses });
                      }}
                      className="col-span-2 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="date"
                      value={expense.date}
                      onChange={(e) => {
                        const newExpenses = [...completeRetroactiveData.otherExpenses];
                        newExpenses[index].date = e.target.value;
                        setCompleteRetroactiveData({ ...completeRetroactiveData, otherExpenses: newExpenses });
                      }}
                      className="col-span-3 p-2 border border-gray-300 rounded-md text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCompleteRetroactiveData({
                        ...completeRetroactiveData,
                        otherExpenses: completeRetroactiveData.otherExpenses.filter((_, i) => i !== index)
                      })}
                      className="col-span-1 text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCompleteRetroactiveModal(false);
                    setTripToCompleteRetroactive(null);
                    setCompleteRetroactiveData({
                      endDate: new Date().toISOString().split('T')[0],
                      endMileage: '',
                      distance: '',
                      fuelExpenses: [],
                      tollExpenses: [],
                      otherExpenses: [],
                    });
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleCompleteRetroactive}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Concluir Viagem
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Edição de Viagem */}
    {showEditModal && tripToEdit && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-blue-600">Editar Viagem</h2>
            <p className="text-gray-600">Código: {tripToEdit.tripCode}</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Código da Viagem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código da Viagem</label>
                <input
                  type="text"
                  value={editData.tripCode}
                  onChange={(e) => setEditData({ ...editData, tripCode: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente * <span className="text-red-500">obrigatório</span>
                </label>
                <select
                  value={editData.clientId}
                  onChange={(e) => setEditData({ ...editData, clientId: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              {/* Caminhão */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caminhão * <span className="text-red-500">obrigatório</span>
                </label>
                <select
                  value={editData.truckId}
                  onChange={(e) => setEditData({ ...editData, truckId: e.target.value })}
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

              {/* Carreta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carreta</label>
                <select
                  value={editData.trailerId}
                  onChange={(e) => setEditData({ ...editData, trailerId: e.target.value })}
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

              {/* Motorista */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motorista * <span className="text-red-500">obrigatório</span>
                </label>
                <select
                  value={editData.driverId}
                  onChange={(e) => setEditData({ ...editData, driverId: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um motorista</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </div>

              {/* Origem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Origem * <span className="text-red-500">obrigatório</span>
                </label>
                <input
                  type="text"
                  value={editData.origin}
                  onChange={(e) => setEditData({ ...editData, origin: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Destino */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destino * <span className="text-red-500">obrigatório</span>
                </label>
                <input
                  type="text"
                  value={editData.destination}
                  onChange={(e) => setEditData({ ...editData, destination: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Data de Início */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeLocal(editData.startDate)}
                  onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Data de Término */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Término</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeLocal(editData.endDate)}
                  onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Distância */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Distância (KM)</label>
                <input
                  type="number"
                  value={editData.distance}
                  onChange={(e) => setEditData({ ...editData, distance: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editData.revenue}
                  onChange={(e) => setEditData({ ...editData, revenue: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Observações */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="p-6 border-t flex justify-end gap-3">
            <Button
              onClick={() => {
                setShowEditModal(false);
                setTripToEdit(null);
                setEditData({
                  truckId: '',
                  trailerId: '',
                  driverId: '',
                  clientId: '',
                  tripCode: '',
                  origin: '',
                  destination: '',
                  startDate: '',
                  endDate: '',
                  distance: '',
                  revenue: '',
                  notes: '',
                });
              }}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Adicionar Despesa */}
    {showExpenseModal && tripForExpense && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Adicionar Despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Viagem: <span className="font-medium">{tripForExpense.origin} → {tripForExpense.destination}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Caminhão: <span className="font-medium">{tripForExpense.truck.plate}</span>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Despesa *
                </label>
                <select
                  value={expenseData.type}
                  onChange={(e) => setExpenseData({ ...expenseData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FUEL">Combustível</option>
                  <option value="TOLL">Pedágio</option>
                  <option value="MAINTENANCE">Manutenção</option>
                  <option value="TIRE">Pneus</option>
                  <option value="FOOD">Alimentação</option>
                  <option value="PARKING">Estacionamento</option>
                  <option value="INSURANCE">Seguro</option>
                  <option value="TAX">Impostos</option>
                  {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                    <>
                      <option value="SALARY">Salário</option>
                      <option value="OVERTIME">Hora Extra</option>
                    </>
                  )}
                  <option value="OTHER">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  value={expenseData.amount}
                  onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                  placeholder="Ex: 500.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição *
                </label>
                <textarea
                  value={expenseData.description}
                  onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                  placeholder="Descreva a despesa"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data *
                </label>
                <input
                  type="date"
                  value={expenseData.date}
                  onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowExpenseModal(false);
                  setTripForExpense(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleCreateExpense}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Adicionar Despesa
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Seleção de Carreta ao Iniciar Viagem */}
    {showTrailerModal && (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={() => {
          setShowTrailerModal(false);
          setTripToStart(null);
          setSelectedTrailerId('');
        }}
      >
        <Card
          className="w-full max-w-md"
          onClick={e => e.stopPropagation()} // Impede fechar ao clicar dentro do Card
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-blue-600">Selecione a Carreta</CardTitle>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
              onClick={() => {
                setShowTrailerModal(false);
                setTripToStart(null);
                setSelectedTrailerId('');
              }}
              aria-label="Fechar"
            >
              ×
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carreta disponível *
                </label>
                <select
                  value={selectedTrailerId}
                  onChange={e => setSelectedTrailerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione uma carreta</option>
                  {trailers.map((trailer: any) => (
                    <option key={trailer.id} value={trailer.id}>
                      {trailer.plate} {trailer.brand && trailer.model ? `- ${trailer.brand} ${trailer.model}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button onClick={handleConfirmTrailer}>
                <Play className="w-4 h-4 mr-2" />
                Iniciar Viagem
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Modal de Viagem Retroativa */}
    {showRetroactiveModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <Card className="w-full max-w-4xl my-8" onClick={e => e.stopPropagation()}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-purple-700 flex items-center">
              <Clock className="w-6 h-6 mr-2" />
              Adicionar Viagem Retroativa
            </CardTitle>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-700 text-xl font-bold"
              onClick={() => {
                setShowRetroactiveModal(false);
                setTripCodeExists(false);
                setCheckingTripCode(false);
              }}
            >
              ×
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Caminhão *</label>
                    <select
                      value={retroactiveData.truckId}
                      onChange={e => setRetroactiveData({...retroactiveData, truckId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Selecione o caminhão</option>
                      {trucks.map(truck => (
                        <option key={truck.id} value={truck.id}>
                          {truck.plate} - {truck.brand} {truck.model}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carreta (Opcional)</label>
                    <select
                      value={retroactiveData.trailerId}
                      onChange={e => setRetroactiveData({...retroactiveData, trailerId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Sem carreta</option>
                      {trailers.map(trailer => (
                        <option key={trailer.id} value={trailer.id}>
                          {trailer.plate} {trailer.brand && trailer.model ? `- ${trailer.brand} ${trailer.model}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motorista *</label>
                    <select
                      value={retroactiveData.driverId}
                      onChange={e => setRetroactiveData({...retroactiveData, driverId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Selecione o motorista</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>{driver.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (Opcional)</label>
                    <select
                      value={retroactiveData.clientId}
                      onChange={e => setRetroactiveData({...retroactiveData, clientId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Sem cliente</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código da Viagem (Opcional)
                      {checkingTripCode && <span className="ml-2 text-xs text-gray-500">Verificando...</span>}
                    </label>
                    <input
                      type="text"
                      value={retroactiveData.tripCode}
                      onChange={e => handleTripCodeChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${
                        tripCodeExists ? 'border-red-500 bg-red-50' : 
                        retroactiveData.tripCode && !checkingTripCode && !tripCodeExists ? 'border-green-500 bg-green-50' :
                        'border-gray-300'
                      }`}
                      placeholder="Ex: VIAGEM-2024-001"
                    />
                    {tripCodeExists && (
                      <p className="text-xs text-red-600 mt-1 flex items-center">
                        <XCircle className="w-3 h-3 mr-1" />
                        Este código já está em uso
                      </p>
                    )}
                    {retroactiveData.tripCode && !checkingTripCode && !tripCodeExists && (
                      <p className="text-xs text-green-600 mt-1 flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Código disponível
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Rota */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Rota</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origem *</label>
                    <input
                      type="text"
                      list="origin-locations"
                      value={retroactiveData.origin}
                      onChange={e => setRetroactiveData({...retroactiveData, origin: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Ex: São Paulo - SP"
                      required
                    />
                    <datalist id="origin-locations">
                      {[...new Set(trips.map(t => t.origin).filter(Boolean))].map((origin) => (
                        <option key={origin} value={origin} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destino *</label>
                    <input
                      type="text"
                      list="destination-locations"
                      value={retroactiveData.destination}
                      onChange={e => setRetroactiveData({...retroactiveData, destination: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Ex: Rio de Janeiro - RJ"
                      required
                    />
                    <datalist id="destination-locations">
                      {[...new Set(trips.map(t => t.destination).filter(Boolean))].map((destination) => (
                        <option key={destination} value={destination} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Distância (KM) *</label>
                    <input
                      type="number"
                      step="0.1"
                      value={retroactiveData.distance}
                      onChange={e => setRetroactiveData({...retroactiveData, distance: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="0"
                      required
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      💡 O custo de combustível será calculado automaticamente baseado no consumo médio do caminhão
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Viagem (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={retroactiveData.revenue}
                      onChange={e => setRetroactiveData({...retroactiveData, revenue: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Datas e Horários */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Data e Horário</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início *</label>
                    <input
                      type="date"
                      value={retroactiveData.startDate}
                      onChange={e => setRetroactiveData({...retroactiveData, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      max={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário de Início *</label>
                    <input
                      type="time"
                      value={retroactiveData.startTime}
                      onChange={e => setRetroactiveData({...retroactiveData, startTime: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Término *</label>
                    <input
                      type="date"
                      value={retroactiveData.endDate}
                      onChange={e => setRetroactiveData({...retroactiveData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      max={new Date().toISOString().split('T')[0]}
                      min={retroactiveData.startDate}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário de Término *</label>
                    <input
                      type="time"
                      value={retroactiveData.endTime}
                      onChange={e => setRetroactiveData({...retroactiveData, endTime: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Despesas */}
              <div>
                <div className="flex items-center justify-between mb-2 border-b pb-2">
                  <h3 className="text-lg font-semibold text-gray-700">Despesas (Opcional)</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddExpense}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Despesa
                  </Button>
                </div>
                <p className="text-xs text-gray-600 mb-4 bg-blue-50 p-2 rounded">
                  ℹ️ O custo de combustível já será calculado automaticamente. Adicione aqui apenas despesas extras como pedágio, alimentação, etc.
                </p>
                {retroactiveData.expenses.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Nenhuma despesa adicionada</p>
                ) : (
                  <div className="space-y-3">
                    {retroactiveData.expenses.map((expense, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <select
                              value={expense.type}
                              onChange={e => handleExpenseChange(index, 'type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="TOLL">Pedágio</option>
                              <option value="MAINTENANCE">Manutenção</option>
                              <option value="TIRE">Pneu</option>
                              <option value="FOOD">Alimentação</option>
                              <option value="PARKING">Estacionamento</option>
                              <option value="TAX">Impostos</option>
                              <option value="OVERTIME">Hora Extra</option>
                              <option value="OTHER">Outros</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={expense.amount}
                              onChange={e => handleExpenseChange(index, 'amount', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={expense.description}
                                onChange={e => handleExpenseChange(index, 'description', e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                placeholder="Opcional"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveExpense(index)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRetroactiveModal(false);
                    setTripCodeExists(false);
                    setCheckingTripCode(false);
                    setRetroactiveData({
                      truckId: '',
                      trailerId: '',
                      driverId: '',
                      clientId: '',
                      tripCode: '',
                      origin: '',
                      destination: '',
                      startDate: '',
                      startTime: '',
                      endDate: '',
                      endTime: '',
                      distance: '',
                      revenue: '',
                      expenses: []
                    });
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitRetroactive}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Criar Viagem Retroativa
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    </div>
  );
}
