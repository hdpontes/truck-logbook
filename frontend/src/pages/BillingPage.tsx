import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { billingAPI, trucksAPI, driversAPI, clientsAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import {
  DollarSign,
  Filter,
  Download,
  Send,
  Search,
  FileText,
} from 'lucide-react';

interface BillingItem {
  id: string;
  type: string;
  date: string;
  tripCode: string;
  truck: {
    id: string;
    plate: string;
  };
  trailer?: {
    id: string;
    plate: string;
  } | null;
  driver: {
    id: string;
    name: string;
    firstName: string;
  };
  amount: number;
  client?: {
    id: string;
    name: string;
  };
}

interface BillingData {
  items: BillingItem[];
  summary: {
    totalAmount: number;
    itemCount: number;
  };
}

const BillingPage: React.FC = () => {
  const reportRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [sending, setSending] = useState(false);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvWhatsappNumber, setCsvWhatsappNumber] = useState('');

  // Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripCodeFilter, setTripCodeFilter] = useState('');
  const [truckFilter, setTruckFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Carregar dados iniciais (últimos 30 dias)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    
    loadFiltersData();
    fetchBillingData();
  }, []);

  const loadFiltersData = async () => {
    try {
      const [trucksData, driversData, clientsData] = await Promise.all([
        trucksAPI.getAll(),
        driversAPI.getAll(),
        clientsAPI.getAll(),
      ]);
      
      setTrucks(trucksData.filter((t: any) => t.active !== false));
      setDrivers(driversData.filter((d: any) => d.active !== false));
      setClients(clientsData.filter((c: any) => c.active !== false));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const fetchBillingData = async () => {
    try {
      setLoading(true);

      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (tripCodeFilter) params.tripCode = tripCodeFilter;
      if (truckFilter) params.truckId = truckFilter;
      if (driverFilter) params.driverId = driverFilter;
      if (clientFilter) params.clientId = clientFilter;

      const data = await billingAPI.get(params);
      setBillingData(data);
    } catch (error: any) {
      console.error('Erro ao buscar dados de cobrança:', error);
      toast.error(error.response?.data?.message || 'Erro ao buscar dados de cobrança');
    } finally {
      setLoading(false);
    }
  };

  const handleSendImageViaWhatsApp = async () => {
    if (!reportRef.current || !whatsappNumber) {
      toast.error('Por favor, informe o número do WhatsApp');
      return;
    }

    try {
      setSending(true);

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      const imageData = canvas.toDataURL('image/jpeg', 0.9);

      await billingAPI.sendWebhook({
        imageData,
        whatsappNumber,
        filters: {
          startDate,
          endDate,
          tripCode: tripCodeFilter,
          clientId: clientFilter,
        },
      });

      toast.success('Relatório de cobrança enviado com sucesso via WhatsApp!');
      setShowWhatsAppModal(false);
      setWhatsappNumber('');
    } catch (error: any) {
      console.error('Erro ao enviar relatório:', error);
      toast.error(error.response?.data?.message || 'Erro ao enviar relatório');
    } finally {
      setSending(false);
    }
  };

  const generateCSV = () => {
    if (!billingData || billingData.items.length === 0) {
      return '';
    }

    const headers = ['Tipo', 'Data', 'Romaneio', 'Cavalo', 'Carreta', 'Motorista', 'Cliente', 'Valor'];
    const rows = billingData.items.map(item => [
      item.type,
      new Date(item.date).toLocaleDateString('pt-BR'),
      item.tripCode,
      item.truck.plate,
      item.trailer?.plate || '-',
      item.driver.firstName,
      item.client?.name || '-',
      item.amount.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    return csvContent;
  };

  const handleConfirmSendCSV = async () => {
    if (!csvWhatsappNumber) {
      toast.error('Por favor, informe o número do WhatsApp');
      return;
    }

    try {
      setSending(true);

      const csvData = generateCSV();
      
      if (!csvData || csvData === 'Tipo,Data,Romaneio,Cavalo,Carreta,Motorista,Cliente,Valor\n') {
        toast.error('Nenhuma viagem encontrada para exportar');
        return;
      }

      await billingAPI.sendWebhook({
        csvData,
        whatsappNumber: csvWhatsappNumber,
        type: 'csv',
        filters: {
          startDate,
          endDate,
          clientId: clientFilter,
        },
      });

      toast.success('CSV enviado com sucesso via WhatsApp!');
      setShowCSVModal(false);
      setCsvWhatsappNumber('');
    } catch (error: any) {
      console.error('Erro ao enviar CSV:', error);
      toast.error(error.response?.data?.message || 'Erro ao enviar CSV');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadCSV = () => {
    const csvContent = generateCSV();
    
    if (!csvContent) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `cobrancas_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV baixado com sucesso');
  };

  if (loading && !billingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Cobranças</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadCSV}
            disabled={!billingData || billingData.items.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Baixar CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCSVModal(true)}
            disabled={!billingData || billingData.items.length === 0}
          >
            <Send className="mr-2 h-4 w-4" />
            Enviar CSV
          </Button>
          <Button
            onClick={() => {
              if (!reportRef.current) return;
              setShowWhatsAppModal(true);
            }}
            disabled={!billingData || billingData.items.length === 0}
          >
            <Send className="mr-2 h-4 w-4" />
            Enviar Imagem
          </Button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data Início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data Fim</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Código da Viagem</label>
                <input
                  type="text"
                  value={tripCodeFilter}
                  onChange={(e) => setTripCodeFilter(e.target.value)}
                  placeholder="Buscar por código..."
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cliente</label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Todos os clientes</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Caminhão</label>
                <select
                  value={truckFilter}
                  onChange={(e) => setTruckFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Todos os caminhões</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plate} - {truck.brand} {truck.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Motorista</label>
                <select
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Todos os motoristas</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={fetchBillingData}>
                <Search className="mr-2 h-4 w-4" />
                Aplicar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setTripCodeFilter('');
                  setTruckFilter('');
                  setDriverFilter('');
                  setClientFilter('');
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      {billingData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total a Cobrar</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatCurrency(billingData.summary.totalAmount)}
                  </p>
                </div>
                <DollarSign className="h-12 w-12 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total de Viagens</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {billingData.summary.itemCount}
                  </p>
                </div>
                <FileText className="h-12 w-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de cobranças */}
      <Card ref={reportRef}>
        <CardHeader>
          <CardTitle className="mb-6">Relatório de Cobranças - {startDate ? new Date(startDate).toLocaleDateString('pt-BR') : ''} até {endDate ? new Date(endDate).toLocaleDateString('pt-BR') : ''}</CardTitle>
          
          {/* Informações do cliente (se filtrado) */}
          {clientFilter && clients.length > 0 && (
            <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
              {(() => {
                const selectedClient = clients.find(c => c.id === clientFilter);
                if (selectedClient) {
                  return (
                    <div>
                      <p className="text-sm font-medium text-blue-900">Cliente:</p>
                      <p className="text-lg font-bold text-blue-900">{selectedClient.name}</p>
                      <p className="text-sm text-blue-700">CNPJ: {selectedClient.cnpj}</p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Resumo dentro do relatório */}
          {billingData && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">Total a Cobrar</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(billingData.summary.totalAmount)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">Total de Viagens</p>
                <p className="text-2xl font-bold text-blue-700">
                  {billingData.summary.itemCount}
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Tipo</th>
                  <th className="text-left p-4 font-medium">Data</th>
                  <th className="text-left p-4 font-medium">Romaneio</th>
                  <th className="text-left p-4 font-medium">Cavalo</th>
                  <th className="text-left p-4 font-medium">Carreta</th>
                  <th className="text-left p-4 font-medium">Motorista</th>
                  <th className="text-left p-4 font-medium">Cliente</th>
                  <th className="text-right p-4 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {billingData && billingData.items.length > 0 ? (
                  billingData.items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-green-600 font-medium">{item.type}</td>
                      <td className="p-4">
                        {new Date(item.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 font-mono text-sm">{item.tripCode}</td>
                      <td className="p-4">{item.truck.plate}</td>
                      <td className="p-4">{item.trailer?.plate || '-'}</td>
                      <td className="p-4">{item.driver.firstName}</td>
                      <td className="p-4">{item.client?.name || '-'}</td>
                      <td className="p-4 text-right font-bold text-green-600">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-gray-500">
                      Nenhuma viagem encontrada para o período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal WhatsApp - Imagem */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Enviar Imagem via WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="block text-sm font-medium mb-2">
                Número do WhatsApp
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="5511999999999"
                className="w-full px-3 py-2 border rounded-md mb-4"
              />
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowWhatsAppModal(false);
                    setWhatsappNumber('');
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSendImageViaWhatsApp} disabled={sending}>
                  {sending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal WhatsApp - CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Enviar CSV via WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="block text-sm font-medium mb-2">
                Número do WhatsApp
              </label>
              <input
                type="text"
                value={csvWhatsappNumber}
                onChange={(e) => setCsvWhatsappNumber(e.target.value)}
                placeholder="5511999999999"
                className="w-full px-3 py-2 border rounded-md mb-4"
              />
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCSVModal(false);
                    setCsvWhatsappNumber('');
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleConfirmSendCSV} disabled={sending}>
                  {sending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
