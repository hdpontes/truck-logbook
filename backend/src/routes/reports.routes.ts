import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import axios from 'axios';
import { config } from '../config';

const router = express.Router();
const prisma = new PrismaClient();

// Interface para o item de relatório
interface ReportItem {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  description: string;
  tripCode?: string;
  category: string;
  amount: number;
  truck?: {
    plate: string;
  };
  driver?: {
    name: string;
  };
}

// GET /api/reports/financial - Obter dados financeiros com filtros
router.get('/financial', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      startDate,
      endDate,
      type, // 'INCOME', 'EXPENSE', ou vazio para todos
      tripCode,
    } = req.query;

    // Validar permissões (apenas ADMIN e MANAGER)
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Construir filtros de data
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      const endDateObj = new Date(endDate as string);
      endDateObj.setHours(23, 59, 59, 999);
      dateFilter.lte = endDateObj;
    }

    const reportItems: ReportItem[] = [];

    // Buscar viagens (INCOME)
    if (!type || type === 'INCOME') {
      const tripsFilter: any = {
        status: 'COMPLETED', // Apenas viagens completas contam como receita
      };

      if (Object.keys(dateFilter).length > 0) {
        tripsFilter.endDate = dateFilter;
      }

      if (tripCode) {
        tripsFilter.tripCode = {
          contains: tripCode as string,
          mode: 'insensitive',
        };
      }

      const trips = await prisma.trip.findMany({
        where: tripsFilter,
        include: {
          truck: {
            select: { plate: true },
          },
          driver: {
            select: { name: true },
          },
        },
        orderBy: { endDate: 'desc' },
      });

      trips.forEach((trip) => {
        reportItems.push({
          id: trip.id,
          type: 'INCOME',
          date: trip.endDate!.toISOString(),
          description: `Viagem: ${trip.origin} → ${trip.destination}`,
          tripCode: trip.tripCode || undefined,
          category: 'Receita de Viagem',
          amount: trip.revenue,
          truck: trip.truck,
          driver: trip.driver,
        });
      });
    }

    // Buscar despesas (EXPENSE)
    if (!type || type === 'EXPENSE') {
      const expensesFilter: any = {};

      if (Object.keys(dateFilter).length > 0) {
        expensesFilter.date = dateFilter;
      }

      // Se filtrado por tripCode, buscar apenas despesas desta viagem
      if (tripCode) {
        const tripsWithCode = await prisma.trip.findMany({
          where: {
            tripCode: {
              contains: tripCode as string,
              mode: 'insensitive',
            },
          },
          select: { id: true },
        });

        expensesFilter.tripId = {
          in: tripsWithCode.map((t) => t.id),
        };
      }

      const expenses = await prisma.expense.findMany({
        where: expensesFilter,
        include: {
          trip: {
            include: {
              truck: {
                select: { plate: true },
              },
              driver: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const expenseLabels: Record<string, string> = {
        FUEL: 'Combustível',
        TOLL: 'Pedágio',
        MAINTENANCE: 'Manutenção',
        FOOD: 'Alimentação',
        ACCOMMODATION: 'Hospedagem',
        REPAIR: 'Reparo',
        TIRE: 'Pneu',
        INSURANCE: 'Seguro',
        TAX: 'Imposto',
        OTHER: 'Outros',
      };

      expenses.forEach((expense) => {
        reportItems.push({
          id: expense.id,
          type: 'EXPENSE',
          date: expense.date.toISOString(),
          description: expense.description || expenseLabels[expense.type] || expense.type,
          tripCode: expense.trip?.tripCode || undefined,
          category: expenseLabels[expense.type] || expense.type,
          amount: expense.amount,
          truck: expense.trip?.truck,
          driver: expense.trip?.driver,
        });
      });
    }

    // Ordenar todos os itens por data (mais recente primeiro)
    reportItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calcular totais
    const totalIncome = reportItems
      .filter((item) => item.type === 'INCOME')
      .reduce((sum, item) => sum + item.amount, 0);

    const totalExpense = reportItems
      .filter((item) => item.type === 'EXPENSE')
      .reduce((sum, item) => sum + item.amount, 0);

    const profit = totalIncome - totalExpense;

    res.json({
      items: reportItems,
      summary: {
        totalIncome,
        totalExpense,
        profit,
        itemCount: reportItems.length,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar relatório financeiro:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório' });
  }
});

// POST /api/reports/send-webhook - Enviar screenshot do relatório via webhook
router.post('/send-webhook', authenticate, async (req: AuthRequest, res) => {
  try {
    const { imageData, filters } = req.body;

    // Validar permissões
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (!imageData) {
      return res.status(400).json({ message: 'Imagem não fornecida' });
    }

    // Preparar dados para webhook
    const webhookData = {
      type: 'financial_report',
      sentBy: {
        id: req.user?.userId,
        email: req.user?.email,
      },
      filters: filters || {},
      timestamp: new Date().toISOString(),
      imageData, // Base64 da imagem
    };

    // Enviar para webhook do N8N
    if (config.N8N_WEBHOOK_URL) {
      try {
        await axios.post(config.N8N_WEBHOOK_URL, webhookData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        console.log('Relatório enviado para webhook com sucesso');
      } catch (webhookError: any) {
        console.error('Erro ao enviar webhook:', webhookError.message);
        return res.status(500).json({ message: 'Erro ao enviar para webhook' });
      }
    } else {
      console.warn('Webhook URL não configurada');
      return res.status(400).json({ message: 'Webhook não configurado' });
    }

    res.json({ message: 'Relatório enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar relatório:', error);
    res.status(500).json({ message: 'Erro ao enviar relatório' });
  }
});

// GET /api/reports/monthly/:year/:month - Obter relatório mensal específico
router.get('/monthly/:year/:month', authenticate, async (req: AuthRequest, res) => {
  try {
    const { year, month } = req.params;

    // Validar permissões
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Construir datas do mês
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

    // Buscar dados do mês
    const trips = await prisma.trip.findMany({
      where: {
        status: 'COMPLETED',
        endDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        truck: { select: { plate: true } },
        driver: { select: { name: true } },
      },
    });

    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalIncome = trips.reduce((sum, trip) => sum + trip.revenue, 0);
    const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const profit = totalIncome - totalExpense;

    res.json({
      period: {
        year: parseInt(year),
        month: parseInt(month),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalIncome,
        totalExpense,
        profit,
        tripsCount: trips.length,
        expensesCount: expenses.length,
      },
      trips,
      expenses,
    });
  } catch (error) {
    console.error('Erro ao buscar relatório mensal:', error);
    res.status(500).json({ message: 'Erro ao buscar relatório mensal' });
  }
});

export default router;
