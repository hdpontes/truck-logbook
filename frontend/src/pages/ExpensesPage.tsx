import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { expensesAPI } from '@/lib/api';
import { Calendar, Route, Truck as TruckIcon, FileText, Repeat, Trash2, Edit, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/contexts/ToastContext';
import RecurringExpensesTab from '@/components/RecurringExpensesTab';

interface Expense {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  isPaid?: boolean;
  truckId?: string;
  tripId?: string;
  truck?: {
    id: string;
    plate: string;
    model: string;
  };
  trip?: {
    id: string;
    origin: string;
    destination: string;
    status: string;
  };
}

export default function ExpensesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await expensesAPI.getAll();
      setExpenses(data);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
      toast.error('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
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
              {!(user?.role === 'DRIVER' && expense.trip?.status === 'COMPLETED') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(expense.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
      </div>

      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="calendar" className="flex flex-col sm:flex-row items-center gap-2 py-3">
            <Calendar className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Calendário</span>
          </TabsTrigger>
          <TabsTrigger value="trips" className="flex flex-col sm:flex-row items-center gap-2 py-3">
            <Route className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Viagens</span>
          </TabsTrigger>
          <TabsTrigger value="trucks" className="flex flex-col sm:flex-row items-center gap-2 py-3">
            <TruckIcon className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Caminhões</span>
          </TabsTrigger>
          <TabsTrigger value="other" className="flex flex-col sm:flex-row items-center gap-2 py-3">
            <FileText className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Outras</span>
          </TabsTrigger>
          <TabsTrigger value="recurring" className="flex flex-col sm:flex-row items-center gap-2 py-3">
            <Repeat className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Recorrentes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            <p>Visualize suas despesas em formato de calendário. Clique em um dia para ver detalhes.</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800">
              O calendário será carregado abaixo. Navegue para <button
                onClick={() => navigate('/expenses-calendar')}
                className="text-blue-600 hover:text-blue-800 underline font-medium"
              >
                /expenses-calendar
              </button> para visualização completa.
            </p>
          </div>
        </TabsContent>

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
                <TruckIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
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

        <TabsContent value="recurring" className="space-y-4">
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
