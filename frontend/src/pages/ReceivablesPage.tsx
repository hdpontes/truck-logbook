import { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface Client {
  id: string;
  name: string;
  cnpj: string;
  phone?: string;
}

interface Receivable {
  id: string;
  clientId?: string;
  client?: Client;
  type: string;
  description: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  phoneNumber?: string;
  dueDate: string;
  paymentDate?: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  isRecurring: boolean;
  installmentNumber?: number;
  totalInstallments?: number;
  recurringGroupId?: string;
}

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentModal, setPaymentModal] = useState<{ show: boolean; receivable?: Receivable }>({ show: false });
  const [paymentAmount, setPaymentAmount] = useState('');
  const { success, error } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    clientId: '',
    type: '',
    description: '',
    amount: '',
    phoneNumber: '',
    dueDate: '',
    isRecurring: false,
    totalInstallments: '1'
  });

  useEffect(() => {
    fetchReceivables();
    fetchClients();
  }, [filterStatus]);

  const fetchReceivables = async () => {
    try {
      setLoading(true);
      const params = filterStatus ? { status: filterStatus } : {};
      const response = await api.get('/receivables', { params });
      setReceivables(response.data);
    } catch (err) {
      console.error('Erro ao buscar recebimentos:', err);
      error('Erro ao carregar recebimentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type || !formData.description || !formData.amount || !formData.dueDate) {
      error('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.isRecurring && parseInt(formData.totalInstallments) < 2) {
      error('Para recebimentos recorrentes, informe no mínimo 2 parcelas');
      return;
    }

    try {
      await api.post('/receivables', {
        ...formData,
        amount: parseFloat(formData.amount),
        totalInstallments: formData.isRecurring ? parseInt(formData.totalInstallments) : undefined,
        clientId: formData.clientId || undefined
      });

      success(
        formData.isRecurring 
          ? `${formData.totalInstallments} parcelas criadas com sucesso!` 
          : 'Recebimento criado com sucesso!'
      );
      
      setShowForm(false);
      setFormData({
        clientId: '',
        type: '',
        description: '',
        amount: '',
        phoneNumber: '',
        dueDate: '',
        isRecurring: false,
        totalInstallments: '1'
      });
      fetchReceivables();
    } catch (err: any) {
      console.error('Erro ao criar recebimento:', err);
      error(err.response?.data?.message || 'Erro ao criar recebimento');
    }
  };

  const handlePayment = async () => {
    if (!paymentModal.receivable || !paymentAmount) {
      error('Informe o valor recebido');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      error('Valor inválido');
      return;
    }

    try {
      await api.post(`/receivables/${paymentModal.receivable.id}/payment`, {
        paidAmount: amount
      });

      success('Pagamento registrado com sucesso!');
      setPaymentModal({ show: false });
      setPaymentAmount('');
      fetchReceivables();
    } catch (err: any) {
      console.error('Erro ao registrar pagamento:', err);
      error(err.response?.data?.message || 'Erro ao registrar pagamento');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      PARTIALLY_PAID: { label: 'Pago Parcialmente', color: 'bg-orange-100 text-orange-800', icon: DollarSign },
      PAID: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      OVERDUE: { label: 'Atrasado', color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };

    const badge = badges[status as keyof typeof badges] || badges.PENDING;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </span>
    );
  };

  const getCardColor = (status: string) => {
    if (status === 'PARTIALLY_PAID') return 'border-l-4 border-l-orange-400 bg-red-50';
    if (status === 'OVERDUE') return 'border-l-4 border-l-red-500 bg-red-50';
    if (status === 'PAID') return 'border-l-4 border-l-green-500';
    return 'border-l-4 border-l-blue-500';
  };

  const filteredReceivables = receivables.filter(rec => {
    const matchesSearch = 
      rec.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.client?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recebimentos</h1>
          <p className="text-gray-600 mt-1">Gerencie recebimentos avulsos e recorrentes</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Recebimento
        </Button>
      </div>

      {/* Formulário */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Novo Recebimento</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente (Opcional)
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <input
                  type="text"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="Ex: Aluguel, Empréstimo, Serviço"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição detalhada do recebimento"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Vencimento *
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700">
                  Pagamento Recorrente
                </label>
              </div>

              {formData.isRecurring && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Parcelas *
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={formData.totalInstallments}
                    onChange={(e) => setFormData({ ...formData, totalInstallments: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required={formData.isRecurring}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit">
                Criar Recebimento{formData.isRecurring && 's'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Buscar por descrição, tipo ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Todos os Status</option>
            <option value="PENDING">Pendente</option>
            <option value="PARTIALLY_PAID">Pago Parcialmente</option>
            <option value="OVERDUE">Atrasado</option>
            <option value="PAID">Pago</option>
          </select>
        </div>
      </div>

      {/* Lista de Recebimentos */}
      <div className="grid gap-4">
        {filteredReceivables.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            Nenhum recebimento encontrado
          </Card>
        ) : (
          filteredReceivables.map((receivable) => (
            <Card key={receivable.id} className={`p-6 ${getCardColor(receivable.status)}`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {receivable.description}
                    </h3>
                    {getStatusBadge(receivable.status)}
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><strong>Tipo:</strong> {receivable.type}</p>
                    {receivable.client && (
                      <p><strong>Cliente:</strong> {receivable.client.name}</p>
                    )}
                    {receivable.isRecurring && (
                      <p><strong>Parcela:</strong> {receivable.installmentNumber}/{receivable.totalInstallments}</p>
                    )}
                    <p><strong>Vencimento:</strong> {formatDate(receivable.dueDate)}</p>
                    {receivable.paymentDate && (
                      <p><strong>Pago em:</strong> {formatDate(receivable.paymentDate)}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Valor Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(receivable.amount)}
                    </p>
                  </div>
                  
                  {receivable.paidAmount > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-green-600">Pago: {formatCurrency(receivable.paidAmount)}</p>
                      <p className="text-sm text-red-600">Restante: {formatCurrency(receivable.remainingAmount)}</p>
                    </div>
                  )}

                  {receivable.status !== 'PAID' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPaymentModal({ show: true, receivable });
                        setPaymentAmount(receivable.remainingAmount.toString());
                      }}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Concluir Pagamento
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal de Pagamento */}
      {paymentModal.show && paymentModal.receivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Registrar Pagamento</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">{paymentModal.receivable.description}</p>
                <p className="text-lg font-semibold mt-2">
                  Valor Restante: {formatCurrency(paymentModal.receivable.remainingAmount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Recebido *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se o valor for menor que o restante, a parcela ficará como "Paga Parcialmente"
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handlePayment} className="flex-1">
                  Confirmar Pagamento
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentModal({ show: false });
                    setPaymentAmount('');
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
