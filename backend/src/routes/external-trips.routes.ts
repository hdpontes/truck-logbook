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
      truckPlate,
      trailerPlate,
      driverCpf,
    } = req.body;

    console.log(`[External API] Dados recebidos:`, {
      tripCode,
      tripDate,
      startDate,
      endDate,
      truckPlate,
      trailerPlate,
      driverCpf,
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

    // Criar string ISO preservando o horário literal sem qualquer conversão
    // Aceita formatos: "2026-05-07" ou "2026-05-07 20:00:00" ou "2026-05-07T20:00:00"
    const parseLocalDate = (dateString: string): Date => {
      console.log(`[parseLocalDate] Input: "${dateString}"`);
      
      // Remover 'T' se existir e substituir por espaço
      const normalized = dateString.replace('T', ' ').trim();
      console.log(`[parseLocalDate] Normalized: "${normalized}"`);
      
      // Verificar se tem hora
      if (normalized.includes(' ')) {
        const [datePart, timePart] = normalized.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hours = '12', minutes = '00', seconds = '00'] = timePart.split(':');
        // Construir string ISO manualmente preservando o horário literal
        const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.000Z`;
        console.log(`[parseLocalDate] Com hora - ISO String: ${isoString}`);
        return new Date(isoString);
      } else {
        // Se não tem hora, usar meio-dia (12:00:00)
        const [year, month, day] = normalized.split('-');
        const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`;
        console.log(`[parseLocalDate] Sem hora - ISO String: ${isoString}`);
        return new Date(isoString);
      }
    };

    // Buscar caminhão pela placa (se fornecida)
    let truckId = null;
    if (truckPlate) {
      const truck = await prisma.truck.findFirst({
        where: {
          plate: {
            equals: truckPlate.toUpperCase().trim(),
            mode: 'insensitive',
          },
        },
      });

      if (truck) {
        truckId = truck.id;
        console.log(`[External API] Caminhão encontrado: ${truck.plate} (${truck.id})`);
      } else {
        console.log(`[External API] Caminhão não encontrado com placa: ${truckPlate}`);
      }
    }

    // Buscar carreta pela placa (se fornecida)
    let trailerId = null;
    if (trailerPlate) {
      const trailer = await prisma.trailer.findFirst({
        where: {
          plate: {
            equals: trailerPlate.toUpperCase().trim(),
            mode: 'insensitive',
          },
        },
      });

      if (trailer) {
        trailerId = trailer.id;
        console.log(`[External API] Carreta encontrada: ${trailer.plate} (${trailer.id})`);
      } else {
        console.log(`[External API] Carreta não encontrada com placa: ${trailerPlate}`);
      }
    }

    // Buscar motorista pelo CPF (se fornecido)
    let driverId = null;
    if (driverCpf) {
      // Limpar CPF (remover caracteres especiais)
      const cleanCpf = driverCpf.replace(/[^0-9]/g, '');
      
      const driver = await prisma.user.findFirst({
        where: {
          cpf: cleanCpf,
          role: 'DRIVER',
        },
      });

      if (driver) {
        driverId = driver.id;
        console.log(`[External API] Motorista encontrado: ${driver.name} - CPF: ${cleanCpf} (${driver.id})`);
      } else {
        console.log(`[External API] Motorista não encontrado com CPF: ${cleanCpf}`);
      }
    }

    // Criar viagem temporária (dados mínimos)
    // Truck, driver e trailer podem ser preenchidos se fornecidos pela API
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
        
        // Campos opcionais - podem ser preenchidos pela API ou na confirmação
        truckId,
        trailerId,
        driverId,
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
        preFilledData: {
          truck: truckId ? true : false,
          trailer: trailerId ? true : false,
          driver: driverId ? true : false,
        },
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
