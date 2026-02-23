import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { tripsAPI, trucksAPI, trailersAPI, driversAPI } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Truck {
  id: string;
  plate: string;
  model: string;
  brand: string;
}

interface Trailer {
  id: string;
  plate: string;
  model?: string;
  brand?: string;
}

interface Driver {
  id: string;
  name: string;
  email: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  type: 'ORIGIN' | 'DESTINATION' | 'BOTH';
}

export default function TripEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [origins, setOrigins] = useState<Location[]>([]);
  const [destinations, setDestinations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    tripCode: '',
    truckId: '',
    trailerId: '',
    driverId: '',
    origin: '',
    destination: '',
    startDate: '',
    distance: '',
    revenue: '',
    notes: '',
  });

  useEffect(() => {
    // Verificar permissões
    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
      alert('Você não tem permissão para editar viagens.');
      navigate('/trips');
      return;
    }

    if (id) {
      fetchData();
    }
  }, [id, user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [tripData, trucksData, trailersData, driversData, locationsData] = await Promise.all([
        tripsAPI.getById(id!),
        trucksAPI.getAll(),
        trailersAPI.getAll(),
        driversAPI.getAll(),
        axios.get(`${API_URL}/api/locations`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(res => res.data),
      ]);

      // Verificar se pode editar
      if (tripData.status !== 'PLANNED' && tripData.status !== 'DELAYED') {
        alert('Apenas viagens planejadas ou atrasadas podem ser editadas.');
        navigate(`/trips/${id}`);
        return;
      }

      setTrucks(trucksData);
      setTrailers(trailersData);
      setDrivers(driversData);
      setOrigins(locationsData.filter((loc: Location) => 
        loc.type === 'ORIGIN' || loc.type === 'BOTH'
      ));
      setDestinations(locationsData.filter((loc: Location) => 
        loc.type === 'DESTINATION' || loc.type === 'BOTH'
      ));

      // Preencher formulário com dados da viagem
      const startDate = new Date(tripData.startDate);
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const hours = String(startDate.getHours()).padStart(2, '0');
      const minutes = String(startDate.getMinutes()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`;

      setFormData({
        tripCode: tripData.tripCode || '',
        truckId: tripData.truck.id,
        trailerId: tripData.trailer?.id || '',
        driverId: tripData.driver.id,
        origin: tripData.origin,
        destination: tripData.destination,
        startDate: formattedDate,
        distance: tripData.distance?.toString() || '',
        revenue: tripData.revenue?.toString() || '',
        notes: tripData.notes || '',
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados da viagem.');
      navigate('/trips');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const tripData = {
        tripCode: formData.tripCode || null,
        truckId: formData.truckId,
        trailerId: formData.trailerId || null,
        driverId: formData.driverId,
        origin: formData.origin,
        destination: formData.destination,
        startDate: new Date(formData.startDate).toISOString(),
        distance: parseFloat(formData.distance),
        revenue: parseFloat(formData.revenue),
        notes: formData.notes || null,
      };

      await tripsAPI.update(id!, tripData);
      
      alert('Viagem atualizada com sucesso!');
      navigate(`/trips/${id}`);
    } catch (error: any) {
      console.error('Erro ao atualizar viagem:', error);
      
      if (error.response?.status === 400) {
        const message = error.response.data.message;
        alert(message || 'Erro ao atualizar viagem.');
      } else if (error.response?.status === 403) {
        alert('Você não tem permissão para editar esta viagem.');
      } else {
        alert('Erro ao atualizar viagem. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
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
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={() => navigate(`/trips/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Editar Viagem</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Viagem</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Caminhão */}
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

              {/* Carreta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carreta
                </label>
                <select
                  name="trailerId"
                  value={formData.trailerId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Nenhuma carreta</option>
                  {trailers.map((trailer) => (
                    <option key={trailer.id} value={trailer.id}>
                      {trailer.plate} {trailer.brand && trailer.model ? `- ${trailer.brand} ${trailer.model}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Motorista */}
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

              {/* Código da Viagem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código da Viagem
                </label>
                <input
                  type="text"
                  name="tripCode"
                  value={formData.tripCode}
                  onChange={handleChange}
                  placeholder="Ex: PED-12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Origem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origem *
                </label>
                <select
                  name="origin"
                  value={formData.origin}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione a origem</option>
                  {origins.map((location) => (
                    <option key={location.id} value={location.name}>
                      {location.name} - {location.city}/{location.state}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destino */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destino *
                </label>
                <select
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione o destino</option>
                  {destinations.map((location) => (
                    <option key={location.id} value={location.name}>
                      {location.name} - {location.city}/{location.state}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data de Início */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data e Hora de Início *
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

              {/* Distância */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Distância (km)
                </label>
                <input
                  type="number"
                  name="distance"
                  value={formData.distance}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="Ex: 450"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Receita */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receita (R$)
                </label>
                <input
                  type="number"
                  name="revenue"
                  value={formData.revenue}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="Ex: 5000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Anotações sobre a viagem..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Botões */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/trips/${id}`)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
