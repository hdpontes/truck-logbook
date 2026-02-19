import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

export async function dashboardRoutes(app: FastifyInstance) {
  // Get dashboard overview
  app.get('/overview', {
    onRequest: [authenticate],
  }, async (request) => {
    const querySchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    });

    const query = querySchema.parse(request.query);

    const dateFilter: any = {};
    if (query.startDate || query.endDate) {
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
    }

    // Totais gerais
    const [
      totalTrucks,
      activeTrucks,
      totalTrips,
      activeTrips,
      totalExpenses,
      tripStats,
      expensesByType,
      pendingMaintenances,
    ] = await Promise.all([
      prisma.truck.count(),
      prisma.truck.count({ where: { active: true } }),
      prisma.trip.count(),
      prisma.trip.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.expense.count(),
      prisma.trip.aggregate({
        _sum: {
          revenue: true,
          totalCost: true,
          profit: true,
          distance: true,
        },
        _avg: {
          profitMargin: true,
        },
      }),
      prisma.expense.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: true,
      }),
      prisma.maintenance.count({
        where: {
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
      }),
    ]);

    return {
      overview: {
        trucks: {
          total: totalTrucks,
          active: activeTrucks,
        },
        trips: {
          total: totalTrips,
          active: activeTrips,
          totalRevenue: tripStats._sum.revenue || 0,
          totalCost: tripStats._sum.totalCost || 0,
          totalProfit: tripStats._sum.profit || 0,
          totalDistance: tripStats._sum.distance || 0,
          avgProfitMargin: tripStats._avg.profitMargin || 0,
        },
        expenses: {
          total: totalExpenses,
          byType: expensesByType,
        },
        maintenances: {
          pending: pendingMaintenances,
        },
      },
    };
  });

  // Get truck performance
  app.get('/trucks/performance', {
    onRequest: [authenticate],
  }, async (request) => {
    const querySchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    });

    const query = querySchema.parse(request.query);

    const dateFilter: any = {};
    if (query.startDate || query.endDate) {
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
    }

    const trucks = await prisma.truck.findMany({
      where: { active: true },
      include: {
        trips: {
          where: dateFilter.gte ? { startDate: dateFilter } : undefined,
        },
        expenses: {
          where: dateFilter.gte ? { date: dateFilter } : undefined,
        },
      },
    });

    const performance = trucks.map(truck => {
      const totalRevenue = truck.trips.reduce((sum, trip) => sum + trip.revenue, 0);
      const totalCost = truck.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const totalProfit = totalRevenue - totalCost;
      const totalDistance = truck.trips.reduce((sum, trip) => sum + trip.distance, 0);
      const avgProfitMargin = truck.trips.length > 0
        ? truck.trips.reduce((sum, trip) => sum + trip.profitMargin, 0) / truck.trips.length
        : 0;

      return {
        truck: {
          id: truck.id,
          plate: truck.plate,
          model: truck.model,
          brand: truck.brand,
        },
        metrics: {
          totalTrips: truck.trips.length,
          totalRevenue,
          totalCost,
          totalProfit,
          totalDistance,
          avgProfitMargin,
          costPerKm: totalDistance > 0 ? totalCost / totalDistance : 0,
          revenuePerKm: totalDistance > 0 ? totalRevenue / totalDistance : 0,
        },
      };
    });

    return { performance };
  });

  // Get recent activities
  app.get('/activities/recent', {
    onRequest: [authenticate],
  }, async () => {
    const [recentTrips, recentExpenses, recentMaintenances] = await Promise.all([
      prisma.trip.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          truck: {
            select: { id: true, plate: true },
          },
          driver: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.expense.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          truck: {
            select: { id: true, plate: true },
          },
        },
      }),
      prisma.maintenance.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          truck: {
            select: { id: true, plate: true },
          },
        },
      }),
    ]);

    return {
      activities: {
        trips: recentTrips,
        expenses: recentExpenses,
        maintenances: recentMaintenances,
      },
    };
  });

  // Get financial summary by period
  app.get('/financial/summary', {
    onRequest: [authenticate],
  }, async (request) => {
    const querySchema = z.object({
      period: z.enum(['week', 'month', 'year']).default('month'),
      truckId: z.string().uuid().optional(),
    });

    const query = querySchema.parse(request.query);

    const now = new Date();
    let startDate: Date;

    switch (query.period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const where: any = {
      startDate: { gte: startDate },
    };

    if (query.truckId) {
      where.truckId = query.truckId;
    }

    const trips = await prisma.trip.findMany({
      where,
      include: {
        expenses: true,
      },
    });

    const totalRevenue = trips.reduce((sum, trip) => sum + trip.revenue, 0);
    const totalCost = trips.reduce((sum, trip) => sum + trip.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgProfitMargin = trips.length > 0
      ? trips.reduce((sum, trip) => sum + trip.profitMargin, 0) / trips.length
      : 0;

    return {
      summary: {
        period: query.period,
        startDate,
        endDate: now,
        totalTrips: trips.length,
        totalRevenue,
        totalCost,
        totalProfit,
        avgProfitMargin,
      },
    };
  });
}
