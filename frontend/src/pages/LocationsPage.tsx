import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  type: 'ORIGIN' | 'DESTINATION' | 'BOTH';
  createdAt: string;
}

export default function LocationsPage() {
  const toast = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: '',
    zipCode: '',
    type: 'BOTH' as 'ORIGIN' | 'DESTINATION' | 'BOTH',
  });
  const [loadingCep, setLoadingCep] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLocations(response.data);
    } catch (error) {
      console.error('Erro ao carregar localizações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCepBlur = async () => {
    const cleanCep = formData.zipCode.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return;
    }

    setLoadingCep(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/external/cep/${cleanCep}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data;
      
      // Preencher automaticamente cidade e estado
      setFormData(prev => ({
        ...prev,
        city: data.city || prev.city,
        state: data.state || prev.state,
      }));

      toast.success('CEP consultado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao consultar CEP:', error);
      if (error.response?.status === 404) {
        toast.error('CEP não encontrado.');
      } else {
        toast.error('Erro ao consultar CEP. Verifique o número digitado.');
      }
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      if (editingLocation) {
        await axios.put(`${API_URL}/api/locations/${editingLocation.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Localização atualizada com sucesso!');
      } else {
        await axios.post(`${API_URL}/api/locations`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Localização cadastrada com sucesso!');
      }

      setShowModal(false);
      setEditingLocation(null);
      resetForm();
      fetchLocations();
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      toast.error('Erro ao salvar localização. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      city: location.city,
      state: location.state,
      zipCode: '',
      type: location.type,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setLocationToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!locationToDelete) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/locations/${locationToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLocations(locations.filter(l => l.id !== locationToDelete));
      toast.success('Localização excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir localização:', error);
      toast.error('Erro ao excluir localização.');
    } finally {
      setShowDeleteModal(false);
      setLocationToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      city: '',
      state: '',
      zipCode: '',
      type: 'BOTH',
    });
  };

  const typeLabels = {
    ORIGIN: 'Origem',
    DESTINATION: 'Destino',
    BOTH: 'Origem/Destino',
  };

  const typeColors = {
    ORIGIN: 'bg-green-100 text-green-800',
    DESTINATION: 'bg-blue-100 text-blue-800',
    BOTH: 'bg-purple-100 text-purple-800',
  };

  if (loading && !showModal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Origens e Destinos</h1>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Localização
        </Button>
      </div>

      {locations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <MapPin className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma localização cadastrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              Cadastre origens e destinos para facilitar o cadastro de viagens.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((location) => (
            <Card key={location.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-6 w-6 text-gray-400 mt-1" />
                    <div>
                      <h3 className="font-semibold text-lg">{location.name}</h3>
                      <p className="text-sm text-gray-600">
                        {location.city} - {location.state}
                      </p>
                      <span className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full ${typeColors[location.type]}`}>
                        {typeLabels[location.type]}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(location)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(location.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>{editingLocation ? 'Editar Localização' : 'Nova Localização'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    CEP (Opcional) {loadingCep && <span className="text-blue-600">(Consultando...)</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    disabled={loadingCep}
                    className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Digite o CEP e saia do campo para buscar cidade/estado automaticamente
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Nome do Local *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Ex: Terminal de Cargas São Paulo"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Cidade *</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                      placeholder="São Paulo"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Estado *</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                      placeholder="SP"
                      maxLength={2}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="BOTH">Origem e Destino</option>
                    <option value="ORIGIN">Apenas Origem</option>
                    <option value="DESTINATION">Apenas Destino</option>
                  </select>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowModal(false);
                      setEditingLocation(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : editingLocation ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
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
                Tem certeza que deseja excluir esta localização? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setLocationToDelete(null);
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
    </div>
  );
}
