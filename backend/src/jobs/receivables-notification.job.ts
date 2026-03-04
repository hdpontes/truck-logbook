import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { config } from '../config';

const prisma = new PrismaClient();

/**
 * Job que roda diariamente para enviar notificações de recebimentos vencidos
 * Executa todos os dias às 9h da manhã
 */
export function startReceivablesNotificationJob() {
  // Executar todos os dias às 9:00
  cron.schedule('0 9 * * *', async () => {
    console.log('🔔 Executando job de notificações de recebimentos...');
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar recebimentos vencidos ou com vencimento hoje que precisam de notificação
      const receivables = await prisma.receivable.findMany({
        where: {
          dueDate: {
            lte: today,
          },
          status: {
            in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'],
          },
          OR: [
            { notificationSent: false },
            {
              lastNotificationDate: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Mais de 24h desde última notificação
              },
            },
          ],
        },
        include: {
          client: true,
        },
      });

      console.log(`📋 Encontrados ${receivables.length} recebimentos para notificar`);

      const webhookUrl = config.N8N_WEBHOOK_URL;

      if (!webhookUrl) {
        console.warn('⚠️ URL do webhook não configurada. Notificações não serão enviadas.');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const receivable of receivables) {
        try {
          // Preparar dados para envio no formato estruturado
          const notificationData = {
            type: 'receivable.due',
            timestamp: new Date().toISOString(),
            data: {
              phoneNumber: receivable.phoneNumber || receivable.client?.phone,
              name: receivable.client?.name || 'Cliente',
              description: receivable.description || receivable.type,
              receivableType: receivable.type,
              amount: receivable.remainingAmount,
              totalAmount: receivable.amount,
              paidAmount: receivable.paidAmount,
              dueDate: receivable.dueDate.toISOString().split('T')[0],
              status: receivable.status,
              isRecurring: receivable.isRecurring,
              installmentNumber: receivable.installmentNumber,
              totalInstallments: receivable.totalInstallments,
            },
          };

          // Enviar webhook
          await axios.post(webhookUrl, notificationData, {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });

          // Atualizar registro de notificação
          await prisma.receivable.update({
            where: { id: receivable.id },
            data: {
              notificationSent: true,
              lastNotificationDate: new Date(),
            },
          });

          successCount++;
          console.log(`✅ Notificação enviada para ${notificationData.data.name} - ${receivable.description || receivable.type}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Erro ao enviar notificação para ${receivable.id}:`, error);
        }
      }

      console.log(`✅ Job concluído: ${successCount} enviadas, ${errorCount} erros`);
    } catch (error) {
      console.error('❌ Erro ao executar job de notificações de recebimentos:', error);
    }
  });

  console.log('✅ Job de notificações de recebimentos agendado (diariamente às 9h)');
}
