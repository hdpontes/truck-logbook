import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { maintenanceAPI, expensesAPI } from '@/lib/api';
import { Wrench, Plus, Trash2, Edit, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

interface Maintenance {
  id: string;
  type: string;
  description: string;
  cost: number;
  scheduledDate: string;
  scheduledMileage?: number;
  completedDate?: string;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  truck: {
    id: string;
    plate: string;
    model: string;
    currentMileage: number;
  };
}

export default function MaintenancePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'COMPLETED' | 'OVERDUE'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [maintenanceToComplete, setMaintenanceToComplete] = useState<Maintenance | null>(null);
  const [completionData, setCompletionData] = useState({
    completedDate: new Date().toISOString().split('T')[0],
    actualCost: '',
  });

  useEffect(() => {
    fetchMaintenances();
  }, []);

  const fetchMaintenances = async () => {
    try {
      setLoading(true);
      const data = await maintenanceAPI.getAll();
      setMaintenances(data);
    } catch (error) {
      console.error('Erro ao carregar manutenções:', error);
      toast.error('Erro ao carregar manutenções');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setMaintenanceToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!maintenanceToDelete) return;

    try {
      await maintenanceAPI.delete(maintenanceToDelete);
      setMaintenances(maintenances.filter(m => m.id !== maintenanceToDelete));
      toast.success('Manutenção excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir manutenção:', error);
      toast.error('Erro ao excluir manutenção');
    } finally {
      setShowDeleteModal(false);
      setMaintenanceToDelete(null);
    }
  };

  const handleComplete = (maintenance: Maintenance) => {
    setMaintenanceToComplete(maintenance);
    setCompletionData({
      completedDate: new Date().toISOString().split('T')[0],
      actualCost: maintenance.cost.toString(),
    });
    setShowCompleteModal(true);
  };

  const confirmComplete = async () => {
    if (!maintenanceToComplete) return;

    try {
      const actualCost = parseFloat(completionData.actualCost);
      
      if (isNaN(actualCost) || actualCost < 0) {
        toast.error('Valor inválido');
        return;
      }

      // Atualizar manutenção para COMPLETED
      await maintenanceAPI.update(maintenanceToComplete.id, {
        status: 'COMPLETED',
        completedDate: completionData.completedDate,
        cost: actualCost,
      });

      // Criar despesa vinculada ao caminhão
      await expensesAPI.create({
        truckId: maintenanceToComplete.truck.id,
        category: 'MAINTENANCE',
        description: `Manutenção: ${typeLabels[maintenanceToComplete.type] || maintenanceToComplete.type} - ${maintenanceToComplete.description}`,
        amount: actualCost,
        date: completionData.completedDate,
      });

      // Atualizar lista
      await fetchMaintenances();
      
      toast.success('Manutenção concluída e despesa registrada!');
      setShowCompleteModal(false);
      setMaintenanceToComplete(null);
    } catch (error) {
      console.error('Erro ao concluir manutenção:', error);
      toast.error('Erro ao concluir manutenção');
    }
  };

  const isOverdue = (maintenance: Maintenance) => {
    if (maintenance.status === 'COMPLETED' || maintenance.status === 'CANCELLED') {
      return false;
    }
    if (maintenance.scheduledMileage && maintenance.truck.currentMileage >= maintenance.scheduledMileage) {
      return true;
    }
    return false;
  };

  const filteredMaintenances = (() => {
    if (filter === 'all') return maintenances;
    if (filter === 'PENDING') return maintenances.filter(m => m.status === 'PENDING' || m.status === 'SCHEDULED');
    if (filter === 'COMPLETED') return maintenances.filter(m => m.status === 'COMPLETED');
    if (filter === 'OVERDUE') return maintenances.filter(m => isOverdue(m));
    return maintenances;
  })();

  const overdueCount = maintenances.filter(m => isOverdue(m)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const statusColors = {
    PENDING: 'bg-red-100 text-red-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  const statusLabels = {
    PENDING: 'Pendente',
    SCHEDULED: 'Agendada',
    IN_PROGRESS: 'Em Andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  };

  const priorityColors = {
    LOW: 'bg-gray-100 text-gray-800',
    MEDIUM: 'bg-blue-100 text-blue-800',
    HIGH: 'bg-orange-100 text-orange-800',
    URGENT: 'bg-red-100 text-red-800',
  };

  const priorityLabels = {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  };

  const typeLabels: Record<string, string> = {
    PREVENTIVE: 'Preventiva',
    CORRECTIVE: 'Corretiva',
    INSPECTION: 'Inspeção',
    OIL_CHANGE: 'Troca de Óleo',
    TIRE_CHANGE: 'Troca de Pneus',
    BRAKE: 'Freios',
    ENGINE: 'Motor',
    TRANSMISSION: 'Transmissão',
    ELECTRICAL: 'Elétrica',
    OTHER: 'Outros',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Manutenções</h1>
        <Button onClick={() => navigate('/maintenance/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Manutenção
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          Todas ({maintenances.length})
        </Button>
        <Button
          variant={filter === 'PENDING' ? 'default' : 'outline'}
          onClick={() => setFilter('PENDING')}
        >
          Pendentes ({maintenances.filter(m => m.status === 'PENDING' || m.status === 'SCHEDULED').length})
        </Button>
        <Button
          variant={filter === 'OVERDUE' ? 'default' : 'outline'}
          onClick={() => setFilter('OVERDUE')}
          className={overdueCount > 0 ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100' : ''}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Atrasadas ({overdueCount})
        </Button>
        <Button
          variant={filter === 'COMPLETED' ? 'default' : 'outline'}
          onClick={() => setFilter('COMPLETED')}
        >
          Concluídas ({maintenances.filter(m => m.status === 'COMPLETED').length})
        </Button>
      </div>

      {filteredMaintenances.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Wrench className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma manutenção encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comece adicionando sua primeira manutenção.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMaintenances.map((maintenance) => {
            const overdue = isOverdue(maintenance);
            const cardClassName = overdue 
              ? 'hover:shadow-lg transition-shadow border-2 border-red-300 bg-red-50' 
              : 'hover:shadow-lg transition-shadow';

            return (
              <Card key={maintenance.id} className={cardClassName}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Wrench className="h-5 w-5 text-gray-500" />
                      <span className="text-lg">{typeLabels[maintenance.type] || maintenance.type}</span>
                      {overdue && (
                        <span className="flex items-center gap-1 text-red-600 text-sm font-semibold">
                          <AlertTriangle className="h-4 w-4" />
                          ATRASADA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[maintenance.priority]}`}>
                        {priorityLabels[maintenance.priority]}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[maintenance.status]}`}>
                        {statusLabels[maintenance.status]}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Caminhão</p>
                      <p className="font-medium">{maintenance.truck.plate}</p>
                      <p className="text-sm text-gray-500">{maintenance.truck.model}</p>
                    </div>
                    {maintenance.scheduledMileage && (
                      <div>
                        <p className="text-sm text-gray-600">Quilometragem</p>
                        <p className={`font-medium ${overdue ? 'text-red-600' : ''}`}>
                          Programada: {maintenance.scheduledMileage.toLocaleString('pt-BR')} km
                        </p>
                        <p className="text-sm text-gray-500">
                          Atual: {maintenance.truck.currentMileage.toLocaleString('pt-BR')} km
                        </p>
                        {overdue && (
                          <p className="text-xs text-red-600 font-semibold mt-1">
                            Ultrapassou em {(maintenance.truck.currentMileage - maintenance.scheduledMileage).toLocaleString('pt-BR')} km
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Data Agendada</p>
                      <p className="font-medium">
                        {maintenance.scheduledDate 
                          ? new Date(maintenance.scheduledDate).toLocaleDateString('pt-BR')
                          : 'Não definida'}
                      </p>
                    </div>
                    {maintenance.completedDate && (
                      <div>
                        <p className="text-sm text-gray-600">Data Concluída</p>
                        <p className="font-medium">
                          {new Date(maintenance.completedDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Custo</p>
                      <p className="font-medium text-red-600">
                        {maintenance.cost ? formatCurrency(maintenance.cost) : 'Não informado'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">Descrição</p>
                    <p className="font-medium">{maintenance.description}</p>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    {maintenance.status !== 'COMPLETED' && maintenance.status !== 'CANCELLED' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleComplete(maintenance)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Concluir
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/maintenance/edit/${maintenance.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(maintenance.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
              Tem certeza que deseja excluir esta manutenção? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setMaintenanceToDelete(null);
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

    {/* Modal de Conclusão de Manutenção */}
    {showCompleteModal && maintenanceToComplete && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-green-600">Concluir Manutenção</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Caminhão</p>
                <p className="font-semibold">{maintenanceToComplete.truck.plate} - {maintenanceToComplete.truck.model}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Manutenção</p>
                <p className="font-semibold">{typeLabels[maintenanceToComplete.type] || maintenanceToComplete.type}</p>
                <p className="text-sm text-gray-500">{maintenanceToComplete.description}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Conclusão *
                </label>
                <input
                  type="date"
                  value={completionData.completedDate}
                  onChange={(e) => setCompletionData({ ...completionData, completedDate: e.target.value })}
                  onClick={(e) => {
                    try {
                      (e.target as HTMLInputElement).showPicker?.();
                    } catch (error) {
                      // showPicker não suportado em alguns navegadores
                    }
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Realizado (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={completionData.actualCost}
                  onChange={(e) => setCompletionData({ ...completionData, actualCost: e.target.value })}
                  required
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Atenção:</strong> Ao concluir, uma despesa de manutenção será automaticamente registrada para este caminhão.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCompleteModal(false);
                  setMaintenanceToComplete(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmComplete}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Concluir Manutenção
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    </div>
  );
}
