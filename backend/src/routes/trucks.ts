import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

export async function trucksRoutes(app: FastifyInstance) {
  // List all trucks
  app.get('/', {
    onRequest: [authenticate],
  }, async () => {
    const trucks = await prisma.truck.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            trips: true,
            expenses: true,
            maintenances: true,
          },
        },
      },
    });

    return { trucks };
  });

  // Get truck by ID
  app.get('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    const truck = await prisma.truck.findUnique({
      where: { id },
      include: {
        trips: {
          orderBy: { startDate: 'desc' },
          take: 10,
        },
        expenses: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        maintenances: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!truck) {
      throw new Error('Truck not found');
    }

    return { truck };
  });

  // Create truck
  app.post('/', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const createTruckSchema = z.object({
      plate: z.string(),
      model: z.string(),
      brand: z.string(),
      year: z.number().int(),
      color: z.string().optional(),
      chassisNum: z.string().optional(),
      capacity: z.number().optional(),
      avgConsumption: z.number().optional(),
    });

    const data = createTruckSchema.parse(request.body);

    const truck = await prisma.truck.create({
      data,
    });

    return reply.status(201).send({ truck });
  });

  // Update truck
  app.put('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const updateTruckSchema = z.object({
      plate: z.string().optional(),
      model: z.string().optional(),
      brand: z.string().optional(),
      year: z.number().int().optional(),
      color: z.string().optional(),
      chassisNum: z.string().optional(),
      capacity: z.number().optional(),
      avgConsumption: z.number().optional(),
      active: z.boolean().optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const data = updateTruckSchema.parse(request.body);

    const truck = await prisma.truck.update({
      where: { id },
      data,
    });

    return { truck };
  });

  // Delete truck
  app.delete('/:id', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    await prisma.truck.delete({
      where: { id },
    });

    return reply.status(204).send();
  });

  // Get truck statistics
  app.get('/:id/stats', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    const [trips, expenses, totalRevenue, totalCost] = await Promise.all([
      prisma.trip.count({ where: { truckId: id } }),
      prisma.expense.count({ where: { truckId: id } }),
      prisma.trip.aggregate({
        where: { truckId: id },
        _sum: { revenue: true, profit: true, distance: true },
      }),
      prisma.expense.aggregate({
        where: { truckId: id },
        _sum: { amount: true },
      }),
    ]);

    return {
      stats: {
        totalTrips: trips,
        totalExpenses: expenses,
        totalRevenue: totalRevenue._sum.revenue || 0,
        totalProfit: totalRevenue._sum.profit || 0,
        totalDistance: totalRevenue._sum.distance || 0,
        totalCost: totalCost._sum.amount || 0,
      },
    };
  });
}
