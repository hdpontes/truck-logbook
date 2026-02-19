import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { webhookService } from '../services/webhook';
import { config } from '../config';

export async function tripsRoutes(app: FastifyInstance) {
  // List all trips
  app.get('/', {
    onRequest: [authenticate],
  }, async (request) => {
    const querySchema = z.object({
      truckId: z.string().uuid().optional(),
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    });

    const query = querySchema.parse(request.query);

    const where: any = {};

    if (query.truckId) {
      where.truckId = query.truckId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.startDate = {};
      if (query.startDate) where.startDate.gte = new Date(query.startDate);
      if (query.endDate) where.startDate.lte = new Date(query.endDate);
    }

    const trips = await prisma.trip.findMany({
      where,
      include: {
        truck: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            expenses: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return { trips };
  });

  // Get trip by ID
  app.get('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        expenses: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    return { trip };
  });

  // Create trip (apenas ADMIN)
  app.post('/', {
    onRequest: [requireRole('ADMIN', 'MANAGER')],
  }, async (request, reply) => {
    const createTripSchema = z.object({
      truckId: z.string().uuid(),
      driverId: z.string().uuid(),
      origin: z.string(),
      destination: z.string(),
      startDate: z.string().transform(val => new Date(val)),
      endDate: z.string().transform(val => new Date(val)).optional(),
      distance: z.number().default(0),
      revenue: z.number().default(0),
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PLANNED'),
      notes: z.string().optional(),
    });

    const data = createTripSchema.parse(request.body);

    const trip = await prisma.trip.create({
      data: {
        ...data,
        totalCost: 0,
        profit: data.revenue,
        profitMargin: 0,
      },
      include: {
        truck: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Enviar notificação via webhook
    if (data.status === 'PLANNED') {
      await webhookService.notifyTripScheduled(trip);
    } else {
      await webhookService.notifyNewTrip(trip);
    }

    return reply.status(201).send({ trip });
  });

  // Update trip (apenas ADMIN)
  app.put('/:id', {
    onRequest: [requireRole('ADMIN', 'MANAGER')],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const updateTripSchema = z.object({
      origin: z.string().optional(),
      destination: z.string().optional(),
      startDate: z.string().transform(val => new Date(val)).optional(),
      endDate: z.string().transform(val => new Date(val)).optional(),
      distance: z.number().optional(),
      revenue: z.number().optional(),
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      notes: z.string().optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const data = updateTripSchema.parse(request.body);

    // Recalcular custos e lucro
    const currentTrip = await prisma.trip.findUnique({
      where: { id },
      include: {
        expenses: true,
      },
    });

    if (!currentTrip) {
      throw new Error('Trip not found');
    }

    const totalCost = currentTrip.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const revenue = data.revenue ?? currentTrip.revenue;
    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const trip = await prisma.trip.update({
      where: { id },
      data: {
        ...data,
        totalCost,
        profit,
        profitMargin,
      },
      include: {
        truck: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Se viagem foi marcada como concluída, enviar notificação
    if (data.status === 'COMPLETED' && currentTrip.status !== 'COMPLETED') {
      await webhookService.notifyTripCompleted(trip);
      
      // Verificar se lucro está baixo
      if (trip.profitMargin < config.PROFIT_LOW_THRESHOLD * 100) {
        await webhookService.notifyLowProfit(trip, config.PROFIT_LOW_THRESHOLD * 100);
      }
    }

    return { trip };
  });

  // Delete trip (apenas ADMIN)
  app.delete('/:id', {
    onRequest: [requireRole('ADMIN')],
  }, async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    await prisma.trip.delete({
      where: { id },
    });

    return reply.status(204).send();
  });

  // Calculate trip financials
  app.post('/:id/calculate', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        expenses: true,
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    const fuelCost = trip.expenses
      .filter(e => e.type === 'FUEL')
      .reduce((sum, e) => sum + e.amount, 0);

    const tollCost = trip.expenses
      .filter(e => e.type === 'TOLL')
      .reduce((sum, e) => sum + e.amount, 0);

    const otherCosts = trip.expenses
      .filter(e => e.type !== 'FUEL' && e.type !== 'TOLL')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCost = fuelCost + tollCost + otherCosts;
    const profit = trip.revenue - totalCost;
    const profitMargin = trip.revenue > 0 ? (profit / trip.revenue) * 100 : 0;

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        fuelCost,
        tollCost,
        otherCosts,
        totalCost,
        profit,
        profitMargin,
      },
    });

    return { trip: updatedTrip };
  });

  // Start trip (ADMIN e DRIVER)
  app.post('/:id/start', {
    onRequest: [requireRole('ADMIN', 'MANAGER', 'DRIVER')],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);
    const userId = (request.user as any).sub;

    const trip = await prisma.trip.findUnique({
      where: { id },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status !== 'PLANNED') {
      throw new Error('Trip cannot be started');
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startDate: new Date(),
      },
      include: {
        truck: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return { trip: updatedTrip };
  });

  // Finish trip (ADMIN e DRIVER)
  app.post('/:id/finish', {
    onRequest: [requireRole('ADMIN', 'MANAGER', 'DRIVER')],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);
    const userId = (request.user as any).sub;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        expenses: true,
        truck: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Trip is not in progress');
    }

    // Calcular custos
    const fuelCost = trip.expenses
      .filter(e => e.type === 'FUEL')
      .reduce((sum, e) => sum + e.amount, 0);

    const tollCost = trip.expenses
      .filter(e => e.type === 'TOLL')
      .reduce((sum, e) => sum + e.amount, 0);

    const otherCosts = trip.expenses
      .filter(e => e.type !== 'FUEL' && e.type !== 'TOLL')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCost = fuelCost + tollCost + otherCosts;
    const profit = trip.revenue - totalCost;
    const profitMargin = trip.revenue > 0 ? (profit / trip.revenue) * 100 : 0;

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endDate: new Date(),
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
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Enviar notificação de conclusão
    await webhookService.notifyTripCompleted(updatedTrip);

    // Verificar se lucro está baixo
    if (updatedTrip.profitMargin < config.PROFIT_LOW_THRESHOLD * 100) {
      await webhookService.notifyLowProfit(updatedTrip, config.PROFIT_LOW_THRESHOLD * 100);
    }

    return { trip: updatedTrip };
  });
}
