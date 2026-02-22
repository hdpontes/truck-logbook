import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { expensesAPI, trucksAPI, tripsAPI } from '@/lib/api';

interface Truck {
  id: string;
  plate: string;
  model: string;
  brand: string;
}

interface Trip {
  id: string;
  origin: string;
  destination: string;
  truck: {
    plate: string;
  };
}

export default function ExpenseFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    truckId: '',
    tripId: '',
    type: '',
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [trucksData, tripsData] = await Promise.all([
        trucksAPI.getAll(),
        tripsAPI.getAll(),
      ]);
      setTrucks(trucksData);
      // Filtrar apenas viagens em progresso ou concluídas recentemente
      setTrips(tripsData.filter((t: Trip) => t.origin)); // Filtra viagens válidas
      
      // Pré-selecionar caminhão se vier da URL
      const truckIdFromUrl = searchParams.get('truckId');
      if (truckIdFromUrl) {
        setFormData(prev => ({ ...prev, truckId: truckIdFromUrl }));
      }
      
      // Pré-selecionar viagem se vier da URL
      const tripIdFromUrl = searchParams.get('tripId');
      if (tripIdFromUrl) {
        const trip = tripsData.find((t: any) => t.id === tripIdFromUrl);
        if (trip) {
          setFormData(prev => ({ 
            ...prev, 
            tripId: tripIdFromUrl,
            truckId: trip.truck?.id || trip.truckId || prev.truckId,
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const expenseData = {
        truckId: formData.truckId,
        tripId: formData.tripId || undefined,
        type: formData.type,
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: new Date(formData.date).toISOString(),
      };

      await expensesAPI.create(expenseData);
      
      alert('Despesa registrada com sucesso!');
      navigate('/expenses');
    } catch (error) {
      console.error('Erro ao criar despesa:', error);
      alert('Erro ao registrar despesa. Tente novamente.');
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

  const expenseTypes = [
    { value: 'FUEL', label: 'Combustível' },
    { value: 'TOLL', label: 'Pedágio' },
    { value: 'MAINTENANCE', label: 'Manutenção' },
    { value: 'FOOD', label: 'Alimentação' },
    { value: 'ACCOMMODATION', label: 'Hospedagem' },
    { value: 'REPAIR', label: 'Reparo' },
    { value: 'TIRE', label: 'Pneu' },
    { value: 'INSURANCE', label: 'Seguro' },
    { value: 'TAX', label: 'Imposto' },
    { value: 'OTHER', label: 'Outros' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/expenses')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Nova Despesa</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Despesa</CardTitle>
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
                  Viagem (Opcional)
                </label>
                <select
                  name="tripId"
                  value={formData.tripId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Despesa não vinculada a viagem</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.origin} → {trip.destination} ({trip.truck.plate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Despesa *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione o tipo</option>
                  {expenseTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="Ex: 350.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data e Hora *
                </label>
                <input
                  type="datetime-local"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={3}
                  placeholder="Descreva a despesa (ex: Abastecimento na BR-116, posto Shell)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/expenses')}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Registrar Despesa'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
