import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { expensesAPI } from '@/lib/api';
import { Receipt, Plus, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/contexts/ToastContext';
import { ImportCSVModal } from '@/components/ImportCSVModal';

interface Expense {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  truck: {
    plate: string;
  };
  trip?: {
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
  const [showImportModal, setShowImportModal] = useState(false);

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
      setExpenses(expenses.filter(exp => exp.id !== expenseToDelete));
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

  const handleExportCSV = async () => {
    try {
      const blob = await expensesAPI.exportCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'despesas.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar CSV');
    }
  };

  const handleImportCSV = async (csvData: string) => {
    try {
      const result = await expensesAPI.importCSV(csvData);
      await fetchExpenses();
      return result;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erro ao importar CSV');
    }
  };

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => navigate('/expenses/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Despesa
          </Button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Receipt className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma despesa encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comece adicionando sua primeira despesa.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {expenses.map((expense) => (
            <Card key={expense.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-gray-500" />
                    <span className="text-lg">{expense.type}</span>
                  </div>
                  <span className="text-xl font-bold text-red-600">
                    {formatCurrency(expense.amount)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Caminhão</p>
                    <p className="font-medium">{expense.truck?.plate || 'Despesa Geral'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Data</p>
                    <p className="font-medium">
                      {new Date(expense.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Descrição</p>
                    <p className="font-medium">{expense.description}</p>
                  </div>
                </div>

                {expense.trip && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">Viagem Relacionada</p>
                    <p className="font-medium">{expense.trip.origin} → {expense.trip.destination}</p>
                  </div>
                )}

                <div className="flex justify-end mt-4">
                  {/* Motorista não pode deletar despesa de viagem concluída */}
                  {!(user?.role === 'DRIVER' && expense.trip?.status === 'COMPLETED') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(expense.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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

      {/* Modal de Import CSV */}
      <ImportCSVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        title="Importar Despesas CSV"
      />
    </div>
  );
}
