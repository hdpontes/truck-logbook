import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { trailersAPI } from '@/services/api';

export default function TrailerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    plate: '',
    model: '',
    brand: '',
    year: new Date().getFullYear(),
    capacity: '',
    active: true,
  });

  useEffect(() => {
    if (isEdit && id) {
      fetchTrailer(id);
    }
  }, [id, isEdit]);

  const fetchTrailer = async (trailerId: string) => {
    try {
      setLoading(true);
      const trailer = await trailersAPI.getById(trailerId);
      setFormData({
        plate: trailer.plate,
        model: trailer.model || '',
        brand: trailer.brand || '',
        year: trailer.year || new Date().getFullYear(),
        capacity: trailer.capacity ? trailer.capacity.toString() : '',
        active: trailer.active,
      });
    } catch (error) {
      console.error('Erro ao carregar carreta:', error);
      alert('Erro ao carregar dados da carreta');
      navigate('/trailers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trailerData = {
        plate: formData.plate,
        model: formData.model || null,
        brand: formData.brand || null,
        year: formData.year ? parseInt(formData.year.toString()) : null,
        capacity: formData.capacity ? parseFloat(formData.capacity) : null,
        active: formData.active,
      };

      if (isEdit && id) {
        await trailersAPI.update(id, trailerData);
        alert('Carreta atualizada com sucesso!');
      } else {
        await trailersAPI.create(trailerData);
        alert('Carreta cadastrada com sucesso!');
      }
      
      navigate('/trailers');
    } catch (error) {
      console.error('Erro ao salvar carreta:', error);
      alert('Erro ao salvar carreta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
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
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={() => navigate('/trailers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {isEdit ? 'Editar Carreta' : 'Nova Carreta'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Carreta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Placa */}
              <div>
                <label htmlFor="plate" className="block text-sm font-medium text-gray-700 mb-1">
                  Placa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="plate"
                  name="plate"
                  value={formData.plate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ABC1234"
                  required
                />
              </div>

              {/* Modelo */}
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Baú"
                />
              </div>

              {/* Marca */}
              <div>
                <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
                  Marca
                </label>
                <input
                  type="text"
                  id="brand"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Randon"
                />
              </div>

              {/* Ano */}
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
                  Ano
                </label>
                <input
                  type="number"
                  id="year"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>

              {/* Capacidade */}
              <div>
                <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">
                  Capacidade (toneladas)
                </label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  min="0"
                  placeholder="Ex: 25"
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 text-sm font-medium text-gray-700">
                  Carreta Ativa
                </label>
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/trailers')}
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
