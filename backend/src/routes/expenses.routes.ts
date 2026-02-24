import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import axios from 'axios';
import { convertToCSV, parseCSV } from '../utils/csv';

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

// GET /api/expenses/export/csv - Exportar todas as despesas para CSV
router.get('/export/csv', async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        truck: {
          select: { plate: true },
        },
        trip: {
          select: { origin: true, destination: true },
        },
        client: {
          select: { name: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const csvData = expenses.map(expense => ({
      truckPlate: expense.truck?.plate || '',
      tripOrigin: expense.trip?.origin || '',
      tripDestination: expense.trip?.destination || '',
      clientName: expense.client?.name || '',
      type: expense.type,
      category: expense.category || '',
      amount: expense.amount,
      quantity: expense.quantity || '',
      unitPrice: expense.unitPrice || '',
      description: expense.description || '',
      supplier: expense.supplier || '',
      location: expense.location || '',
      date: expense.date.toISOString(),
    }));

    const csv = convertToCSV(csvData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=despesas.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting expenses CSV:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/expenses/import/csv - Importar despesas do CSV
router.post('/import/csv', async (req, res) => {
  try {
    const { csvData } = req.body;

    if (!csvData) {
      return res.status(400).json({ message: 'CSV data is required' });
    }

    const expenses = parseCSV(csvData);

    if (!expenses || expenses.length === 0) {
      return res.status(400).json({ message: 'No valid data in CSV' });
    }

    const results = {
      success: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    for (let i = 0; i < expenses.length; i++) {
      try {
        const expenseData = expenses[i];
        let { truckPlate, type, amount, quantity, unitPrice, description, supplier, location, date, category } = expenseData;

        // Converter truckPlate para string se fornecido
        truckPlate = truckPlate ? String(truckPlate) : null;

        if (!type || !amount) {
          results.errors.push({
            row: i + 1,
            error: 'Type and amount are required',
          });
          continue;
        }

        // Buscar truck se placa foi fornecida
        let truckId = null;
        if (truckPlate) {
          const truck = await prisma.truck.findUnique({
            where: { plate: truckPlate },
          });
          truckId = truck?.id || null;
        }

        // Criar nova despesa (não faz upsert, sempre cria nova)
        await prisma.expense.create({
          data: {
            truckId,
            tripId: null, // Não vincula a trip no import
            clientId: null, // Não vincula a client no import
            type,
            category: category || null,
            amount: parseFloat(amount),
            quantity: quantity ? parseFloat(quantity) : null,
            unitPrice: unitPrice ? parseFloat(unitPrice) : null,
            description: description || null,
            supplier: supplier || null,
            location: location || null,
            date: date ? new Date(date) : new Date(),
          },
        });

        results.success++;
      } catch (error: any) {
        results.errors.push({
          row: i + 1,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error importing expenses CSV:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
