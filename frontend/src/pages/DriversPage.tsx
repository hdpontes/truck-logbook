import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driversAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Plus, User, Phone, FileText, Edit, Trash2 } from 'lucide-react';

export default function DriversPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    password: '',
  });

  const { data: driversData, isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const response = await driversAPI.getAll();
      return response.data.drivers;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => driversAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => driversAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      handleCloseModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => driversAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const handleOpenModal = (driver?: any) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        name: driver.name,
        email: driver.email,
        cpf: driver.cpf || '',
        phone: driver.phone || '',
        password: '',
      });
    } else {
      setEditingDriver(null);
      setFormData({
        name: '',
        email: '',
        cpf: '',
        phone: '',
        password: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDriver(null);
    setFormData({
      name: '',
      email: '',
      cpf: '',
      phone: '',
      password: '',
    });
  };

  const handleSubmit = () => {
    const submitData: any = {
      name: formData.name,
      email: formData.email,
      cpf: formData.cpf,
      phone: formData.phone,
      role: 'DRIVER',
    };

    if (formData.password) {
      submitData.password = formData.password;
    }

    if (editingDriver) {
      updateMutation.mutate({ id: editingDriver.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este motorista?')) {
      deleteMutation.mutate(id);
    }
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Motoristas</h2>
          <p className="text-gray-600 mt-1">Gerencie os motoristas da frota</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Adicionar Motorista
          </button>
        )}
      </div>

      {/* Lista de Motoristas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {driversData?.map((driver: any) => (
          <div key={driver.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow">
            <div className="p-6 space-y-4">
              {/* Avatar e Nome */}
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800">{driver.name}</h3>
                  <p className="text-sm text-gray-600">{driver.email}</p>
                </div>
              </div>

              {/* Informações */}
              <div className="space-y-2">
                {driver.cpf && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span>CPF: {formatCPF(driver.cpf)}</span>
                  </div>
                )}
                {driver.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{formatPhone(driver.phone)}</span>
                  </div>
                )}
              </div>

              {/* Estatísticas */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total de Viagens</span>
                  <span className="font-semibold text-gray-800">{driver._count?.trips || 0}</span>
                </div>
              </div>

              {/* Ações */}
              {isAdmin && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleOpenModal(driver)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(driver.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {driversData?.length === 0 && (
        <div className="text-center py-12">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Nenhum motorista cadastrado</p>
          <p className="text-gray-500 text-sm mt-2">Clique em "Adicionar Motorista" para começar</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              {editingDriver ? 'Editar Motorista' : 'Adicionar Motorista'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="João Silva"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="joao@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha {editingDriver ? '(deixe vazio para manter)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="********"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Salvando...'
                  : editingDriver
                  ? 'Salvar'
                  : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
