import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { trucksAPI } from '@/lib/api';
import { Truck, Plus, Edit, Trash2, MapPin, AlertTriangle, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ImportCSVModal } from '@/components/ImportCSVModal';

interface TruckData {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  color: string;
  capacity: number;
  avgConsumption: number;
  currentMileage: number;
  status: 'GARAGE' | 'IN_TRANSIT' | 'MAINTENANCE';
  active: boolean;
  hasOverdueMaintenance?: boolean;
  pendingMaintenancesCount?: number;
  _count?: {
    trips: number;
    expenses: number;
    maintenances: number;
  };
}

const TrucksPage: React.FC = () => {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [truckToDelete, setTruckToDelete] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  // Removed showAddModal as it's not used

  useEffect(() => {
    fetchTrucks();
  }, []);

  const fetchTrucks = async () => {
    try {
      setLoading(true);
      const data = await trucksAPI.getAll();
      setTrucks(data);
    } catch (error) {
      console.error('Erro ao carregar caminhões:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setTruckToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!truckToDelete) return;

    try {
      await trucksAPI.delete(truckToDelete);
      setTrucks(trucks.filter(truck => truck.id !== truckToDelete));
    } catch (error) {
      console.error('Erro ao excluir caminhão:', error);
    } finally {
      setShowDeleteModal(false);
      setTruckToDelete(null);
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await trucksAPI.exportCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'caminhoes.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
    }
  };

  const handleImportCSV = async (csvData: string) => {
    try {
      const result = await trucksAPI.importCSV(csvData);
      await fetchTrucks(); // Recarregar lista
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
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Frota</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => navigate('/trucks/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Caminhão
          </Button>
        </div>
      </div>

      {trucks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Truck className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum caminhão cadastrado</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comece adicionando seu primeiro caminhão à frota.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/trucks/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Caminhão
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trucks.map((truck) => (
            <Card 
              key={truck.id} 
              className="hover:shadow-lg transition-shadow relative overflow-hidden"
            >
              {/* Barra lateral colorida com a cor do caminhão */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-2"
                style={{ backgroundColor: truck.color || '#6B7280' }}
              />
              <CardHeader className="pl-6">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{truck.plate}</span>
                    {/* Badge de cor */}
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: truck.color || '#6B7280' }}
                      title={truck.color}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/trucks/${truck.id}/edit`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(truck.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-lg font-medium">{truck.brand} {truck.model}</p>
                    <p className="text-sm text-gray-500">Year: {truck.year}</p>
                    <p className="text-sm text-gray-600 font-medium">
                      {truck.currentMileage ? truck.currentMileage.toLocaleString('pt-BR') : '0'} km
                    </p>
                  </div>
                  
                  {/* Alerta de Manutenção */}
                  {truck.hasOverdueMaintenance && (
                    <div className="bg-red-100 border border-red-300 rounded-md p-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <span className="text-xs text-red-800 font-semibold">
                        Manutenção Atrasada!
                      </span>
                    </div>
                  )}
                  
                  {!truck.hasOverdueMaintenance && (truck.pendingMaintenancesCount || 0) > 0 && (
                    <div className="bg-yellow-100 border border-yellow-300 rounded-md p-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      <span className="text-xs text-yellow-800 font-semibold">
                        {truck.pendingMaintenancesCount} manutenção(ões) programada(s)
                      </span>
                    </div>
                  )}
                  
                  {truck._count && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="mr-1 h-4 w-4" />
                      {truck._count.trips} viagens | {truck._count.maintenances} manutenções
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        truck.status === 'IN_TRANSIT'
                          ? 'bg-blue-100 text-blue-800'
                          : truck.status === 'MAINTENANCE'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {truck.status === 'IN_TRANSIT' ? 'Em Viagem' : truck.status === 'MAINTENANCE' ? 'Manutenção' : 'Garagem'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {truck.capacity || '-'}t | {truck.avgConsumption || '-'}km/L
                    </span>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/trucks/${truck.id}`)}
                  >
                    Ver Detalhes
                  </Button>
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
              Tem certeza que deseja excluir este caminhão? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setTruckToDelete(null);
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
        title="Importar Caminhões CSV"
      />
    </div>
  );
};

export default TrucksPage;
