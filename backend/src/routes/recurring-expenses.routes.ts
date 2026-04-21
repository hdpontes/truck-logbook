import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { sendWebhook } from '../utils/webhook';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/recurring-expenses - Listar despesas recorrentes
router.get('/', async (req, res) => {
  try {
    const { status, truckId } = req.query;

    const recurringExpenses = await prisma.recurringExpense.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(truckId && { truckId: truckId as string }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
      },
      orderBy: { dueDay: 'asc' },
    });

    res.json(recurringExpenses);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recurring-expenses/:id - Obter detalhes de uma despesa recorrente
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const recurringExpense = await prisma.recurringExpense.findUnique({
      where: { id },
      include: {
        truck: true,
      },
    });

    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    res.json(recurringExpense);
  } catch (error) {
    console.error('Error fetching recurring expense:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/recurring-expenses - Criar despesa recorrente
router.post('/', async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Apenas ADMIN e MANAGER podem criar despesas recorrentes
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ 
        message: 'Apenas administradores e gerentes podem criar despesas recorrentes' 
      });
    }

    const {
      truckId,
      type,
      category,
      description,
      amount,
      dueDay,
      startDate,
      endDate,
      totalInstallments,
      supplier,
      notes,
    } = req.body;

    if (!type || !description || !amount || !dueDay || !startDate) {
      return res.status(400).json({
        message: 'Type, description, amount, dueDay and startDate are required',
      });
    }

    if (dueDay < 1 || dueDay > 31) {
      return res.status(400).json({
        message: 'DueDay must be between 1 and 31',
      });
    }

    // Se forneceu truckId, verificar se existe
    if (truckId) {
      const truck = await prisma.truck.findUnique({
        where: { id: truckId },
      });
      if (!truck) {
        return res.status(404).json({ message: 'Truck not found' });
      }
    }

    const recurringExpense = await prisma.recurringExpense.create({
      data: {
        truckId: truckId || null,
        type,
        category,
        description,
        amount: parseFloat(amount),
        dueDay: parseInt(dueDay),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        totalInstallments: totalInstallments ? parseInt(totalInstallments) : null,
        supplier,
        notes,
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
      },
    });

    // Enviar webhook de nova despesa recorrente criada
    await sendWebhook('recurring_expense.created', {
      recurringExpense: {
        id: recurringExpense.id,
        description: recurringExpense.description,
        amount: recurringExpense.amount,
        dueDay: recurringExpense.dueDay,
        type: recurringExpense.type,
      },
      truck: recurringExpense.truck ? {
        plate: recurringExpense.truck.plate,
        model: recurringExpense.truck.model,
      } : null,
    });

    res.status(201).json(recurringExpense);
  } catch (error) {
    console.error('Error creating recurring expense:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/recurring-expenses/:id - Atualizar despesa recorrente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Apenas ADMIN e MANAGER podem atualizar
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({
        message: 'Apenas administradores e gerentes podem atualizar despesas recorrentes',
      });
    }

    const {
      truckId,
      type,
      category,
      description,
      amount,
      dueDay,
      endDate,
      status,
      totalInstallments,
      supplier,
      notes,
    } = req.body;

    const recurringExpense = await prisma.recurringExpense.findUnique({
      where: { id },
    });

    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    if (dueDay !== undefined && (dueDay < 1 || dueDay > 31)) {
      return res.status(400).json({
        message: 'DueDay must be between 1 and 31',
      });
    }

    const updated = await prisma.recurringExpense.update({
      where: { id },
      data: {
        ...(truckId !== undefined && { truckId: truckId || null }),
        ...(type && { type }),
        ...(category !== undefined && { category }),
        ...(description && { description }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(dueDay !== undefined && { dueDay: parseInt(dueDay) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(status && { status }),
        ...(totalInstallments !== undefined && { totalInstallments: totalInstallments ? parseInt(totalInstallments) : null }),
        ...(supplier !== undefined && { supplier }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating recurring expense:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/recurring-expenses/:id - Deletar despesa recorrente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Apenas ADMIN e MANAGER podem deletar
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({
        message: 'Apenas administradores e gerentes podem deletar despesas recorrentes',
      });
    }

    const recurringExpense = await prisma.recurringExpense.findUnique({
      where: { id },
    });

    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    await prisma.recurringExpense.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting recurring expense:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/recurring-expenses/:id/pay - Marcar parcela como paga
router.post('/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate, receipt, notes } = req.body;

    const recurringExpense = await prisma.recurringExpense.findUnique({
      where: { id },
      include: { truck: true },
    });

    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    // Calcular a data da despesa (dia de vencimento do mês atual ou informado)
    const now = new Date(paymentDate || new Date());
    const expenseDate = new Date(now.getFullYear(), now.getMonth(), recurringExpense.dueDay);

    // Criar uma despesa real a partir da recorrente
    const expense = await prisma.expense.create({
      data: {
        truckId: recurringExpense.truckId,
        recurringExpenseId: recurringExpense.id,
        type: recurringExpense.type,
        category: recurringExpense.category,
        description: `${recurringExpense.description} - Parcela ${recurringExpense.paidInstallments + 1}${recurringExpense.totalInstallments ? `/${recurringExpense.totalInstallments}` : ''}`,
        amount: recurringExpense.amount,
        supplier: recurringExpense.supplier,
        date: expenseDate,
        isPaid: true,
        receipt,
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
      },
    });

    // Atualizar contador de parcelas pagas e última data gerada
    const updatedRecurring = await prisma.recurringExpense.update({
      where: { id },
      data: {
        paidInstallments: recurringExpense.paidInstallments + 1,
        lastGeneratedDate: expenseDate,
        // Se atingiu o total de parcelas, marcar como completa
        ...(recurringExpense.totalInstallments && 
            recurringExpense.paidInstallments + 1 >= recurringExpense.totalInstallments && 
            { status: 'COMPLETED' }),
      },
    });

    res.json({ expense, recurringExpense: updatedRecurring });
  } catch (error) {
    console.error('Error paying recurring expense:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recurring-expenses/calendar/:year/:month - Obter despesas para um mês específico
router.get('/calendar/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Invalid year or month' });
    }

    // Buscar despesas recorrentes ativas
    const recurringExpenses = await prisma.recurringExpense.findMany({
      where: {
        status: 'ACTIVE',
        startDate: {
          lte: new Date(yearNum, monthNum, 0), // Fim do mês
        },
        OR: [
          { endDate: null }, // Sem data de término
          { endDate: { gte: new Date(yearNum, monthNum - 1, 1) } }, // Término após início do mês
        ],
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
      },
    });

    // Verificar quais já foram pagas no mês especificado
    const firstDayOfMonth = new Date(yearNum, monthNum - 1, 1);
    const lastDayOfMonth = new Date(yearNum, monthNum, 0);

    const paidExpenses = await prisma.expense.findMany({
      where: {
        recurringExpenseId: {
          in: recurringExpenses.map(re => re.id),
        },
        date: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
        isPaid: true,
      },
    });

    const paidRecurringIds = new Set(paidExpenses.map(e => e.recurringExpenseId));

    // Mapear despesas recorrentes para o formato do calendário
    const calendarExpenses = recurringExpenses.map(re => ({
      ...re,
      isPaidThisMonth: paidRecurringIds.has(re.id),
    }));

    res.json(calendarExpenses);
  } catch (error) {
    console.error('Error fetching calendar expenses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
