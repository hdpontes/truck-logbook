import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { trucksAPI } from '@/lib/api';
import { Truck, Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface TruckData {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  color: string;
  capacity: number;
  avgConsumption: number;
  status: 'GARAGE' | 'IN_TRANSIT' | 'MAINTENANCE';
  active: boolean;
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
    if (window.confirm('Tem certeza que deseja excluir este caminhão?')) {
      try {
        await trucksAPI.delete(id);
        setTrucks(trucks.filter(truck => truck.id !== id));
      } catch (error) {
        console.error('Erro ao excluir caminhão:', error);
      }
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
        <Button onClick={() => navigate('/trucks/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Caminhão
        </Button>
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
            <Card key={truck.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{truck.plate}</span>
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
                    <p className="text-sm text-gray-500">Year: {truck.year} | {truck.color}</p>
                  </div>
                  
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
                      {truck.capacity}t | {truck.avgConsumption}km/L
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
    </div>
  );
};

export default TrucksPage;
