import axios from 'axios';
import { config } from '../config';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

class WebhookService {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = config.N8N_WEBHOOK_URL || '';
  }

  private async sendWebhook(payload: WebhookPayload): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('N8N Webhook URL not configured');
      return;
    }

    try {
      await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
      console.log(`Webhook sent: ${payload.event}`);
    } catch (error) {
      console.error('Error sending webhook:', error);
    }
  }

  // Notificação de nova viagem
  async notifyNewTrip(trip: any): Promise<void> {
    await this.sendWebhook({
      event: 'trip.created',
      timestamp: new Date().toISOString(),
      data: {
        tripId: trip.id,
        truck: trip.truck.plate,
        driver: trip.driver.name,
        driverPhone: trip.driver.phone,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.startDate,
        revenue: trip.revenue,
      },
    });
  }

  // Notificação de viagem agendada
  async notifyTripScheduled(trip: any): Promise<void> {
    await this.sendWebhook({
      event: 'trip.scheduled',
      timestamp: new Date().toISOString(),
      data: {
        tripId: trip.id,
        truck: trip.truck.plate,
        driver: trip.driver.name,
        driverPhone: trip.driver.phone,
        driverEmail: trip.driver.email,
        origin: trip.origin,
        destination: trip.destination,
        scheduledDate: trip.startDate,
        message: `Nova viagem agendada para ${trip.driver.name}`,
      },
    });
  }

  // Notificação de viagem concluída
  async notifyTripCompleted(trip: any): Promise<void> {
    await this.sendWebhook({
      event: 'trip.completed',
      timestamp: new Date().toISOString(),
      data: {
        tripId: trip.id,
        truck: trip.truck.plate,
        driver: trip.driver.name,
        origin: trip.origin,
        destination: trip.destination,
        revenue: trip.revenue,
        totalCost: trip.totalCost,
        profit: trip.profit,
        profitMargin: trip.profitMargin,
        distance: trip.distance,
      },
    });
  }

  // Notificação de despesa cadastrada
  async notifyExpenseCreated(expense: any): Promise<void> {
    await this.sendWebhook({
      event: 'expense.created',
      timestamp: new Date().toISOString(),
      data: {
        expenseId: expense.id,
        truck: expense.truck.plate,
        type: expense.type,
        amount: expense.amount,
        description: expense.description,
        supplier: expense.supplier,
        date: expense.date,
      },
    });
  }

  // Notificação de despesa alta
  async notifyHighExpense(expense: any, threshold: number): Promise<void> {
    await this.sendWebhook({
      event: 'expense.high_value',
      timestamp: new Date().toISOString(),
      data: {
        expenseId: expense.id,
        truck: expense.truck.plate,
        type: expense.type,
        amount: expense.amount,
        threshold,
        description: expense.description,
        alertLevel: 'warning',
      },
    });
  }

  // Notificação de lucro baixo
  async notifyLowProfit(trip: any, threshold: number): Promise<void> {
    await this.sendWebhook({
      event: 'trip.low_profit',
      timestamp: new Date().toISOString(),
      data: {
        tripId: trip.id,
        truck: trip.truck.plate,
        driver: trip.driver.name,
        revenue: trip.revenue,
        totalCost: trip.totalCost,
        profit: trip.profit,
        profitMargin: trip.profitMargin,
        threshold,
        alertLevel: 'warning',
      },
    });
  }

  // Notificação de manutenção agendada
  async notifyMaintenanceScheduled(maintenance: any): Promise<void> {
    await this.sendWebhook({
      event: 'maintenance.scheduled',
      timestamp: new Date().toISOString(),
      data: {
        maintenanceId: maintenance.id,
        truck: maintenance.truck.plate,
        type: maintenance.type,
        description: maintenance.description,
        scheduledDate: maintenance.scheduledDate,
        priority: maintenance.priority,
      },
    });
  }

  // Notificação de manutenção vencida
  async notifyMaintenanceOverdue(maintenance: any): Promise<void> {
    await this.sendWebhook({
      event: 'maintenance.overdue',
      timestamp: new Date().toISOString(),
      data: {
        maintenanceId: maintenance.id,
        truck: maintenance.truck.plate,
        type: maintenance.type,
        description: maintenance.description,
        scheduledDate: maintenance.scheduledDate,
        daysOverdue: Math.floor(
          (Date.now() - new Date(maintenance.scheduledDate).getTime()) / (1000 * 60 * 60 * 24)
        ),
        priority: maintenance.priority,
        alertLevel: 'critical',
      },
    });
  }

  // Notificação de manutenção concluída
  async notifyMaintenanceCompleted(maintenance: any): Promise<void> {
    await this.sendWebhook({
      event: 'maintenance.completed',
      timestamp: new Date().toISOString(),
      data: {
        maintenanceId: maintenance.id,
        truck: maintenance.truck.plate,
        type: maintenance.type,
        description: maintenance.description,
        cost: maintenance.cost,
        completedDate: maintenance.completedDate,
        supplier: maintenance.supplier,
      },
    });
  }

  // Relatório diário
  async sendDailyReport(data: any): Promise<void> {
    await this.sendWebhook({
      event: 'report.daily',
      timestamp: new Date().toISOString(),
      data: {
        date: new Date().toISOString().split('T')[0],
        summary: {
          totalTrips: data.totalTrips,
          totalRevenue: data.totalRevenue,
          totalCost: data.totalCost,
          totalProfit: data.totalProfit,
          avgProfitMargin: data.avgProfitMargin,
          activeTrips: data.activeTrips,
          totalExpenses: data.totalExpenses,
          pendingMaintenances: data.pendingMaintenances,
        },
        topTrucks: data.topTrucks,
      },
    });
  }

  // Relatório semanal
  async sendWeeklyReport(data: any): Promise<void> {
    await this.sendWebhook({
      event: 'report.weekly',
      timestamp: new Date().toISOString(),
      data: {
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        summary: data.summary,
        truckPerformance: data.truckPerformance,
        topExpenses: data.topExpenses,
        maintenancesSummary: data.maintenancesSummary,
      },
    });
  }
}

export const webhookService = new WebhookService();
