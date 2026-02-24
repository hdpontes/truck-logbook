import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { maintenanceAPI, trucksAPI } from '@/lib/api';

interface Truck {
  id: string;
  plate: string;
  model: string;
  brand: string;
  currentMileage: number;
}

export default function MaintenanceFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [formData, setFormData] = useState({
    truckId: '',
    type: 'PREVENTIVE',
    description: '',
    cost: '',
    scheduledMileage: '',
    scheduledDate: '',
    status: 'SCHEDULED',
    priority: 'MEDIUM',
    supplier: '',
    notes: '',
  });

  useEffect(() => {
    fetchTrucks();
    if (isEdit && id) {
      fetchMaintenance(id);
    }
  }, [id, isEdit]);

  const fetchTrucks = async () => {
    try {
      const response = await trucksAPI.getAll();
      setTrucks(response);
    } catch (error) {
      console.error('Erro ao carregar caminhões:', error);
      toast.error('Erro ao carregar caminhões');
    }
  };

  const fetchMaintenance = async (maintenanceId: string) => {
    try {
      setLoading(true);
      const maintenance = await maintenanceAPI.getById(maintenanceId);
      
      setFormData({
        truckId: maintenance.truckId,
        type: maintenance.type,
        description: maintenance.description,
        cost: maintenance.cost?.toString() || '',
        scheduledMileage: maintenance.scheduledMileage?.toString() || '',
        scheduledDate: maintenance.scheduledDate ? new Date(maintenance.scheduledDate).toISOString().slice(0, 16) : '',
        status: maintenance.status,
        priority: maintenance.priority,
        supplier: maintenance.supplier || '',
        notes: maintenance.notes || '',
      });

      const truck = trucks.find(t => t.id === maintenance.truckId);
      setSelectedTruck(truck || null);
    } catch (error) {
      console.error('Erro ao carregar manutenção:', error);
      toast.error('Erro ao carregar dados da manutenção');
      navigate('/maintenance');
    } finally {
      setLoading(false);
    }
  };

  const handleTruckChange = (truckId: string) => {
    const truck = trucks.find(t => t.id === truckId);
    setSelectedTruck(truck || null);
    setFormData({ ...formData, truckId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const maintenanceData = {
        truckId: formData.truckId,
        type: formData.type,
        description: formData.description,
        cost: formData.cost ? parseFloat(formData.cost) : 0,
        scheduledMileage: formData.scheduledMileage ? parseFloat(formData.scheduledMileage) : null,
        scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate).toISOString() : null,
        status: formData.status,
        priority: formData.priority,
        supplier: formData.supplier || null,
        notes: formData.notes || null,
      };

      if (isEdit && id) {
        await maintenanceAPI.update(id, maintenanceData);
        toast.success('Manutenção atualizada com sucesso!');
      } else {
        await maintenanceAPI.create(maintenanceData);
        toast.success('Manutenção cadastrada com sucesso!');
      }
      
      navigate('/maintenance');
    } catch (error) {
      console.error('Erro ao salvar manutenção:', error);
      toast.error('Erro ao salvar manutenção. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (loading && isEdit) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/maintenance')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {isEdit ? 'Editar Manutenção' : 'Nova Manutenção'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Manutenção</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Caminhão *</label>
                <select
                  name="truckId"
                  value={formData.truckId}
                  onChange={(e) => handleTruckChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Selecione um caminhão</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plate} - {truck.brand} {truck.model}
                    </option>
                  ))}
                </select>
                {selectedTruck && (
                  <p className="text-sm text-gray-600 mt-1">
                    KM Atual: {selectedTruck.currentMileage?.toLocaleString('pt-BR') || 0} km
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tipo *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="PREVENTIVE">Preventiva</option>
                  <option value="CORRECTIVE">Corretiva</option>
                  <option value="INSPECTION">Inspeção</option>
                  <option value="OIL_CHANGE">Troca de Óleo</option>
                  <option value="TIRE_CHANGE">Troca de Pneus</option>
                  <option value="BRAKE">Freios</option>
                  <option value="ENGINE">Motor</option>
                  <option value="TRANSMISSION">Transmissão</option>
                  <option value="ELECTRICAL">Elétrica</option>
                  <option value="OTHER">Outros</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Descrição *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Descreva a manutenção..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="SCHEDULED">Programada</option>
                  <option value="PENDING">Pendente</option>
                  <option value="IN_PROGRESS">Em Andamento</option>
                  <option value="COMPLETED">Concluída</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Prioridade *</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">KM Programada</label>
                <input
                  type="number"
                  name="scheduledMileage"
                  value={formData.scheduledMileage}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Ex: 50000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe vazio para manutenções corretivas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Data Programada</label>
                <input
                  type="datetime-local"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleChange}
                  onClick={(e) => {
                    try {
                      (e.target as HTMLInputElement).showPicker?.();
                    } catch (error) {
                      // showPicker não suportado em alguns navegadores
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Custo Estimado</label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="R$ 0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Fornecedor/Oficina</label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Nome da oficina"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Observações</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/maintenance')}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : isEdit ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
