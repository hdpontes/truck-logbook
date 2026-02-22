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
    const { status, truckId, driverId } = req.query;

    const trips = await prisma.trip.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(truckId && { truckId: truckId as string }),
        ...(driverId && { driverId: driverId as string }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
        driver: {
          select: { id: true, name: true, email: true, phone: true },
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
        driver: {
          select: { id: true, name: true, email: true, phone: true },
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
    const { truckId, driverId, origin, destination, startDate, distance, revenue, notes } = req.body;

    if (!truckId || !driverId || !origin || !destination || !startDate) {
      return res.status(400).json({ 
        message: 'TruckId, driverId, origin, destination and startDate are required' 
      });
    }

    // Validação 1: Não permitir data retroativa
    const tripStartDate = new Date(startDate);
    const now = new Date();
    if (tripStartDate < now) {
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

    // Validação 2: Verificar conflito de caminhão (mesmo caminhão em horários coincidentes)
    const conflictingTruckTrip = await prisma.trip.findFirst({
      where: {
        truckId,
        status: {
          in: ['PLANNED', 'IN_PROGRESS', 'DELAYED'],
        },
        OR: [
          {
            // Nova viagem começa durante viagem existente
            AND: [
              { startDate: { lte: tripStartDate } },
              {
                OR: [
                  { endDate: { gte: tripStartDate } },
                  { endDate: null },
                ],
              },
            ],
          },
        ],
      },
    });

    if (conflictingTruckTrip) {
      return res.status(400).json({ 
        message: 'Já existe uma viagem agendada para este caminhão nesta data/horário' 
      });
    }

    // Validação 3: Verificar conflito de motorista (mesmo motorista em horários coincidentes)
    const conflictingDriverTrip = await prisma.trip.findFirst({
      where: {
        driverId,
        status: {
          in: ['PLANNED', 'IN_PROGRESS', 'DELAYED'],
        },
        OR: [
          {
            // Nova viagem começa durante viagem existente
            AND: [
              { startDate: { lte: tripStartDate } },
              {
                OR: [
                  { endDate: { gte: tripStartDate } },
                  { endDate: null },
                ],
              },
            ],
          },
        ],
      },
    });

    if (conflictingDriverTrip) {
      return res.status(400).json({ 
        message: 'Já existe uma viagem agendada para este motorista nesta data/horário' 
      });
    }

    const trip = await prisma.trip.create({
      data: {
        truckId,
        driverId,
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
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    // Enviar webhook de corrida agendada
    await sendWebhook('trip.scheduled', {
      trip: {
        id: trip.id,
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
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
      },
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
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.status !== 'PLANNED' && trip.status !== 'DELAYED') {
      return res.status(400).json({ 
        message: 'Only planned or delayed trips can be started' 
      });
    }

    // Atualizar trip e status do caminhão
    const [updatedTrip] = await prisma.$transaction([
      prisma.trip.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          startDate: new Date(),
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
    const { endDate, distance } = req.body;

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

    const totalCost = fuelCost + tollCost + otherCosts;
    const profit = trip.revenue - totalCost;
    const profitMargin = trip.revenue > 0 ? (profit / trip.revenue) * 100 : 0;

    // Atualizar trip e retornar caminhão para garagem
    const [updatedTrip] = await prisma.$transaction([
      prisma.trip.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          endDate: endDate ? new Date(endDate) : new Date(),
          distance: distance ? parseFloat(distance) : trip.distance,
          fuelCost,
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
        data: { status: 'GARAGE' },
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
    const { origin, destination, startDate, endDate, revenue, distance, notes, status } = req.body;

    const trip = await prisma.trip.update({
      where: { id },
      data: {
        ...(origin && { origin }),
        ...(destination && { destination }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(revenue && { revenue: parseFloat(revenue) }),
        ...(distance && { distance: parseFloat(distance) }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      },
      include: {
        truck: true,
        driver: {
          select: { id: true, name: true, email: true },
        },
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

    // Apenas ADMIN pode excluir viagens
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ 
        message: 'Apenas administradores podem excluir viagens' 
      });
    }

    // Buscar a viagem
    const trip = await prisma.trip.findUnique({
      where: { id },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
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
