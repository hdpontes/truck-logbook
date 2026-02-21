import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { tripsAPI, trucksAPI, driversAPI } from '@/lib/api';

interface Truck {
  id: string;
  plate: string;
  model: string;
  brand: string;
}

interface Driver {
  id: string;
  name: string;
  email: string;
}

export default function TripFormPage() {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    truckId: '',
    driverId: '',
    origin: '',
    destination: '',
    startDate: '',
    distance: '',
    revenue: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [trucksData, driversData] = await Promise.all([
        trucksAPI.getAll(),
        driversAPI.getAll(),
      ]);
      setTrucks(trucksData);
      setDrivers(driversData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tripData = {
        truckId: formData.truckId,
        driverId: formData.driverId,
        origin: formData.origin,
        destination: formData.destination,
        startDate: new Date(formData.startDate).toISOString(),
        distance: parseFloat(formData.distance),
        revenue: parseFloat(formData.revenue),
        status: 'IN_PROGRESS',
      };

      await tripsAPI.create(tripData);
      
      alert('Viagem criada com sucesso! Notificação enviada ao motorista.');
      navigate('/trips');
    } catch (error) {
      console.error('Erro ao criar viagem:', error);
      alert('Erro ao criar viagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/trips')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Nova Viagem</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Viagem</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Caminhão *
                </label>
                <select
                  name="truckId"
                  value={formData.truckId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um caminhão</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plate} - {truck.brand} {truck.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motorista *
                </label>
                <select
                  name="driverId"
                  value={formData.driverId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um motorista</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origem *
                </label>
                <input
                  type="text"
                  name="origin"
                  value={formData.origin}
                  onChange={handleChange}
                  required
                  placeholder="Ex: São Paulo - SP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destino *
                </label>
                <input
                  type="text"
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  required
                  placeholder="Ex: Rio de Janeiro - RJ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Início *
                </label>
                <input
                  type="datetime-local"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Distância (km) *
                </label>
                <input
                  type="number"
                  name="distance"
                  value={formData.distance}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.1"
                  placeholder="Ex: 450"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receita Estimada (R$) *
                </label>
                <input
                  type="number"
                  name="revenue"
                  value={formData.revenue}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="Ex: 8000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/trips')}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Criando...' : 'Criar Viagem'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
