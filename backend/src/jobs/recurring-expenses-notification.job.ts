import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendWebhook } from '../utils/webhook';

// Job que roda diariamente às 08:00 para verificar despesas que vencem hoje
export const startRecurringExpensesNotificationJob = () => {
  // Executar todos os dias às 08:00
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('[RecurringExpenses Job] Checking due expenses for today...');
      
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // Buscar despesas recorrentes ativas que vencem hoje
      const dueExpenses = await prisma.recurringExpense.findMany({
        where: {
          status: 'ACTIVE',
          dueDay: currentDay,
          startDate: {
            lte: today,
          },
          OR: [
            { endDate: null }, // Sem data de término
            { endDate: { gte: today } }, // Ou não terminou ainda
          ],
        },
        include: {
          truck: {
            select: { id: true, plate: true, model: true, brand: true },
          },
        },
      });

      if (dueExpenses.length === 0) {
        console.log('[RecurringExpenses Job] No due expenses for today');
        return;
      }

      // Verificar quais ainda não foram pagas este mês
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

      const alreadyPaid = await prisma.expense.findMany({
        where: {
          recurringExpenseId: {
            in: dueExpenses.map(e => e.id),
          },
          date: {
            gte: firstDayOfMonth,
            lte: lastDayOfMonth,
          },
          isPaid: true,
        },
        select: {
          recurringExpenseId: true,
        },
      });

      const paidIds = new Set(alreadyPaid.map(e => e.recurringExpenseId));
      const pendingExpenses = dueExpenses.filter(e => !paidIds.has(e.id));

      if (pendingExpenses.length === 0) {
        console.log('[RecurringExpenses Job] All expenses for today are already paid');
        return;
      }

      // Calcular total de despesas pendentes
      const totalAmount = pendingExpenses.reduce((sum, e) => sum + e.amount, 0);

      // Agrupar por caminhão e outras despesas
      const expensesByTruck: { [key: string]: typeof pendingExpenses } = {};
      const otherExpenses: typeof pendingExpenses = [];

      pendingExpenses.forEach(expense => {
        if (expense.truckId) {
          if (!expensesByTruck[expense.truckId]) {
            expensesByTruck[expense.truckId] = [];
          }
          expensesByTruck[expense.truckId].push(expense);
        } else {
          otherExpenses.push(expense);
        }
      });

      // Preparar lista de despesas para o webhook
      const expensesList = pendingExpenses.map(e => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        type: e.type,
        truck: e.truck ? {
          plate: e.truck.plate,
          model: e.truck.model,
          brand: e.truck.brand,
        } : null,
        installment: e.totalInstallments ? `${e.paidInstallments + 1}/${e.totalInstallments}` : null,
      }));

      // Enviar webhook com todas as despesas do dia
      await sendWebhook('recurring_expenses.due', {
        date: today.toISOString(),
        dueDay: currentDay,
        totalExpenses: pendingExpenses.length,
        totalAmount,
        expenses: expensesList,
        summary: {
          byTruck: Object.keys(expensesByTruck).length,
          other: otherExpenses.length,
        },
      });

      console.log(`[RecurringExpenses Job] Sent notification for ${pendingExpenses.length} due expenses (Total: R$ ${totalAmount.toFixed(2)})`);

    } catch (error) {
      console.error('[RecurringExpenses Job] Error checking due expenses:', error);
    }
  });

  console.log('✅ Recurring Expenses Notification Job started (runs daily at 08:00)');
};
