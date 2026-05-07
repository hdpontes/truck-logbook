import { Router } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

const router = Router();

// Middleware de autenticação Basic para API externa
const basicAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      message: 'Autenticação Basic necessária',
    });
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
      });
    }

    // Buscar cliente pelas credenciais
    const client = await prisma.client.findUnique({
      where: { apiUsername: username },
    });

    if (!client || !client.apiPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
      });
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, client.apiPassword);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
      });
    }

    // Cliente autenticado
    req.authenticatedClient = client;
    next();
  } catch (error) {
    console.error('Erro na autenticação Basic:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao autenticar',
    });
  }
};

/**
 * POST /api/external/trips
 * Recebe uma viagem de um sistema externo
 * 
 * Autenticação: Basic Auth (username e password do cliente)
 * 
 * Campos obrigatórios:
 * - clientCnpj: CNPJ do cliente (apenas números)
 * - clientName: Nome do cliente
 * - tripCode: Código da viagem
 * - tripDate: Data da viagem (ISO 8601)
 * 
 * Campos opcionais:
 * - origin: Origem
 * - destination: Destino
 * - distance: Distância em KM
 * - revenue: Valor da viagem
 * - startDate: Data de início
 * - endDate: Data de término
 * - notes: Observações
 * - cargo: Informações da carga
 * - weight: Peso em toneladas
 * - value: Valor da carga
 */
router.post('/trips', basicAuth, async (req: any, res: any) => {
  try {
    const authenticatedClient = req.authenticatedClient;

    const {
      clientCnpj,
      clientName,
      tripCode,
      tripDate,
      origin,
      destination,
      distance,
      revenue,
      startDate,
      endDate,
      notes,
      cargo,
      weight,
      value,
    } = req.body;

    console.log(`[External API] Dados recebidos:`, {
      tripCode,
      tripDate,
      startDate,
      endDate,
    });

    // Validar campos obrigatórios
    if (!clientCnpj || !clientName || !tripCode || !tripDate) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: clientCnpj, clientName, tripCode, tripDate',
        missingFields: {
          clientCnpj: !clientCnpj,
          clientName: !clientName,
          tripCode: !tripCode,
          tripDate: !tripDate,
        },
      });
    }

    // Limpar CNPJ (remover caracteres especiais)
    const cleanCnpj = clientCnpj.replace(/[^0-9]/g, '');

    if (cleanCnpj.length !== 14) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ inválido. Deve conter 14 dígitos',
      });
    }

    // Verificar se é o mesmo cliente autenticado (limpar CNPJ do banco também)
    const authenticatedClientCnpj = authenticatedClient.cnpj?.replace(/[^0-9]/g, '') || '';
    
    if (authenticatedClientCnpj !== cleanCnpj) {
      return res.status(403).json({
        success: false,
        message: 'CNPJ informado não corresponde às credenciais de autenticação',
        debug: {
          authenticated: authenticatedClientCnpj,
          provided: cleanCnpj,
        },
      });
    }

    // Usar o cliente já autenticado (não precisa buscar novamente)
    const client = authenticatedClient;

    if (!client.active) {
      return res.status(403).json({
        success: false,
        message: 'Cliente inativo. Por favor, contate o suporte.',
      });
    }

    // Verificar se já existe viagem com o mesmo código
    const existingTrip = await prisma.trip.findFirst({
      where: {
        clientId: client.id,
        tripCode,
      },
    });

    if (existingTrip) {
      return res.status(409).json({
        success: false,
        message: 'Já existe uma viagem cadastrada com este código',
        tripCode,
        existingTripId: existingTrip.id,
        existingTripStatus: existingTrip.status,
      });
    }

    // Criar data tratando como UTC para evitar conversões de timezone
    // O horário enviado será preservado literalmente
    // Aceita formatos: "2026-05-07" ou "2026-05-07 20:00:00" ou "2026-05-07T20:00:00"
    const parseLocalDate = (dateString: string) => {
      console.log(`[parseLocalDate] Input: "${dateString}"`);
      
      // Remover 'T' se existir e substituir por espaço
      const normalized = dateString.replace('T', ' ');
      console.log(`[parseLocalDate] Normalized: "${normalized}"`);
      
      // Verificar se tem hora
      if (normalized.includes(' ')) {
        const [datePart, timePart] = normalized.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours = 12, minutes = 0, seconds = 0] = timePart.split(':').map(Number);
        // Criar como UTC para preservar literalmente o horário informado
        const result = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0));
        console.log(`[parseLocalDate] Com hora - Result: ${result.toISOString()}`);
        return result;
      } else {
        // Se não tem hora, usar meio-dia (12:00:00)
        const [year, month, day] = normalized.split('-').map(Number);
        const result = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
        console.log(`[parseLocalDate] Sem hora - Result: ${result.toISOString()}`);
        return result;
      }
    };

    // Criar viagem temporária (dados mínimos)
    // Truck, driver e trailer serão preenchidos na confirmação
    const trip = await prisma.trip.create({
      data: {
        clientId: client.id,
        tripCode,
        origin: origin || 'A definir',
        destination: destination || 'A definir',
        startDate: startDate ? parseLocalDate(startDate) : parseLocalDate(tripDate),
        endDate: endDate ? parseLocalDate(endDate) : null,
        distance: distance || 0,
        revenue: revenue || 0,
        notes: notes || null,
        status: 'RECEIVED',
        
        // Campos opcionais - serão preenchidos na confirmação
        truckId: null,
        trailerId: null,
        driverId: null,
      },
    });

    console.log(`[External API] Viagem criada no banco:`, {
      id: trip.id,
      tripCode: trip.tripCode,
      startDate: trip.startDate,
      startDateISO: trip.startDate.toISOString(),
      endDate: trip.endDate,
    });

    console.log(`[External API] Viagem recebida: ${tripCode} - Cliente: ${client.name}`);

    return res.status(201).json({
      success: true,
      message: 'Viagem recebida com sucesso. Aguardando confirmação.',
      trip: {
        id: trip.id,
        tripCode: trip.tripCode,
        status: trip.status,
        clientName: client.name,
        receivedAt: trip.createdAt,
      },
    });

  } catch (error: any) {
    console.error('Erro ao receber viagem externa:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar viagem',
      error: error.message,
    });
  }
});

export default router;
