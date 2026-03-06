import { useState, useEffect } from 'react';
import { Eye, Filter, Download, RefreshCw, Calendar, User, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  totalLogs: number;
  byAction: Array<{ action: string; count: number }>;
  byEntity: Array<{ entity: string; count: number }>;
  topUsers: Array<{ userId: string | null; userName: string; count: number }>;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filtros
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Paginação
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  });

  // Listas para filtros
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);

  const { error } = useToast();

  useEffect(() => {
    fetchLogs();
    fetchStats();
    fetchFilterOptions();
  }, [pagination.page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      
      if (filterAction) params.action = filterAction;
      if (filterEntity) params.entity = filterEntity;
      if (filterUserId) params.userId = filterUserId;
      if (startDate) params.startDate = new Date(startDate + 'T00:00:00').toISOString();
      if (endDate) params.endDate = new Date(endDate + 'T23:59:59').toISOString();

      const response = await api.get('/logs', { params });
      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (err: any) {
      console.error('Erro ao buscar logs:', err);
      if (err.response?.status === 403) {
        error('Acesso negado. Apenas administradores podem visualizar logs.');
      } else {
        error('Erro ao carregar logs');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params: any = {};
      if (startDate) params.startDate = new Date(startDate + 'T00:00:00').toISOString();
      if (endDate) params.endDate = new Date(endDate + 'T23:59:59').toISOString();

      const response = await api.get('/logs/stats', { params });
      setStats(response.data);
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [actionsRes, entitiesRes] = await Promise.all([
        api.get('/logs/actions'),
        api.get('/logs/entities'),
      ]);
      setAvailableActions(actionsRes.data);
      setAvailableEntities(entitiesRes.data);
    } catch (err) {
      console.error('Erro ao buscar opções de filtro:', err);
    }
  };

  const handleApplyFilters = () => {
    setPagination({ ...pagination, page: 1 });
    fetchLogs();
    fetchStats();
  };

  const handleClearFilters = () => {
    setFilterAction('');
    setFilterEntity('');
    setFilterUserId('');
    setStartDate('');
    setEndDate('');
    setPagination({ ...pagination, page: 1 });
    setTimeout(() => {
      fetchLogs();
      fetchStats();
    }, 0);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionBadgeColor = (action: string) => {
    const colors: Record<string, string> = {
      LOGIN: 'bg-green-100 text-green-800',
      LOGOUT: 'bg-gray-100 text-gray-800',
      CREATE: 'bg-blue-100 text-blue-800',
      UPDATE: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      PASSWORD_CHANGE: 'bg-purple-100 text-purple-800',
      PAYMENT: 'bg-emerald-100 text-emerald-800',
      NOTIFICATION: 'bg-indigo-100 text-indigo-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-purple-100 text-purple-800',
      MANAGER: 'bg-blue-100 text-blue-800',
      DRIVER: 'bg-green-100 text-green-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const formatDetails = (details: string | null) => {
    if (!details) return null;
    try {
      const parsed = JSON.parse(details);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return details;
    }
  };

  const handleExport = async () => {
    try {
      const params: any = {};
      if (filterAction) params.action = filterAction;
      if (filterEntity) params.entity = filterEntity;
      if (filterUserId) params.userId = filterUserId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      // Buscar todos os logs sem paginação para exportar
      params.limit = 10000;
      
      const response = await api.get('/logs', { params });
      const allLogs = response.data.logs;
      
      // Converter para CSV
      const headers = ['Data/Hora', 'Usuário', 'Papel', 'Ação', 'Entidade', 'ID Entidade', 'IP', 'Detalhes'];
      const rows = allLogs.map((log: AuditLog) => [
        formatDateTime(log.createdAt),
        log.userName,
        log.userRole,
        log.action,
        log.entity,
        log.entityId || '',
        log.ipAddress || '',
        log.details ? log.details.replace(/"/g, '""') : ''
      ]);
      
      const csv = [
        headers.join(','),
        ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (err) {
      console.error('Erro ao exportar logs:', err);
      error('Erro ao exportar logs');
    }
  };

  if (loading && !logs.length) {
    return <div className="flex items-center justify-center h-64">Carregando logs...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logs de Auditoria</h1>
          <p className="text-gray-600 mt-1">Histórico de ações dos usuários no sistema</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full md:w-auto"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
          <Button
            variant="outline"
            onClick={fetchLogs}
            className="w-full md:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            className="w-full md:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total de Logs</p>
                <p className="text-2xl font-bold">{stats.totalLogs}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Usuários Ativos</p>
                <p className="text-2xl font-bold">{stats.topUsers.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Tipos de Ação</p>
                <p className="text-2xl font-bold">{stats.byAction.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Entidades</p>
                <p className="text-2xl font-bold">{stats.byEntity.length}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ação</label>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Todas</option>
                  {availableActions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entidade</label>
                <select
                  value={filterEntity}
                  onChange={(e) => setFilterEntity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Todas</option>
                  {availableEntities.map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApplyFilters}>
                <Filter className="mr-2 h-4 w-4" />
                Aplicar Filtros
              </Button>
              <Button variant="outline" onClick={handleClearFilters}>
                Limpar Filtros
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Lista de Logs */}
      <Card className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Papel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entidade</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-3 text-sm">{log.userName}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(log.userRole)}`}>
                    {log.userRole}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{log.entity}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{log.ipAddress || '-'}</td>
                <td className="px-4 py-3 text-sm text-center">
                  {log.details && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDetails(showDetails === log.id ? null : log.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Nenhum log encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Modal de Detalhes */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Detalhes do Log</h3>
            {(() => {
              const log = logs.find(l => l.id === showDetails);
              if (!log) return null;
              
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Data/Hora:</p>
                      <p className="font-medium">{formatDateTime(log.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Usuário:</p>
                      <p className="font-medium">{log.userName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Ação:</p>
                      <p className="font-medium">{log.action}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Entidade:</p>
                      <p className="font-medium">{log.entity}</p>
                    </div>
                    {log.entityId && (
                      <div>
                        <p className="text-sm text-gray-600">ID da Entidade:</p>
                        <p className="font-mono text-xs">{log.entityId}</p>
                      </div>
                    )}
                    {log.ipAddress && (
                      <div>
                        <p className="text-sm text-gray-600">Endereço IP:</p>
                        <p className="font-medium">{log.ipAddress}</p>
                      </div>
                    )}
                  </div>
                  
                  {log.details && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Detalhes:</p>
                      <pre className="bg-gray-50 p-4 rounded text-xs overflow-x-auto">
                        {formatDetails(log.details)}
                      </pre>
                    </div>
                  )}
                  
                  {log.userAgent && (
                    <div>
                      <p className="text-sm text-gray-600">User Agent:</p>
                      <p className="text-xs text-gray-500 break-all">{log.userAgent}</p>
                    </div>
                  )}
                </div>
              );
            })()}
            
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setShowDetails(null)}>
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Mostrando {logs.length} de {pagination.total} logs
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            >
              Anterior
            </Button>
            <span className="px-4 py-2 text-sm">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
