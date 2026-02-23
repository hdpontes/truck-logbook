import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { trailersAPI } from '@/services/api';
import { Truck, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface TrailerData {
  id: string;
  plate: string;
  model?: string;
  brand?: string;
  year?: number;
  capacity?: number;
  active: boolean;
  _count?: {
    trips: number;
  };
}

const TrailersPage: React.FC = () => {
  const navigate = useNavigate();
  const [trailers, setTrailers] = useState<TrailerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [trailerToDelete, setTrailerToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchTrailers();
  }, []);

  const fetchTrailers = async () => {
    try {
      setLoading(true);
      const data = await trailersAPI.getAll();
      setTrailers(data);
    } catch (error) {
      console.error('Erro ao carregar carretas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setTrailerToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!trailerToDelete) return;

    try {
      await trailersAPI.delete(trailerToDelete);
      setTrailers(trailers.filter(trailer => trailer.id !== trailerToDelete));
    } catch (error) {
      console.error('Erro ao excluir carreta:', error);
    } finally {
      setShowDeleteModal(false);
      setTrailerToDelete(null);
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
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Carretas</h1>
        <Button onClick={() => navigate('/trailers/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Carreta
        </Button>
      </div>

      {trailers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Truck className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma carreta cadastrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comece adicionando sua primeira carreta à frota.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/trailers/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Carreta
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trailers.map((trailer) => (
            <Card 
              key={trailer.id} 
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    {trailer.plate}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/trailers/${trailer.id}/edit`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(trailer.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <p className="text-gray-500">
                    <span className="font-medium">Modelo:</span> {trailer.model || 'N/A'}
                  </p>
                  <p className="text-gray-500">
                    <span className="font-medium">Marca:</span> {trailer.brand || 'N/A'}
                  </p>
                  <p className="text-gray-500">
                    <span className="font-medium">Ano:</span> {trailer.year || 'N/A'}
                  </p>
                  {trailer.capacity && (
                    <p className="text-gray-500">
                      <span className="font-medium">Capacidade:</span> {trailer.capacity}t
                    </p>
                  )}
                </div>
                <div className="pt-3 border-t flex justify-between text-sm">
                  <span className="text-gray-600">
                    {trailer._count?.trips || 0} viagens
                  </span>
                  <span className={`font-medium ${trailer.active ? 'text-green-600' : 'text-red-600'}`}>
                    {trailer.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>

    {/* Modal de Confirmação de Exclusão */}
    {showDeleteModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Confirmar Exclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-6">
              Tem certeza que deseja excluir esta carreta? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setTrailerToDelete(null);
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
};

export default TrailersPage;
