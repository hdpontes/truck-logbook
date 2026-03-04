import { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, AlertCircle, CheckCircle, Clock, Edit, Trash2, Download, FileText, Filter, MessageCircle } from 'lucide-react';
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

interface ReceivablePayment {
  id: string;
  receivableId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  receiptPath?: string;
  receiptFileName?: string;
  notes?: string;
}

interface Receivable {
  id: string;
  clientId?: string;
  client?: Client;
  type: string;
  description: string | null;
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
  payments?: ReceivablePayment[];
}

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [paymentModal, setPaymentModal] = useState<{ show: boolean; receivable?: Receivable }>({ show: false });
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; receivable?: Receivable }>({ show: false });
  const [receiptsModal, setReceiptsModal] = useState<{ show: boolean; receivable?: Receivable }>({ show: false });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
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
  }, []);

  const fetchReceivables = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterClient) params.clientId = filterClient;
      if (startDateFilter) params.startDate = startDateFilter;
      if (endDateFilter) params.endDate = endDateFilter;
      
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
    
    if (!formData.type || !formData.amount || !formData.dueDate) {
      error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!editingId && formData.isRecurring && parseInt(formData.totalInstallments) < 2) {
      error('Para recebimentos recorrentes, informe no mínimo 2 parcelas');
      return;
    }

    try {
      if (editingId) {
        // Modo edição - apenas atualiza o recebimento
        await api.put(`/receivables/${editingId}`, {
          type: formData.type,
          description: formData.description,
          amount: parseFloat(formData.amount),
          phoneNumber: formData.phoneNumber,
          dueDate: formData.dueDate,
          clientId: formData.clientId || undefined
        });

        success('Recebimento atualizado com sucesso!');
        setEditingId(null);
      } else {
        // Modo criação - pode ser recorrente
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
      }
      
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
      console.error('Erro ao salvar recebimento:', err);
      error(err.response?.data?.message || 'Erro ao salvar recebimento');
    }
  };

  const handlePayment = async () => {
    if (!paymentModal.receivable || !paymentAmount) {
      error('Informe o valor recebido');
      return;
    }

    if (!paymentMethod) {
      error('Selecione a forma de pagamento');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      error('Valor inválido');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('paidAmount', amount.toString());
      formData.append('paymentMethod', paymentMethod);
      if (paymentNotes) {
        formData.append('notes', paymentNotes);
      }
      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      await api.post(`/receivables/${paymentModal.receivable.id}/payment`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      success('Pagamento registrado com sucesso!');
      setPaymentModal({ show: false });
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentNotes('');
      setReceiptFile(null);
      fetchReceivables();
    } catch (err: any) {
      console.error('Erro ao registrar pagamento:', err);
      error(err.response?.data?.message || 'Erro ao processar pagamento');
    }
  };

  const handleEdit = (receivable: Receivable) => {
    if (receivable.status === 'PAID') {
      error('Não é possível editar um recebimento já pago');
      return;
    }
    
    setEditingId(receivable.id);
    setFormData({
      clientId: receivable.clientId || '',
      type: receivable.type,
      description: receivable.description || '',
      amount: receivable.amount.toString(),
      phoneNumber: receivable.phoneNumber || '',
      dueDate: receivable.dueDate.split('T')[0],
      isRecurring: false,
      totalInstallments: '1'
    });
    setShowForm(true);
  };

  const handleDeleteClick = (receivable: Receivable) => {
    setDeleteModal({ show: true, receivable });
  };

  const confirmDelete = async (deleteAll: boolean) => {
    if (!deleteModal.receivable) return;

    try {
      if (deleteAll && deleteModal.receivable.recurringGroupId) {
        // Excluir todas as parcelas do grupo
        await api.delete(`/receivables/group/${deleteModal.receivable.recurringGroupId}`);
        success('Todas as parcelas foram excluídas com sucesso!');
      } else {
        // Excluir apenas esta parcela
        await api.delete(`/receivables/${deleteModal.receivable.id}`);
        success('Recebimento excluído com sucesso!');
      }

      setDeleteModal({ show: false });
      fetchReceivables();
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      error(err.response?.data?.message || 'Erro ao excluir recebimento');
    }
  };

  const handleDownloadReceipt = async (paymentId: string, fileName?: string) => {
    try {
      const response = await api.get(`/receivables/payments/${paymentId}/receipt`, {
        responseType: 'blob',
      });

      // Criar URL temporária para download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'comprovante');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      success('Comprovante baixado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao baixar comprovante:', err);
      error('Erro ao baixar comprovante');
    }
  };

  const handleSendWhatsAppNotification = async (receivable: Receivable) => {
    if (!receivable.phoneNumber && !receivable.client?.phone) {
      error('Nenhum número de telefone configurado para este recebimento');
      return;
    }

    try {
      await api.post(`/receivables/${receivable.id}/send-notification`);
      success('Cobrança enviada via WhatsApp com sucesso!');
      fetchReceivables(); // Atualizar lista
    } catch (err: any) {
      console.error('Erro ao enviar notificação:', err);
      error(err.response?.data?.message || 'Erro ao enviar cobrança via WhatsApp');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
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
      (rec.description && rec.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recebimentos</h1>
          <p className="text-gray-600 mt-1">Gerencie recebimentos avulsos e recorrentes</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full md:w-auto"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Novo Recebimento
          </Button>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Editar Recebimento' : 'Novo Recebimento'}
          </h2>
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
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Selecione o tipo</option>
                  <option value="Aluguel">Aluguel</option>
                  <option value="Empréstimo">Empréstimo</option>
                  <option value="Prestação de Serviços">Prestação de Serviços</option>
                  <option value="Venda a Prazo">Venda a Prazo</option>
                  <option value="Mensalidade">Mensalidade</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição detalhada do recebimento (opcional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
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
                  disabled={!!editingId}
                />
                <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700">
                  Pagamento Recorrente {editingId && '(não editável)'}
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
                {editingId ? 'Salvar Alterações' : `Criar Recebimento${formData.isRecurring ? 's' : ''}`}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filtros */}
      {showFilters && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por descrição, tipo ou cliente..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Todos</option>
                  <option value="PENDING">Pendente</option>
                  <option value="PARTIALLY_PAID">Pago Parcialmente</option>
                  <option value="PAID">Pago</option>
                  <option value="OVERDUE">Atrasado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Todos</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={fetchReceivables}>
                <Search className="mr-2 h-4 w-4" />
                Aplicar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterStatus('');
                  setFilterClient('');
                  setSearchTerm('');
                  setStartDateFilter('');
                  setEndDateFilter('');
                  fetchReceivables();
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Lista de Recebimentos */}
      {filteredReceivables.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Nenhum recebimento encontrado</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredReceivables.map((receivable) => (
            <Card key={receivable.id} className={`p-4 ${getCardColor(receivable.status)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(receivable.status)}
                    {receivable.isRecurring && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Parcela {receivable.installmentNumber}/{receivable.totalInstallments}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-lg">{receivable.type}</h3>
                  {receivable.description && (
                    <p className="text-gray-600 text-sm mb-2">{receivable.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {receivable.client && (
                      <div>
                        <span className="text-gray-500">Cliente:</span>
                        <p className="font-medium">{receivable.client.name}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-500">Valor Total:</span>
                      <p className="font-medium">{formatCurrency(receivable.amount)}</p>
                    </div>

                    <div>
                      <span className="text-gray-500">Valor Pago:</span>
                      <p className="font-medium text-green-600">{formatCurrency(receivable.paidAmount)}</p>
                    </div>

                    <div>
                      <span className="text-gray-500">Restante:</span>
                      <p className="font-medium text-red-600">{formatCurrency(receivable.remainingAmount)}</p>
                    </div>

                    <div>
                      <span className="text-gray-500">Vencimento:</span>
                      <p className="font-medium">{formatDate(receivable.dueDate)}</p>
                    </div>

                    {receivable.paymentDate && (
                      <div>
                        <span className="text-gray-500">Data Pagamento:</span>
                        <p className="font-medium">{formatDate(receivable.paymentDate)}</p>
                      </div>
                    )}

                    {receivable.phoneNumber && (
                      <div>
                        <span className="text-gray-500">Telefone:</span>
                        <p className="font-medium">{receivable.phoneNumber}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
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

                  {receivable.status !== 'PAID' && (receivable.phoneNumber || receivable.client?.phone) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendWhatsAppNotification(receivable)}
                      className="text-green-600 hover:bg-green-50 hover:text-green-700 border-green-300"
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Enviar Cobrança
                    </Button>
                  )}

                  {receivable.status !== 'PAID' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(receivable)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteClick(receivable)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>

                  {receivable.payments && receivable.payments.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReceiptsModal({ show: true, receivable })}
                      className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 border-blue-300"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Ver Comprovantes ({receivable.payments.length})
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Pagamento */}
      {paymentModal.show && paymentModal.receivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Registrar Pagamento</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">Recebimento:</p>
              <p className="font-medium">{paymentModal.receivable.description || paymentModal.receivable.type}</p>
              <p className="text-sm text-gray-600 mt-2">Valor Restante:</p>
              <p className="font-semibold text-lg">{formatCurrency(paymentModal.receivable.remainingAmount)}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor Recebido *
              </label>
              <input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Informe o valor total para pagamento completo ou um valor menor para pagamento parcial
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forma de Pagamento *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Selecione a forma de pagamento</option>
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Boleto">Boleto</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Transferência">Transferência Bancária</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comprovante (Opcional)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formatos aceitos: JPEG, PNG, PDF (máx. 10MB)
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações (Opcional)
              </label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Observações sobre o pagamento..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handlePayment} className="flex-1">
                Confirmar Pagamento
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPaymentModal({ show: false });
                  setPaymentAmount('');
                  setPaymentMethod('');
                  setPaymentNotes('');
                  setReceiptFile(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteModal.show && deleteModal.receivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Confirmar Exclusão</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="font-medium">{deleteModal.receivable.description || deleteModal.receivable.type}</p>
              <p className="text-sm text-gray-600 mt-1">
                Valor: {formatCurrency(deleteModal.receivable.amount)}
              </p>
              {deleteModal.receivable.isRecurring && (
                <p className="text-sm text-blue-600 mt-1">
                  Parcela {deleteModal.receivable.installmentNumber}/{deleteModal.receivable.totalInstallments} de um recebimento recorrente
                </p>
              )}
            </div>

            {deleteModal.receivable.recurringGroupId ? (
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-700 mb-3">
                  Este é um recebimento recorrente. O que deseja excluir?
                </p>
                <Button 
                  onClick={() => confirmDelete(false)}
                  variant="outline"
                  className="w-full text-red-600 border-red-300 hover:bg-red-50"
                >
                  Excluir apenas esta parcela
                </Button>
                <Button 
                  onClick={() => confirmDelete(true)}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  Excluir todas as parcelas do grupo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteModal({ show: false })}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button 
                  onClick={() => confirmDelete(false)}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Confirmar Exclusão
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteModal({ show: false })}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal de Comprovantes */}
      {receiptsModal.show && receiptsModal.receivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Histórico de Pagamentos</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="font-medium">{receiptsModal.receivable.description || receiptsModal.receivable.type}</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>
                  <span className="text-gray-600">Valor Total:</span>
                  <span className="font-medium ml-2">{formatCurrency(receiptsModal.receivable.amount)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Valor Pago:</span>
                  <span className="font-medium text-green-600 ml-2">{formatCurrency(receiptsModal.receivable.paidAmount)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Valor Restante:</span>
                  <span className="font-medium text-red-600 ml-2">{formatCurrency(receiptsModal.receivable.remainingAmount)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className="ml-2">{getStatusBadge(receiptsModal.receivable.status)}</span>
                </div>
              </div>
            </div>

            {receiptsModal.receivable.payments && receiptsModal.receivable.payments.length > 0 ? (
              <div className="space-y-3">
                {receiptsModal.receivable.payments.map((payment) => (
                  <Card key={payment.id} className="p-4 border-l-4 border-l-blue-500">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Pagamento Recebido</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Valor:</span>
                            <p className="font-semibold text-green-600">{formatCurrency(payment.amount)}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Forma de Pagamento:</span>
                            <p className="font-medium">{payment.paymentMethod}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Data:</span>
                            <p className="font-medium">{formatDate(payment.paymentDate)}</p>
                          </div>
                          {payment.receiptFileName && (
                            <div>
                              <span className="text-gray-600">Comprovante:</span>
                              <p className="font-medium text-blue-600">{payment.receiptFileName}</p>
                            </div>
                          )}
                        </div>

                        {payment.notes && (
                          <div className="mt-2 text-sm">
                            <span className="text-gray-600">Observações:</span>
                            <p className="text-gray-700 italic">{payment.notes}</p>
                          </div>
                        )}
                      </div>

                      {payment.receiptPath && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadReceipt(payment.id, payment.receiptFileName)}
                          className="ml-4 text-blue-600 hover:bg-blue-50 border-blue-300"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Nenhum pagamento registrado ainda</p>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setReceiptsModal({ show: false })}
              >
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
