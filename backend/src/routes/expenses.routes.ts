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
    const { truckId, tripId, type } = req.query;

    const expenses = await prisma.expense.findMany({
      where: {
        ...(truckId && { truckId: truckId as string }),
        ...(tripId && { tripId: tripId as string }),
        ...(type && { type: type as any }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true },
        },
        trip: {
          select: { id: true, origin: true, destination: true },
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

    if (!truckId || !type || !amount) {
      return res.status(400).json({ 
        message: 'TruckId, type and amount are required' 
      });
    }

    const expense = await prisma.expense.create({
      data: {
        truckId,
        tripId: tripId || null,
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
        truck: {
          select: { id: true, plate: true, model: true },
        },
        trip: {
          select: { id: true, origin: true, destination: true },
        },
      },
    });

    // Enviar webhook de despesa criada
    await sendWebhook('expense.created', {
      expense: {
        id: expense.id,
        type: expense.type,
        amount: expense.amount,
        description: expense.description,
      },
      truck: {
        plate: expense.truck.plate,
      },
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
        truck: {
          plate: expense.truck.plate,
        },
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
    const {
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

    const expense = await prisma.expense.update({
      where: { id },
      data: {
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
          select: { id: true, origin: true, destination: true },
        },
      },
    });

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

    await prisma.expense.delete({
      where: { id },
    });

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
