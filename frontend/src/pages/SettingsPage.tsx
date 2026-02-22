import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { settingsAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Settings, Save, Building2, DollarSign, Image } from 'lucide-react';

interface SettingsData {
  id: string;
  companyName: string;
  companyLogo: string | null;
  dieselPrice: number;
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    companyLogo: '',
    dieselPrice: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsAPI.get();
      setSettings(data);
      setFormData({
        companyName: data.companyName,
        companyLogo: data.companyLogo || '',
        dieselPrice: data.dieselPrice.toString(),
      });
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData: any = {};

      // ADMIN pode atualizar nome e logo
      if (user?.role === 'ADMIN') {
        if (formData.companyName !== settings?.companyName) {
          updateData.companyName = formData.companyName;
        }
        if (formData.companyLogo !== settings?.companyLogo) {
          updateData.companyLogo = formData.companyLogo || null;
        }
      }

      // ADMIN e MANAGER podem atualizar preço do diesel
      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        if (parseFloat(formData.dieselPrice) !== settings?.dieselPrice) {
          updateData.dieselPrice = parseFloat(formData.dieselPrice);
        }
      }

      await settingsAPI.update(updateData);
      alert('Configurações atualizadas com sucesso!');
      fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      alert(error.response?.data?.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
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
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Settings className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        </div>
        <p className="text-gray-500 mt-2">Gerencie as configurações do sistema</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Configurações da Empresa - Apenas ADMIN */}
          {user?.role === 'ADMIN' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Informações da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      URL do Logo
                    </div>
                  </label>
                  <input
                    type="url"
                    name="companyLogo"
                    value={formData.companyLogo}
                    onChange={handleChange}
                    placeholder="https://exemplo.com/logo.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deixe em branco para usar o logo padrão
                  </p>
                </div>

                {formData.companyLogo && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                    <img
                      src={formData.companyLogo}
                      alt="Logo preview"
                      className="h-16 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Preço do Diesel - ADMIN e MANAGER */}
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Preço do Combustível
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço do Diesel (R$ por litro) *
                  </label>
                  <input
                    type="number"
                    name="dieselPrice"
                    value={formData.dieselPrice}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Este valor será usado para calcular o custo de combustível nas viagens
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Como funciona o cálculo:
                  </h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• O sistema calcula: <strong>Distância ÷ Consumo do Caminhão (km/l)</strong></li>
                    <li>• Multiplica pelos litros consumidos × Preço do Diesel</li>
                    <li>• Se não houver despesas de combustível, usa o valor estimado</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
