import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle,
  Clock,
  Truck,
  DollarSign
} from 'lucide-react';
import { recurringExpensesAPI, trucksAPI } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

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
  supplier?: string;
  notes?: string;
  truck?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  };
}

interface Truck {
  id: string;
  plate: string;
  model: string;
  brand: string;
}

export default function RecurringExpensesTab() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingExpenseId, setPayingExpenseId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    type: 'FINANCING',
    description: '',
    amount: '',
    dueDay: '',
    startDate: '',
    totalInstallments: '',
    truckId: '',
    supplier: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expensesData, trucksData] = await Promise.all([
        recurringExpensesAPI.getAll(),
        trucksAPI.getAll(),
      ]);
      setExpenses(expensesData);
      setTrucks(trucksData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar despesas recorrentes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        type: formData.type,
        description: formData.description,
        amount: parseFloat(formData.amount),
        dueDay: parseInt(formData.dueDay),
        startDate: new Date(formData.startDate).toISOString(),
        totalInstallments: parseInt(formData.totalInstallments),
        truckId: formData.truckId || null,
        supplier: formData.supplier || null,
        notes: formData.notes || null,
      };

      if (editingId) {
        await recurringExpensesAPI.update(editingId, data);
        toast.success('Despesa recorrente atualizada!');
      } else {
        await recurringExpensesAPI.create(data);
        toast.success('Despesa recorrente criada!');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving recurring expense:', error);
      toast.error(error.response?.data?.message || 'Erro ao salvar despesa recorrente');
    }
  };

  const handleEdit = (expense: RecurringExpense) => {
    setEditingId(expense.id);
    setFormData({
      type: expense.type,
      description: expense.description,
      amount: expense.amount.toString(),
      dueDay: expense.dueDay.toString(),
      startDate: new Date(expense.startDate).toISOString().split('T')[0],
      totalInstallments: expense.totalInstallments?.toString() || '',
      truckId: expense.truckId || '',
      supplier: expense.supplier || '',
      notes: expense.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa recorrente?')) return;
    
    try {
      await recurringExpensesAPI.delete(id);
      toast.success('Despesa recorrente excluída!');
      fetchData();
    } catch (error) {
      console.error('Error deleting recurring expense:', error);
      toast.error('Erro ao excluir despesa recorrente');
    }
  };

  const handlePay = async (id: string) => {
    setPayingExpenseId(id);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    if (!payingExpenseId || !paymentDate) return;
    
    try {
      await recurringExpensesAPI.pay(payingExpenseId, {
        paymentDate: new Date(paymentDate).toISOString(),
      });
      toast.success('Despesa marcada como paga!');
      setShowPaymentModal(false);
      setPayingExpenseId(null);
      fetchData();
    } catch (error) {
      console.error('Error paying recurring expense:', error);
      toast.error('Erro ao pagar despesa recorrente');
    }
  };

  const handleToggleStatus = async (expense: RecurringExpense) => {
    // Removido - não pausar mais despesas recorrentes
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      type: 'FINANCING',
      description: '',
      amount: '',
      dueDay: '',
      startDate: '',
      totalInstallments: '',
      truckId: '',
      supplier: '',
      notes: '',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    const labels = {
      ACTIVE: 'Ativa',
      PAUSED: 'Pausada',
      COMPLETED: 'Concluída',
      CANCELLED: 'Cancelada',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const expenseTypes = [
    { value: 'FINANCING', label: 'Financiamento' },
    { value: 'INSURANCE', label: 'Seguro' },
    { value: 'MAINTENANCE', label: 'Manutenção' },
    { value: 'TAX', label: 'Impostos' },
    { value: 'SALARY', label: 'Salário' },
    { value: 'OTHER', label: 'Outros' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Despesas Recorrentes</h2>
          <p className="text-sm text-gray-600">Gerencie despesas fixas mensais</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Despesa Recorrente
        </Button>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhuma despesa recorrente</h3>
            <p className="mt-2 text-sm text-gray-500">
              Crie despesas fixas mensais como financiamentos, aluguéis e contratos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {expenses.map((expense) => (
            <Card key={expense.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{expense.description}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Vence dia {expense.dueDay} de cada mês
                    </p>
                  </div>
                  {getStatusBadge(expense.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className="text-lg font-bold text-red-600">{formatCurrency(expense.amount)}</span>
                </div>

                {expense.truck && (
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4 text-gray-500" />
                    <span>{expense.truck.plate} - {expense.truck.brand} {expense.truck.model}</span>
                  </div>
                )}

                {expense.totalInstallments && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Parcelas:</span>
                    <span className="font-medium">
                      {(expense.paidInstallments + 1)}/{expense.totalInstallments}
                    </span>
                  </div>
                )}

                {expense.supplier && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <span>{expense.supplier}</span>
                  </div>
                )}

                <div className="pt-3 border-t flex gap-2">
                  {expense.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePay(expense.id)}
                      className="flex-1 text-green-600 hover:text-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Pagar
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(expense)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(expense.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirmar Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Data do Pagamento *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowPaymentModal(false); setPayingExpenseId(null); }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmPayment}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Confirmar Pagamento
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingId ? 'Editar' : 'Nova'} Despesa Recorrente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      {expenseTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Caminhão</label>
                    <select
                      value={formData.truckId}
                      onChange={(e) => setFormData({ ...formData, truckId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Nenhum (despesa geral)</option>
                      {trucks.map(truck => (
                        <option key={truck.id} value={truck.id}>
                          {truck.plate} - {truck.brand} {truck.model}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Descrição *</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      placeholder="Ex: Financiamento Scania 2024"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Valor (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      placeholder="5000.00"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Dia de Vencimento (1-31) *</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dueDay}
                      onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
                      required
                      placeholder="10"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Data de Início *</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Total de Parcelas *</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.totalInstallments}
                      onChange={(e) => setFormData({ ...formData, totalInstallments: e.target.value })}
                      required
                      placeholder="Ex: 60"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Fornecedor</label>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      placeholder="Ex: Banco Itaú"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Observações</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      placeholder="Informações adicionais..."
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowModal(false); resetForm(); }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingId ? 'Atualizar' : 'Criar'} Despesa
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
