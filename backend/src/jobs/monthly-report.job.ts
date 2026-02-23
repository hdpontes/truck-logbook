import cron from 'node-cron';
import axios from 'axios';
import { config } from '../config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Cron job que roda todo dia 1 de cada mês às 08:00
 * Envia relatório do mês anterior via webhook para n8n → WhatsApp
 */
export function startMonthlyCronJob() {
  // Executa no dia 1 de cada mês às 08:00 (horário de Brasília)
  // Formato: segundo minuto hora dia mês dia-da-semana
  cron.schedule('0 8 1 * *', async () => {
    console.log('🗓️  Executando relatório mensal automático...');
    
    try {
      // Calcular mês anterior
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = lastMonth.getFullYear();
      const month = lastMonth.getMonth() + 1; // getMonth() retorna 0-11

      // Construir datas do mês anterior
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      console.log(`📊 Gerando relatório de ${month}/${year}...`);

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

      // Preparar dados para webhook
      const webhookData = {
        type: 'monthly_report',
        period: {
          year,
          month,
          monthName: lastMonth.toLocaleDateString('pt-BR', { month: 'long' }),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary: {
          totalIncome,
          totalExpense,
          profit,
          profitMargin: totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(2) : '0',
          tripsCount: trips.length,
          expensesCount: expenses.length,
        },
        trips: trips.map(trip => ({
          tripCode: trip.tripCode,
          origin: trip.origin,
          destination: trip.destination,
          revenue: trip.revenue,
          truck: trip.truck.plate,
          driver: trip.driver.name,
          endDate: trip.endDate,
        })),
        topExpenses: expenses
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10)
          .map(exp => ({
            type: exp.type,
            description: exp.description,
            amount: exp.amount,
            date: exp.date,
          })),
        timestamp: new Date().toISOString(),
      };

      // Enviar para webhook do N8N
      if (config.N8N_WEBHOOK_URL) {
        await axios.post(config.N8N_WEBHOOK_URL, webhookData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        console.log('✅ Relatório mensal enviado para webhook com sucesso!');
        console.log(`📈 Resumo: Receita ${totalIncome.toFixed(2)} | Despesas ${totalExpense.toFixed(2)} | Lucro ${profit.toFixed(2)}`);
      } else {
        console.warn('⚠️  Webhook URL não configurada - relatório não enviado');
      }
    } catch (error: any) {
      console.error('❌ Erro ao gerar e enviar relatório mensal:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo',
  });

  console.log('✅ Cron job de relatório mensal ativado (executa dia 1 às 08:00)');
}

/**
 * Função auxiliar para testar o envio manual do relatório mensal
 * Útil para desenvolvimento e testes
 */
export async function sendMonthlyReportManually(year: number, month: number) {
  console.log(`📊 Enviando relatório manual de ${month}/${year}...`);
  
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

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

    const webhookData = {
      type: 'monthly_report',
      period: {
        year,
        month,
        monthName: startDate.toLocaleDateString('pt-BR', { month: 'long' }),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalIncome,
        totalExpense,
        profit,
        profitMargin: totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(2) : '0',
        tripsCount: trips.length,
        expensesCount: expenses.length,
      },
      trips: trips.map(trip => ({
        tripCode: trip.tripCode,
        origin: trip.origin,
        destination: trip.destination,
        revenue: trip.revenue,
        truck: trip.truck.plate,
        driver: trip.driver.name,
        endDate: trip.endDate,
      })),
      timestamp: new Date().toISOString(),
    };

    if (config.N8N_WEBHOOK_URL) {
      await axios.post(config.N8N_WEBHOOK_URL, webhookData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ Relatório mensal enviado com sucesso!');
      return { success: true, data: webhookData };
    } else {
      console.warn('⚠️  Webhook URL não configurada');
      return { success: false, message: 'Webhook não configurado' };
    }
  } catch (error: any) {
    console.error('❌ Erro ao enviar relatório:', error.message);
    throw error;
  }
}
