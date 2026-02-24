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
  if (!config.N8N_WEBHOOK_URL) return;

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

// GET /api/expenses - Listar todas as despesas
router.get('/', async (req, res) => {
  try {
    const { truckId, tripId, clientId, type } = req.query;

    const expenses = await prisma.expense.findMany({
      where: {
        ...(truckId && { truckId: truckId as string }),
        ...(tripId && { tripId: tripId as string }),
        ...(clientId && { clientId: clientId as string }),
        ...(type && { type: type as any }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true },
        },
        trip: {
          select: { id: true, origin: true, destination: true, status: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/expenses/:id - Obter detalhes de uma despesa
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        truck: true,
        trip: true,
        client: {
          select: { id: true, name: true, cnpj: true, city: true, state: true },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/expenses - Criar nova despesa
router.post('/', async (req, res) => {
  try {
    const {
      truckId,
      tripId,
      clientId,
      type,
      category,
      amount,
      quantity,
      unitPrice,
      description,
      supplier,
      location,
      date,
    } = req.body;

    if (!type || !amount) {
      return res.status(400).json({ 
        message: 'Type and amount are required' 
      });
    }

    const expense = await prisma.expense.create({
      data: {
        truckId: truckId || null,
        tripId: tripId || null,
        clientId: clientId || null,
        type,
        category,
        amount: parseFloat(amount),
        quantity: quantity ? parseFloat(quantity) : null,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        description,
        supplier,
        location,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        truck: truckId ? {
          select: { id: true, plate: true, model: true },
        } : false,
        trip: tripId ? {
          select: { id: true, origin: true, destination: true, status: true, revenue: true },
        } : false,
        client: clientId ? {
          select: { id: true, name: true, cnpj: true },
        } : false,
      },
    });

    // Se a despesa foi adicionada a uma viagem concluída, recalcular os totais
    if (tripId && expense.trip?.status === 'COMPLETED') {
      const allExpenses = await prisma.expense.findMany({
        where: { tripId },
      });

      const fuelCost = allExpenses
        .filter((e) => e.type === 'FUEL')
        .reduce((sum, e) => sum + e.amount, 0);

      const tollCost = allExpenses
        .filter((e) => e.type === 'TOLL')
        .reduce((sum, e) => sum + e.amount, 0);

      const otherCosts = allExpenses
        .filter((e) => e.type !== 'FUEL' && e.type !== 'TOLL')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalCost = fuelCost + tollCost + otherCosts;
      const profit = (expense.trip.revenue || 0) - totalCost;
      const profitMargin = expense.trip.revenue > 0 ? (profit / expense.trip.revenue) * 100 : 0;

      await prisma.trip.update({
        where: { id: tripId },
        data: {
          fuelCost,
          tollCost,
          otherCosts,
          totalCost,
          profit,
          profitMargin,
        },
      });
    }

    // Enviar webhook de despesa criada
    await sendWebhook('expense.created', {
      expense: {
        id: expense.id,
        type: expense.type,
        amount: expense.amount,
        description: expense.description,
      },
      truck: expense.truck ? {
        plate: expense.truck.plate,
      } : null,
    });

    // Verificar se é uma despesa alta
    if (expense.amount >= config.EXPENSE_HIGH_THRESHOLD) {
      await sendWebhook('expense.high', {
        expense: {
          id: expense.id,
          type: expense.type,
          amount: expense.amount,
          description: expense.description,
        },
        truck: expense.truck ? {
          plate: expense.truck.plate,
        } : null,
        threshold: config.EXPENSE_HIGH_THRESHOLD,
      });
    }

    res.status(201).json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/expenses/:id - Atualizar uma despesa
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const {
      clientId,
      type,
      category,
      amount,
      quantity,
      unitPrice,
      description,
      supplier,
      location,
      date,
    } = req.body;

    // Buscar a despesa para validação
    const existingExpense = await prisma.expense.findUnique({
      where: { id },
      include: {
        trip: {
          select: { status: true },
        },
      },
    });

    if (!existingExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Motorista não pode editar despesa de viagem concluída
    if (user.role === 'DRIVER' && existingExpense.tripId && existingExpense.trip?.status === 'COMPLETED') {
      return res.status(403).json({ 
        message: 'Motoristas não podem editar despesas de viagens concluídas. Apenas gerentes e administradores podem fazer isso.' 
      });
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(clientId !== undefined && { clientId: clientId || null }),
        ...(type && { type }),
        ...(category !== undefined && { category }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(quantity !== undefined && { quantity: quantity ? parseFloat(quantity) : null }),
        ...(unitPrice !== undefined && { unitPrice: unitPrice ? parseFloat(unitPrice) : null }),
        ...(description !== undefined && { description }),
        ...(supplier !== undefined && { supplier }),
        ...(location !== undefined && { location }),
        ...(date && { date: new Date(date) }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true },
        },
        trip: {
          select: { id: true, origin: true, destination: true, status: true, revenue: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true },
        },
      },
    });

    // Se a despesa pertence a uma viagem concluída, recalcular os totais
    if (expense.tripId && expense.trip?.status === 'COMPLETED') {
      const allExpenses = await prisma.expense.findMany({
        where: { tripId: expense.tripId },
      });

      const fuelCost = allExpenses
        .filter((e) => e.type === 'FUEL')
        .reduce((sum, e) => sum + e.amount, 0);

      const tollCost = allExpenses
        .filter((e) => e.type === 'TOLL')
        .reduce((sum, e) => sum + e.amount, 0);

      const otherCosts = allExpenses
        .filter((e) => e.type !== 'FUEL' && e.type !== 'TOLL')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalCost = fuelCost + tollCost + otherCosts;
      const profit = (expense.trip.revenue || 0) - totalCost;
      const profitMargin = expense.trip.revenue > 0 ? (profit / expense.trip.revenue) * 100 : 0;

      await prisma.trip.update({
        where: { id: expense.tripId },
        data: {
          fuelCost,
          tollCost,
          otherCosts,
          totalCost,
          profit,
          profitMargin,
        },
      });
    }

    res.json(expense);
  } catch (error: any) {
    console.error('Error updating expense:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/expenses/:id - Deletar uma despesa
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Buscar a despesa antes de deletar para recalcular viagem se necessário e validar permissão
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        trip: {
          select: { id: true, status: true, revenue: true },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Motorista não pode deletar despesa de viagem concluída
    if (user.role === 'DRIVER' && expense.tripId && expense.trip?.status === 'COMPLETED') {
      return res.status(403).json({ 
        message: 'Motoristas não podem excluir despesas de viagens concluídas. Apenas gerentes e administradores podem fazer isso.' 
      });
    }

    await prisma.expense.delete({
      where: { id },
    });

    // Se a despesa pertencia a uma viagem concluída, recalcular os totais
    if (expense.tripId && expense.trip?.status === 'COMPLETED') {
      const allExpenses = await prisma.expense.findMany({
        where: { tripId: expense.tripId },
      });

      const fuelCost = allExpenses
        .filter((e) => e.type === 'FUEL')
        .reduce((sum, e) => sum + e.amount, 0);

      const tollCost = allExpenses
        .filter((e) => e.type === 'TOLL')
        .reduce((sum, e) => sum + e.amount, 0);

      const otherCosts = allExpenses
        .filter((e) => e.type !== 'FUEL' && e.type !== 'TOLL')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalCost = fuelCost + tollCost + otherCosts;
      const profit = (expense.trip.revenue || 0) - totalCost;
      const profitMargin = expense.trip.revenue > 0 ? (profit / expense.trip.revenue) * 100 : 0;

      await prisma.trip.update({
        where: { id: expense.tripId },
        data: {
          fuelCost,
          tollCost,
          otherCosts,
          totalCost,
          profit,
          profitMargin,
        },
      });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting expense:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
