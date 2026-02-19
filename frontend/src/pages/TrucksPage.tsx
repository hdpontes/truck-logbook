import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { trucksAPI } from '@/lib/api';
import { Plus, Truck as TruckIcon, Calendar, DollarSign, Wrench } from 'lucide-react';

export default function TrucksPage() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: trucksData, isLoading } = useQuery({
    queryKey: ['trucks'],
    queryFn: async () => {
      const response = await trucksAPI.getAll();
      return response.data.trucks;
    },
  });

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
          <h2 className="text-3xl font-bold text-gray-800">Caminhões</h2>
          <p className="text-gray-600 mt-1">Gerencie sua frota de veículos</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Adicionar Caminhão
        </button>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trucksData?.map((truck: any) => (
          <div
            key={truck.id}
            onClick={() => navigate(`/trucks/${truck.id}`)}
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow cursor-pointer overflow-hidden"
          >
            {/* Header do Card */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center gap-3">
                <TruckIcon className="w-8 h-8" />
                <div>
                  <h3 className="text-2xl font-bold">{truck.plate}</h3>
                  <p className="text-blue-100 text-sm">{truck.brand} {truck.model}</p>
                </div>
              </div>
            </div>

            {/* Conteúdo do Card */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Ano</span>
                <span className="font-semibold text-gray-800">{truck.year}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Capacidade</span>
                <span className="font-semibold text-gray-800">{truck.capacity || '-'} ton</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Consumo Médio</span>
                <span className="font-semibold text-gray-800">{truck.avgConsumption || '-'} km/l</span>
              </div>

              {/* Badges de Informações */}
              <div className="pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{truck._count?.trips || 0} viagens</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  <span>{truck._count?.expenses || 0} despesas</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Wrench className="w-4 h-4" />
                  <span>{truck._count?.maintenances || 0} manutenções</span>
                </div>
              </div>

              {/* Status */}
              <div className="pt-4">
                {truck.active ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ● Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    ● Inativo
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {trucksData?.length === 0 && (
        <div className="text-center py-12">
          <TruckIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Nenhum caminhão cadastrado</p>
          <p className="text-gray-500 text-sm mt-2">Clique em "Adicionar Caminhão" para começar</p>
        </div>
      )}
    </div>
  );
}
