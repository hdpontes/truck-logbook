import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { maintenanceAPI } from '@/lib/api';
import { Wrench, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface Maintenance {
  id: string;
  type: string;
  description: string;
  cost: number;
  scheduledDate: string;
  completedDate?: string;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  truck: {
    plate: string;
    model: string;
  };
}

export default function MaintenancePage() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'COMPLETED'>('all');

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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta manutenção?')) {
      try {
        await maintenanceAPI.delete(id);
        setMaintenances(maintenances.filter(m => m.id !== id));
      } catch (error) {
        console.error('Erro ao excluir manutenção:', error);
      }
    }
  };

  const filteredMaintenances = filter === 'all'
    ? maintenances
    : maintenances.filter(m => m.status === filter || (filter === 'PENDING' && m.status === 'SCHEDULED'));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    PENDING: 'Pendente',
    SCHEDULED: 'Agendada',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Manutenções</h1>
        <Button onClick={() => alert('Adicionar manutenção - em breve')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Manutenção
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
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
          {filteredMaintenances.map((maintenance) => (
            <Card key={maintenance.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-gray-500" />
                    <span className="text-lg">{maintenance.type}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[maintenance.status]}`}>
                    {statusLabels[maintenance.status]}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Caminhão</p>
                    <p className="font-medium">{maintenance.truck.plate}</p>
                    <p className="text-sm text-gray-500">{maintenance.truck.model}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Data Agendada</p>
                    <p className="font-medium">
                      {new Date(maintenance.scheduledDate).toLocaleDateString('pt-BR')}
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
                    <p className="font-medium text-red-600">{formatCurrency(maintenance.cost)}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">Descrição</p>
                  <p className="font-medium">{maintenance.description}</p>
                </div>

                <div className="flex justify-end mt-4">
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
          ))}
        </div>
      )}
    </div>
  );
}
