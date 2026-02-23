import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { tripsAPI, trucksAPI, trailersAPI, driversAPI, clientsAPI } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
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

interface Client {
  id: string;
  name: string;
  cnpj: string;
  city: string;
  state: string;
  active?: boolean;
}

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  type: 'ORIGIN' | 'DESTINATION' | 'BOTH';
}

// Função para obter data/hora atual de Brasília no formato datetime-local (YYYY-MM-DDTHH:mm)
const getBrasiliaDateTimeLocal = () => {
  const now = new Date();
  const brasiliaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const year = brasiliaDate.getFullYear();
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  const hours = String(brasiliaDate.getHours()).padStart(2, '0');
  const minutes = String(brasiliaDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function TripFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [origins, setOrigins] = useState<Location[]>([]);
  const [destinations, setDestinations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [minDateTime, setMinDateTime] = useState(getBrasiliaDateTimeLocal());
  const [formData, setFormData] = useState({
    tripCode: '',
    truckId: '',
    trailerId: '',
    driverId: '',
    clientId: '',
    origin: '',
    destination: '',
    startDate: '',
    distance: '',
    revenue: '',
  });

  // Atualizar minDateTime a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setMinDateTime(getBrasiliaDateTimeLocal());
    }, 60000); // Atualiza a cada 1 minuto

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [trucksData, trailersData, driversData, clientsData, locationsData] = await Promise.all([
        trucksAPI.getAll(),
        trailersAPI.getAll(),
        driversAPI.getAll(),
        clientsAPI.getAll(),
        axios.get(`${API_URL}/api/locations`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(res => res.data),
      ]);
      
      setTrucks(trucksData);
      setTrailers(trailersData);
      setDrivers(driversData);
      setClients(clientsData.filter((c: Client) => c.active !== false));
      
      // Filtrar origens (ORIGIN ou BOTH)
      setOrigins(locationsData.filter((loc: Location) => 
        loc.type === 'ORIGIN' || loc.type === 'BOTH'
      ));
      
      // Filtrar destinos (DESTINATION ou BOTH)
      setDestinations(locationsData.filter((loc: Location) => 
        loc.type === 'DESTINATION' || loc.type === 'BOTH'
      ));
      
      // Pré-selecionar caminhão se vier da URL
      const truckIdFromUrl = searchParams.get('truckId');
      if (truckIdFromUrl) {
        setFormData(prev => ({ ...prev, truckId: truckIdFromUrl }));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar data não retroativa
      const selectedDate = new Date(formData.startDate);
      const now = new Date();
      
      // Comparar timestamps diretos
      if (selectedDate.getTime() < now.getTime()) {
        toast.error('Não é permitido cadastrar viagens com data/horário retroativo.');
        setLoading(false);
        return;
      }

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
        status: 'PLANNED',
      };

      await tripsAPI.create(tripData);
      
      toast.success('Viagem criada com sucesso! Notificação enviada ao motorista.');
      navigate('/trips');
    } catch (error: any) {
      console.error('Erro ao criar viagem:', error);
      
      // Tratar erros específicos de conflito
      if (error.response?.status === 400) {
        const message = error.response.data.message;
        if (message.includes('caminhão')) {
          toast.error('Já existe uma viagem agendada para este caminhão nesta data/horário.');
        } else if (message.includes('motorista')) {
          toast.error('Já existe uma viagem agendada para este motorista nesta data/horário.');
        } else {
          toast.error(message || 'Erro ao criar viagem. Verifique os dados e tente novamente.');
        }
      } else {
        toast.error('Erro ao criar viagem. Tente novamente.');
      }
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
                <p className="text-xs text-gray-500 mt-1">
                  Selecione a carreta que será utilizada nesta viagem (opcional)
                </p>
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
                  Cliente
                </label>
                <select
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.city}/{client.state}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione o cliente responsável por esta viagem (opcional)
                </p>
              </div>

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
                <p className="text-xs text-gray-500 mt-1">Código do pedido fornecido pelo cliente</p>
              </div>

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
                    <option key={location.id} value={`${location.name} - ${location.city}/${location.state}`}>
                      {location.name} - {location.city}/{location.state}
                    </option>
                  ))}
                </select>
              </div>

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
                    <option key={location.id} value={`${location.name} - ${location.city}/${location.state}`}>
                      {location.name} - {location.city}/{location.state}
                    </option>
                  ))}
                </select>
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
                  min={minDateTime}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Não é possível agendar viagens retroativas</p>
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
