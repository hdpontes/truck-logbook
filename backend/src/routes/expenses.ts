import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { webhookService } from '../services/webhook';
import { config } from '../config';

export async function expensesRoutes(app: FastifyInstance) {
  // List all expenses
  app.get('/', {
    onRequest: [authenticate],
  }, async (request) => {
    const querySchema = z.object({
      truckId: z.string().uuid().optional(),
      tripId: z.string().uuid().optional(),
      type: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    });

    const query = querySchema.parse(request.query);

    const where: any = {};

    if (query.truckId) where.truckId = query.truckId;
    if (query.tripId) where.tripId = query.tripId;
    if (query.type) where.type = query.type;

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(query.startDate);
      if (query.endDate) where.date.lte = new Date(query.endDate);
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        truck: true,
        trip: {
          select: {
            id: true,
            origin: true,
            destination: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return { expenses };
  });

  // Get expense by ID
  app.get('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        truck: true,
        trip: true,
      },
    });

    if (!expense) {
      throw new Error('Expense not found');
    }

    return { expense };
  });

  // Create expense
  app.post('/', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const createExpenseSchema = z.object({
      truckId: z.string().uuid(),
      tripId: z.string().uuid().optional(),
      type: z.enum(['FUEL', 'TOLL', 'MAINTENANCE', 'TIRE', 'FOOD', 'PARKING', 'INSURANCE', 'TAX', 'SALARY', 'OTHER']),
      category: z.string().optional(),
      amount: z.number(),
      quantity: z.number().optional(),
      unitPrice: z.number().optional(),
      description: z.string().optional(),
      receipt: z.string().optional(),
      invoiceNum: z.string().optional(),
      supplier: z.string().optional(),
      location: z.string().optional(),
      date: z.string().transform(val => new Date(val)),
    });

    const data = createExpenseSchema.parse(request.body);
    const user = request.user as any;

    // DRIVER só pode adicionar FUEL
    if (user.role === 'DRIVER' && data.type !== 'FUEL') {
      return reply.code(403).send({ 
        error: 'Motoristas só podem adicionar despesas de combustível' 
      });
    }

    const expense = await prisma.expense.create({
      data,
      include: {
        truck: true,
        trip: true,
      },
    });

    // Enviar notificação via webhook
    await webhookService.notifyExpenseCreated(expense);

    // Verificar se é uma despesa alta
    if (expense.amount > config.EXPENSE_HIGH_THRESHOLD) {
      await webhookService.notifyHighExpense(expense, config.EXPENSE_HIGH_THRESHOLD);
    }

    // Atualizar cálculos da viagem se houver
    if (data.tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: data.tripId },
        include: { expenses: true },
      });

      if (trip) {
        const totalCost = trip.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const profit = trip.revenue - totalCost;
        const profitMargin = trip.revenue > 0 ? (profit / trip.revenue) * 100 : 0;

        await prisma.trip.update({
          where: { id: data.tripId },
          data: {
            totalCost,
            profit,
            profitMargin,
          },
        });
      }
    }

    return reply.status(201).send({ expense });
  });

  // Update expense
  app.put('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const updateExpenseSchema = z.object({
      type: z.enum(['FUEL', 'TOLL', 'MAINTENANCE', 'TIRE', 'FOOD', 'PARKING', 'INSURANCE', 'TAX', 'SALARY', 'OTHER']).optional(),
      category: z.string().optional(),
      amount: z.number().optional(),
      quantity: z.number().optional(),
      unitPrice: z.number().optional(),
      description: z.string().optional(),
      receipt: z.string().optional(),
      invoiceNum: z.string().optional(),
      supplier: z.string().optional(),
      location: z.string().optional(),
      date: z.string().transform(val => new Date(val)).optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const data = updateExpenseSchema.parse(request.body);

    const currentExpense = await prisma.expense.findUnique({ where: { id } });

    const expense = await prisma.expense.update({
      where: { id },
      data,
      include: {
        truck: true,
        trip: true,
      },
    });

    // Atualizar cálculos da viagem se houver
    if (currentExpense?.tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: currentExpense.tripId },
        include: { expenses: true },
      });

      if (trip) {
        const totalCost = trip.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const profit = trip.revenue - totalCost;
        const profitMargin = trip.revenue > 0 ? (profit / trip.revenue) * 100 : 0;

        await prisma.trip.update({
          where: { id: currentExpense.tripId },
          data: {
            totalCost,
            profit,
            profitMargin,
          },
        });
      }
    }

    return { expense };
  });

  // Delete expense
  app.delete('/:id', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    const expense = await prisma.expense.findUnique({ where: { id } });

    await prisma.expense.delete({
      where: { id },
    });

    // Atualizar cálculos da viagem se houver
    if (expense?.tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: expense.tripId },
        include: { expenses: true },
      });

      if (trip) {
        const totalCost = trip.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const profit = trip.revenue - totalCost;
        const profitMargin = trip.revenue > 0 ? (profit / trip.revenue) * 100 : 0;

        await prisma.trip.update({
          where: { id: expense.tripId },
          data: {
            totalCost,
            profit,
            profitMargin,
          },
        });
      }
    }

    return reply.status(204).send();
  });

  // Get expenses summary
  app.get('/summary/total', {
    onRequest: [authenticate],
  }, async (request) => {
    const querySchema = z.object({
      truckId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    });

    const query = querySchema.parse(request.query);

    const where: any = {};

    if (query.truckId) where.truckId = query.truckId;

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(query.startDate);
      if (query.endDate) where.date.lte = new Date(query.endDate);
    }

    const [totalExpenses, byType] = await Promise.all([
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      summary: {
        total: totalExpenses._sum.amount || 0,
        count: totalExpenses._count,
        byType,
      },
    };
  });
}
