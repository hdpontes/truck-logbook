import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Client {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
  email?: string;
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClients(response.data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      if (editingClient) {
        await axios.put(`${API_URL}/api/clients/${editingClient.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert('Cliente atualizado com sucesso!');
      } else {
        await axios.post(`${API_URL}/api/clients`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert('Cliente cadastrado com sucesso!');
      }

      setShowModal(false);
      setEditingClient(null);
      resetForm();
      fetchClients();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      alert('Erro ao salvar cliente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      cnpj: client.cnpj,
      address: client.address,
      city: client.city,
      state: client.state,
      phone: client.phone || '',
      email: client.email || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/api/clients/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClients(clients.filter(c => c.id !== id));
        alert('Cliente excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        alert('Erro ao excluir cliente.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      cnpj: '',
      address: '',
      city: '',
      state: '',
      phone: '',
      email: '',
    });
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
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum cliente cadastrado</h3>
            <p className="mt-1 text-sm text-gray-500">Comece adicionando seu primeiro cliente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <Building2 className="h-8 w-8 text-gray-400" />
                  <div>
                    <h3 className="font-semibold text-lg">{client.name}</h3>
                    <p className="text-sm text-gray-600">CNPJ: {client.cnpj}</p>
                    <p className="text-sm text-gray-500">
                      {client.address}, {client.city} - {client.state}
                    </p>
                    {client.phone && (
                      <p className="text-sm text-gray-500">Tel: {client.phone}</p>
                    )}
                    {client.email && (
                      <p className="text-sm text-gray-500">Email: {client.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(client)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(client.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Razão Social *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">CNPJ *</label>
                    <input
                      type="text"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      required
                      placeholder="00.000.000/0000-00"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Telefone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(00) 0000-0000"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Endereço *</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      placeholder="Rua, número, bairro"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Cidade *</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
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

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowModal(false);
                      setEditingClient(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : editingClient ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
