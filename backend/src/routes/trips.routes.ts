import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import axios from 'axios';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Função auxiliar para enviar webhook
async function sendWebhook(eventType: string, data: any) {
  if (!config.N8N_WEBHOOK_URL) {
    console.log('⚠️  N8N_WEBHOOK_URL not configured, skipping webhook');
    return;
  }

  try {
    await axios.post(config.N8N_WEBHOOK_URL, {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    });
    console.log(`✅ Webhook sent: ${eventType}`);
  } catch (error) {
    console.error(`❌ Error sending webhook ${eventType}:`, error);
  }
}

// GET /api/trips - Listar todas as viagens
router.get('/', async (req, res) => {
  try {
    const { status, truckId, driverId, clientId, startDate, endDate } = req.query;

    const trips = await prisma.trip.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(truckId && { truckId: truckId as string }),
        ...(driverId && { driverId: driverId as string }),
        ...(clientId && { clientId: clientId as string }),
        ...(startDate && {
          startDate: {
            gte: new Date(startDate as string),
          },
        }),
        ...(endDate && {
          startDate: {
            lte: new Date(endDate as string),
          },
        }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
        trailer: {
          select: { id: true, plate: true, model: true, brand: true },
        },
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true, city: true, state: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/trips/truck/:truckId - Obter viagens de um caminhão
router.get('/truck/:truckId', async (req, res) => {
  try {
    const { truckId } = req.params;

    const trips = await prisma.trip.findMany({
      where: { truckId },
      include: {
        trailer: {
          select: { id: true, plate: true, model: true, brand: true },
        },
        driver: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/trips/:id - Obter detalhes de uma viagem
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true, phone: true, email: true, city: true, state: true },
        },
        expenses: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    res.json(trip);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips - Criar nova viagem (agendar)
router.post('/', async (req, res) => {
  try {
    const { truckId, trailerId, driverId, clientId, tripCode, origin, destination, startDate, distance, revenue, notes } = req.body;

    if (!truckId || !driverId || !clientId || !origin || !destination || !startDate) {
      return res.status(400).json({ 
        message: 'TruckId, driverId, clientId, origin, destination and startDate are required' 
      });
    }

    // Validação 1: Não permitir data retroativa
    const tripStartDate = new Date(startDate);
    const now = new Date();
    
    // Comparar timestamps diretos (ambos em UTC)
    if (tripStartDate.getTime() < now.getTime()) {
      return res.status(400).json({ 
        message: 'Não é permitido cadastrar viagens com data/hora retroativa' 
      });
    }

    // Verificar se o caminhão existe
    const truck = await prisma.truck.findUnique({
      where: { id: truckId },
    });

    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    // Verificar se o motorista existe
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Verificar se a carreta existe (se fornecida)
    let trailer = null;
    if (trailerId) {
      trailer = await prisma.trailer.findUnique({
        where: { id: trailerId },
      });

      if (!trailer) {
        return res.status(404).json({ message: 'Trailer not found' });
      }
    }

    // Verificar se o cliente existe
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Validação 2: Verificar intervalo mínimo de 3h entre início de viagens (caminhão)
    const MINIMUM_INTERVAL_HOURS = 3;
    const MINIMUM_INTERVAL_MS = MINIMUM_INTERVAL_HOURS * 60 * 60 * 1000;

    const truckTrips = await prisma.trip.findMany({
      where: {
        truckId,
        status: {
          in: ['PLANNED', 'IN_PROGRESS', 'DELAYED'],
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    for (const existingTrip of truckTrips) {
      const existingStartTime = existingTrip.startDate.getTime();
      const newStartTime = tripStartDate.getTime();

      // Calcular intervalo entre o início da viagem existente e o início da nova
      const intervalMs = Math.abs(newStartTime - existingStartTime);

      // Se o intervalo for menor que 3 horas, bloquear
      if (intervalMs < MINIMUM_INTERVAL_MS) {
        const intervaloHoras = (intervalMs / (60 * 60 * 1000)).toFixed(1);
        return res.status(400).json({ 
          message: `Intervalo insuficiente: apenas ${intervaloHoras}h entre o início das viagens. É necessário um intervalo mínimo de ${MINIMUM_INTERVAL_HOURS}h entre o início de uma viagem e o início da próxima para o mesmo caminhão.` 
        });
      }
    }

    // Validação 3: Verificar intervalo mínimo de 3h entre início de viagens (motorista)
    const driverTrips = await prisma.trip.findMany({
      where: {
        driverId,
        status: {
          in: ['PLANNED', 'IN_PROGRESS', 'DELAYED'],
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    for (const existingTrip of driverTrips) {
      const existingStartTime = existingTrip.startDate.getTime();
      const newStartTime = tripStartDate.getTime();

      // Calcular intervalo entre o início da viagem existente e o início da nova
      const intervalMs = Math.abs(newStartTime - existingStartTime);

      // Se o intervalo for menor que 3 horas, bloquear
      if (intervalMs < MINIMUM_INTERVAL_MS) {
        const intervaloHoras = (intervalMs / (60 * 60 * 1000)).toFixed(1);
        return res.status(400).json({ 
          message: `Intervalo insuficiente: apenas ${intervaloHoras}h entre o início das viagens. É necessário um intervalo mínimo de ${MINIMUM_INTERVAL_HOURS}h entre o início de uma viagem e o início da próxima para o mesmo motorista.` 
        });
      }
    }

    const trip = await prisma.trip.create({
      data: {
        truckId,
        trailerId: trailerId || null,
        driverId,
        clientId: clientId || null,
        tripCode: tripCode || null,
        origin,
        destination,
        startDate: tripStartDate,
        distance: distance ? parseFloat(distance) : 0,
        revenue: revenue ? parseFloat(revenue) : 0,
        notes,
        status: 'PLANNED',
      },
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true },
        },
      },
    });

    // Enviar webhook de corrida agendada
    await sendWebhook('trip.scheduled', {
      trip: {
        id: trip.id,
        tripCode: trip.tripCode,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.startDate,
        revenue: trip.revenue,
      },
      truck: {
        id: truck.id,
        plate: truck.plate,
        model: truck.model,
        brand: truck.brand,
      },
      trailer: trailer ? {
        id: trailer.id,
        plate: trailer.plate,
        model: trailer.model,
        brand: trailer.brand,
      } : null,
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
      },
      client: trip.client ? {
        clientId: trip.client.id,
        name: trip.client.name,
        cnpj: trip.client.cnpj?.replace(/\D/g, '') || null,
      } : null,
    });

    res.status(201).json(trip);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/start - Iniciar uma viagem
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.status !== 'PLANNED' && trip.status !== 'DELAYED') {
      return res.status(400).json({ 
        message: 'Only planned or delayed trips can be started' 
      });
    }

    // Pegar quilometragem atual do caminhão
    const startMileage = trip.truck.currentMileage || 0;

    // Atualizar trip e status do caminhão
    const [updatedTrip] = await prisma.$transaction([
      prisma.trip.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          startDate: new Date(),
          startMileage,
        },
        include: {
          truck: true,
          driver: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.truck.update({
        where: { id: trip.truckId },
        data: { status: 'IN_TRANSIT' },
      }),
    ]);

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error starting trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/finish - Finalizar uma viagem
router.post('/:id/finish', async (req, res) => {
  try {
    const { id } = req.params;
    const { endDate, endMileage } = req.body;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        expenses: true,
        truck: true,
        driver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.status !== 'IN_PROGRESS') {
      return res.status(400).json({ 
        message: 'Only in progress trips can be finished' 
      });
    }

    // Calcular distância percorrida baseada na quilometragem
    let finalDistance = trip.distance;
    let finalEndMileage = endMileage ? parseFloat(endMileage) : null;
    
    if (finalEndMileage && trip.startMileage) {
      finalDistance = finalEndMileage - trip.startMileage;
      
      // Validação: quilometragem final deve ser maior que inicial
      if (finalDistance < 0) {
        return res.status(400).json({ 
          message: 'A quilometragem final deve ser maior que a quilometragem inicial' 
        });
      }
    }

    // Calcular custos totais a partir das despesas
    const fuelCost = trip.expenses
      .filter((e) => e.type === 'FUEL')
      .reduce((sum, e) => sum + e.amount, 0);

    const tollCost = trip.expenses
      .filter((e) => e.type === 'TOLL')
      .reduce((sum, e) => sum + e.amount, 0);

    const otherCosts = trip.expenses
      .filter((e) => e.type !== 'FUEL' && e.type !== 'TOLL')
      .reduce((sum, e) => sum + e.amount, 0);

    // Calcular consumo de combustível baseado na kilometragem e consumo do caminhão
    let calculatedFuelCost = fuelCost;
    
    if (finalDistance > 0 && trip.truck.avgConsumption && trip.truck.avgConsumption > 0) {
      // Buscar preço do diesel nas configurações
      const settings = await prisma.settings.findFirst();
      const dieselPrice = settings?.dieselPrice || 0;
      
      if (dieselPrice > 0) {
        // Calcular litros consumidos = distância / km por litro
        const litersConsumed = finalDistance / trip.truck.avgConsumption;
        // Calcular custo estimado
        const estimatedFuelCost = litersConsumed * dieselPrice;
        
        // Se não há despesas de combustível registradas, usar o cálculo estimado
        if (fuelCost === 0) {
          calculatedFuelCost = estimatedFuelCost;
        }
      }
    }

    const totalCost = calculatedFuelCost + tollCost + otherCosts;
    const profit = trip.revenue - totalCost;
    const profitMargin = trip.revenue > 0 ? (profit / trip.revenue) * 100 : 0;

    // Atualizar trip, retornar caminhão para garagem e atualizar quilometragem
    const [updatedTrip] = await prisma.$transaction([
      prisma.trip.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          endDate: endDate ? new Date(endDate) : new Date(),
          distance: finalDistance,
          endMileage: finalEndMileage,
          fuelCost: calculatedFuelCost,
          tollCost,
          otherCosts,
          totalCost,
          profit,
          profitMargin,
        },
        include: {
          truck: true,
          driver: {
            select: { id: true, name: true, email: true },
          },
          expenses: true,
        },
      }),
      prisma.truck.update({
        where: { id: trip.truckId },
        data: { 
          status: 'GARAGE',
          // Atualizar quilometragem atual do caminhão se foi informada
          ...(finalEndMileage && { currentMileage: finalEndMileage }),
        },
      }),
    ]);

    // Enviar webhook de corrida finalizada
    await sendWebhook('trip.completed', {
      trip: {
        id: updatedTrip.id,
        origin: updatedTrip.origin,
        destination: updatedTrip.destination,
        revenue: updatedTrip.revenue,
        totalCost: updatedTrip.totalCost,
        profit: updatedTrip.profit,
        profitMargin: updatedTrip.profitMargin,
      },
      truck: {
        plate: updatedTrip.truck.plate,
        model: updatedTrip.truck.model,
      },
      driver: {
        name: updatedTrip.driver.name,
        email: updatedTrip.driver.email,
      },
    });

    // Verificar se o lucro está abaixo do limite
    if (profitMargin < config.PROFIT_LOW_THRESHOLD * 100) {
      await sendWebhook('trip.low_profit', {
        trip: {
          id: updatedTrip.id,
          origin: updatedTrip.origin,
          destination: updatedTrip.destination,
          profit: updatedTrip.profit,
          profitMargin: updatedTrip.profitMargin,
        },
        threshold: config.PROFIT_LOW_THRESHOLD * 100,
      });
    }

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error finishing trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/trips/:id - Atualizar uma viagem
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { tripCode, truckId, trailerId, driverId, clientId, origin, destination, startDate, endDate, revenue, distance, notes, status } = req.body;

    // Apenas ADMIN e MANAGER podem editar viagens
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ 
        message: 'Apenas administradores e gerentes podem editar viagens' 
      });
    }

    // Validar campos obrigatórios se fornecidos
    if (clientId === '') {
      return res.status(400).json({ 
        message: 'Cliente é obrigatório' 
      });
    }

    // Buscar viagem atual
    const currentTrip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        driver: true,
      },
    });

    if (!currentTrip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Permitir edição apenas de viagens PLANNED
    if (currentTrip.status !== 'PLANNED' && currentTrip.status !== 'DELAYED') {
      return res.status(400).json({ 
        message: 'Apenas viagens planejadas ou atrasadas podem ser editadas' 
      });
    }

    // Se alterar caminhão ou motorista, buscar os novos dados
    let truck = currentTrip.truck;
    let driver = currentTrip.driver;
    let trailer = null;

    if (truckId && truckId !== currentTrip.truckId) {
      const newTruck = await prisma.truck.findUnique({
        where: { id: truckId },
      });
      if (!newTruck) {
        return res.status(404).json({ message: 'Truck not found' });
      }
      truck = newTruck;
    }

    if (driverId && driverId !== currentTrip.driverId) {
      const newDriver = await prisma.user.findUnique({
        where: { id: driverId },
      });
      if (!newDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      driver = newDriver;
    }

    if (trailerId !== undefined) {
      if (trailerId) {
        const newTrailer = await prisma.trailer.findUnique({
          where: { id: trailerId },
        });
        if (!newTrailer) {
          return res.status(404).json({ message: 'Trailer not found' });
        }
        trailer = newTrailer;
      }
    }

    // Validar cliente se fornecido
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
    }

    const trip = await prisma.trip.update({
      where: { id },
      data: {
        ...(tripCode !== undefined && { tripCode }),
        ...(truckId && { truckId }),
        ...(trailerId !== undefined && { trailerId: trailerId || null }),
        ...(driverId && { driverId }),
        ...(clientId && { clientId }),
        ...(origin && { origin }),
        ...(destination && { destination }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(revenue !== undefined && { revenue: parseFloat(revenue) }),
        ...(distance !== undefined && { distance: parseFloat(distance) }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      },
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true },
        },
      },
    });

    // Enviar webhook de viagem atualizada (como se fosse nova viagem agendada)
    await sendWebhook('trip.scheduled', {
      trip: {
        id: trip.id,
        tripCode: trip.tripCode,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.startDate,
        revenue: trip.revenue,
        updated: true, // Flag indicando que é uma atualização
      },
      truck: {
        id: truck.id,
        plate: truck.plate,
        model: truck.model,
        brand: truck.brand,
      },
      trailer: trailer ? {
        id: trailer.id,
        plate: trailer.plate,
        model: trailer.model,
        brand: trailer.brand,
      } : null,
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
      },
      client: trip.client ? {
        clientId: trip.client.id,
        name: trip.client.name,
        cnpj: trip.client.cnpj?.replace(/\D/g, '') || null,
      } : null,
      updatedBy: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    res.json(trip);
  } catch (error: any) {
    console.error('Error updating trip:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/trips/:id - Deletar uma viagem
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Buscar a viagem
    const trip = await prisma.trip.findUnique({
      where: { id },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // ADMIN pode excluir qualquer viagem
    // MANAGER pode excluir apenas viagens PLANNED
    if (user.role !== 'ADMIN') {
      if (user.role !== 'MANAGER') {
        return res.status(403).json({ 
          message: 'Você não tem permissão para excluir viagens' 
        });
      }
      
      if (trip.status !== 'PLANNED') {
        return res.status(403).json({ 
          message: 'Gerentes podem excluir apenas viagens planejadas' 
        });
      }
    }

    await prisma.trip.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting trip:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/send-reminder - Enviar lembrete manual para o motorista
router.post('/:id/send-reminder', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Apenas ADMIN e MANAGER podem enviar lembretes
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ 
        message: 'Apenas administradores e gerentes podem enviar lembretes' 
      });
    }

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        driver: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Enviar webhook de lembrete
    await sendWebhook('trip.reminder', {
      trip: {
        id: trip.id,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.startDate,
        status: trip.status,
        revenue: trip.revenue,
      },
      truck: {
        id: trip.truck.id,
        plate: trip.truck.plate,
        model: trip.truck.model,
        brand: trip.truck.brand,
      },
      driver: {
        id: trip.driver.id,
        name: trip.driver.name,
        email: trip.driver.email,
        phone: trip.driver.phone,
      },
      sentBy: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    res.json({ 
      message: 'Lembrete enviado com sucesso',
      trip: {
        id: trip.id,
        driver: trip.driver.name,
      },
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/check-delayed - Verificar e atualizar viagens em atraso
router.post('/check-delayed', async (req, res) => {
  try {
    const now = new Date();
    
    // Buscar viagens planejadas que já passaram do horário
    const delayedTrips = await prisma.trip.findMany({
      where: {
        status: 'PLANNED',
        startDate: {
          lt: now,
        },
      },
    });

    // Atualizar status para DELAYED
    if (delayedTrips.length > 0) {
      await prisma.trip.updateMany({
        where: {
          id: {
            in: delayedTrips.map(t => t.id),
          },
        },
        data: {
          status: 'DELAYED',
        },
      });

      // Enviar webhook para cada viagem atrasada
      for (const trip of delayedTrips) {
        const tripWithDetails = await prisma.trip.findUnique({
          where: { id: trip.id },
          include: {
            truck: true,
            driver: true,
          },
        });

        if (tripWithDetails) {
          await sendWebhook('trip.delayed', {
            trip: {
              id: tripWithDetails.id,
              origin: tripWithDetails.origin,
              destination: tripWithDetails.destination,
              startDate: tripWithDetails.startDate,
            },
            truck: {
              plate: tripWithDetails.truck.plate,
            },
            driver: {
              name: tripWithDetails.driver.name,
              phone: tripWithDetails.driver.phone,
            },
          });
        }
      }
    }

    res.json({ 
      message: `${delayedTrips.length} trip(s) marked as delayed`,
      count: delayedTrips.length,
    });
  } catch (error) {
    console.error('Error checking delayed trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/check-upcoming - Verificar viagens próximas (1h antes)
router.post('/check-upcoming', async (req, res) => {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Buscar viagens planejadas que começam em 1h
    const upcomingTrips = await prisma.trip.findMany({
      where: {
        status: 'PLANNED',
        startDate: {
          gte: now,
          lte: oneHourFromNow,
        },
      },
      include: {
        truck: true,
        driver: true,
      },
    });

    // Enviar webhook para cada viagem próxima
    for (const trip of upcomingTrips) {
      await sendWebhook('trip.upcoming', {
        trip: {
          id: trip.id,
          origin: trip.origin,
          destination: trip.destination,
          startDate: trip.startDate,
        },
        truck: {
          plate: trip.truck.plate,
          model: trip.truck.model,
        },
        driver: {
          name: trip.driver.name,
          phone: trip.driver.phone,
          email: trip.driver.email,
        },
      });
    }

    res.json({ 
      message: `${upcomingTrips.length} upcoming trip(s) found`,
      count: upcomingTrips.length,
    });
  } catch (error) {
    console.error('Error checking upcoming trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
