import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/dashboard/stats - Estatísticas gerais
router.get('/stats', async (req, res) => {
  try {
    const [
      totalTrucks,
      activeTrucks,
      totalDrivers,
      activeDrivers,
      totalTrips,
      activeTrips,
      completedTrips,
      totalExpenses,
    ] = await Promise.all([
      prisma.truck.count(),
      prisma.truck.count({ where: { active: true } }),
      prisma.user.count({ where: { role: 'DRIVER' } }),
      prisma.user.count({ where: { role: 'DRIVER', active: true } }),
      prisma.trip.count(),
      prisma.trip.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.trip.count({ where: { status: 'COMPLETED' } }),
      prisma.expense.count(),
    ]);

    // Métricas financeiras
    const financialMetrics = await prisma.trip.aggregate({
      where: { status: 'COMPLETED' },
      _sum: {
        revenue: true,
        totalCost: true,
        profit: true,
      },
    });

    res.json({
      trucks: {
        total: totalTrucks,
        active: activeTrucks,
      },
      drivers: {
        total: totalDrivers,
        active: activeDrivers,
      },
      trips: {
        total: totalTrips,
        active: activeTrips,
        completed: completedTrips,
      },
      expenses: {
        total: totalExpenses,
      },
      financial: {
        totalRevenue: financialMetrics._sum.revenue || 0,
        totalCost: financialMetrics._sum.totalCost || 0,
        totalProfit: financialMetrics._sum.profit || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dashboard/overview - Visão geral completa
router.get('/overview', async (req, res) => {
  try {
    const [stats, recentTrips, activeTrips, upcomingMaintenance, recentExpenses] = await Promise.all([
      // Stats
      (async () => {
        const [totalTrucks, trucksInMaintenance, activeTrips, completedTrips] = await Promise.all([
          prisma.truck.count({ where: { active: true } }),
          prisma.truck.count({ where: { status: 'MAINTENANCE' } }),
          prisma.trip.count({ where: { status: 'IN_PROGRESS' } }),
          prisma.trip.count({ where: { status: 'COMPLETED' } }),
        ]);

        const financialMetrics = await prisma.trip.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { revenue: true, totalCost: true, profit: true },
        });

        const allExpenses = await prisma.expense.aggregate({
          _sum: { amount: true },
        });

        const totalRevenue = financialMetrics._sum.revenue || 0;
        const totalCost = (allExpenses._sum.amount || 0);
        const totalProfit = totalRevenue - totalCost;

        return {
          totalTrucks,
          trucksInMaintenance,
          activeTrips,
          completedTrips,
          totalRevenue,
          totalCost,
          totalProfit,
        };
      })(),

      // Recent Trips
      prisma.trip.findMany({
        where: { status: 'COMPLETED' },
        include: {
          truck: { select: { plate: true, model: true } },
          driver: { select: { name: true } },
        },
        orderBy: { endDate: 'desc' },
        take: 5,
      }),

      // Active Trips
      prisma.trip.findMany({
        where: { status: 'IN_PROGRESS' },
        include: {
          truck: { select: { plate: true, model: true } },
          driver: { select: { name: true } },
        },
        orderBy: { startDate: 'desc' },
      }),

      // Upcoming Maintenance
      prisma.maintenance.findMany({
        where: {
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
        include: {
          truck: { select: { plate: true, model: true } },
        },
        orderBy: { scheduledDate: 'asc' },
        take: 5,
      }),

      // Recent Expenses
      prisma.expense.findMany({
        include: {
          truck: { select: { plate: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),
    ]);

    res.json({
      stats,
      recentTrips,
      activeTrips,
      upcomingMaintenance,
      recentExpenses,
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dashboard/recent-trips - Viagens recentes
router.get('/recent-trips', async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { status: 'COMPLETED' },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
        driver: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { endDate: 'desc' },
      take: 10,
    });

    res.json(trips);
  } catch (error) {
    console.error('Error fetching recent trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dashboard/active-trips - Viagens ativas
router.get('/active-trips', async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        truck: {
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
    console.error('Error fetching active trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dashboard/expenses-summary - Resumo de despesas
router.get('/expenses-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Total por tipo de despesa
    const expensesByType = await prisma.expense.groupBy({
      by: ['type'],
      where,
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Total geral
    const totalExpenses = await prisma.expense.aggregate({
      where,
      _sum: {
        amount: true,
      },
      _count: true,
    });

    res.json({
      byType: expensesByType,
      total: {
        amount: totalExpenses._sum.amount || 0,
        count: totalExpenses._count,
      },
    });
  } catch (error) {
    console.error('Error fetching expenses summary:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dashboard/truck-performance - Performance dos caminhões
router.get('/truck-performance', async (req, res) => {
  try {
    const trucks = await prisma.truck.findMany({
      where: { active: true },
      select: {
        id: true,
        plate: true,
        model: true,
        brand: true,
      },
    });

    const performance = await Promise.all(
      trucks.map(async (truck) => {
        const metrics = await prisma.trip.aggregate({
          where: {
            truckId: truck.id,
            status: 'COMPLETED',
          },
          _sum: {
            revenue: true,
            totalCost: true,
            profit: true,
            distance: true,
          },
          _count: true,
          _avg: {
            profitMargin: true,
          },
        });

        return {
          truck,
          trips: metrics._count,
          totalRevenue: metrics._sum.revenue || 0,
          totalCost: metrics._sum.totalCost || 0,
          totalProfit: metrics._sum.profit || 0,
          totalDistance: metrics._sum.distance || 0,
          avgProfitMargin: metrics._avg.profitMargin || 0,
        };
      })
    );

    res.json(performance);
  } catch (error) {
    console.error('Error fetching truck performance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
