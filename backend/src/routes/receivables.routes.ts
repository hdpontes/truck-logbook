import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import axios from 'axios';
import { config } from '../config';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/receivables - Listar todos os recebimentos com filtros
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, clientId, startDate, endDate, recurringGroupId } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (recurringGroupId) {
      where.recurringGroupId = recurringGroupId;
    }

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) {
        where.dueDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.dueDate.lte = new Date(endDate as string);
      }
    }

    const receivables = await prisma.receivable.findMany({
      where,
      include: {
        client: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Atualizar status de atrasados automaticamente
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const receivable of receivables) {
      const dueDate = new Date(receivable.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (
        receivable.status === 'PENDING' &&
        dueDate < today
      ) {
        await prisma.receivable.update({
          where: { id: receivable.id },
          data: { status: 'OVERDUE' },
        });
        receivable.status = 'OVERDUE';
      }
    }

    res.json(receivables);
  } catch (error) {
    console.error('Error fetching receivables:', error);
    res.status(500).json({ message: 'Erro ao buscar recebimentos' });
  }
});

// GET /api/receivables/:id - Buscar recebimento por ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!receivable) {
      return res.status(404).json({ message: 'Recebimento não encontrado' });
    }

    res.json(receivable);
  } catch (error) {
    console.error('Error fetching receivable:', error);
    res.status(500).json({ message: 'Erro ao buscar recebimento' });
  }
});

// POST /api/receivables - Criar novo recebimento (com suporte a recorrência)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      clientId,
      type,
      description,
      amount,
      phoneNumber,
      dueDate,
      isRecurring,
      totalInstallments,
    } = req.body;

    // Validações
    if (!type || !description || !amount || !dueDate) {
      return res.status(400).json({
        message: 'Campos obrigatórios: type, description, amount, dueDate',
      });
    }

    if (isRecurring && (!totalInstallments || totalInstallments < 2)) {
      return res.status(400).json({
        message: 'Para pagamentos recorrentes, o número de parcelas deve ser maior que 1',
      });
    }

    // Se não for recorrente, criar apenas um recebimento
    if (!isRecurring) {
      const receivable = await prisma.receivable.create({
        data: {
          clientId: clientId || null,
          type,
          description,
          amount: parseFloat(amount),
          remainingAmount: parseFloat(amount),
          phoneNumber: phoneNumber || null,
          dueDate: new Date(dueDate),
          isRecurring: false,
          status: 'PENDING',
        },
        include: {
          client: true,
        },
      });

      return res.status(201).json(receivable);
    }

    // Se for recorrente, criar múltiplos recebimentos
    const recurringGroupId = `REC-${Date.now()}`;
    const receivables = [];
    const baseDueDate = new Date(dueDate);

    for (let i = 1; i <= totalInstallments; i++) {
      const installmentDueDate = new Date(baseDueDate);
      installmentDueDate.setMonth(installmentDueDate.getMonth() + (i - 1));

      const receivable = await prisma.receivable.create({
        data: {
          clientId: clientId || null,
          type,
          description: `${description} - Parcela ${i}/${totalInstallments}`,
          amount: parseFloat(amount),
          remainingAmount: parseFloat(amount),
          phoneNumber: phoneNumber || null,
          dueDate: installmentDueDate,
          isRecurring: true,
          installmentNumber: i,
          totalInstallments: totalInstallments,
          recurringGroupId,
          status: 'PENDING',
        },
        include: {
          client: true,
        },
      });

      receivables.push(receivable);
    }

    res.status(201).json(receivables);
  } catch (error) {
    console.error('Error creating receivable:', error);
    res.status(500).json({ message: 'Erro ao criar recebimento' });
  }
});

// PUT /api/receivables/:id - Atualizar recebimento
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      clientId,
      type,
      description,
      amount,
      phoneNumber,
      dueDate,
      status,
    } = req.body;

    const receivable = await prisma.receivable.findUnique({
      where: { id },
    });

    if (!receivable) {
      return res.status(404).json({ message: 'Recebimento não encontrado' });
    }

    const updatedReceivable = await prisma.receivable.update({
      where: { id },
      data: {
        clientId: clientId !== undefined ? clientId : receivable.clientId,
        type: type || receivable.type,
        description: description || receivable.description,
        amount: amount !== undefined ? parseFloat(amount) : receivable.amount,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : receivable.phoneNumber,
        dueDate: dueDate ? new Date(dueDate) : receivable.dueDate,
        status: status || receivable.status,
      },
      include: {
        client: true,
      },
    });

    res.json(updatedReceivable);
  } catch (error) {
    console.error('Error updating receivable:', error);
    res.status(500).json({ message: 'Erro ao atualizar recebimento' });
  }
});

// POST /api/receivables/:id/payment - Registrar pagamento
router.post('/:id/payment', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { paidAmount } = req.body;

    if (!paidAmount || paidAmount <= 0) {
      return res.status(400).json({
        message: 'O valor pago deve ser maior que zero',
      });
    }

    const receivable = await prisma.receivable.findUnique({
      where: { id },
    });

    if (!receivable) {
      return res.status(404).json({ message: 'Recebimento não encontrado' });
    }

    if (receivable.status === 'PAID') {
      return res.status(400).json({
        message: 'Este recebimento já foi pago completamente',
      });
    }

    const newPaidAmount = receivable.paidAmount + parseFloat(paidAmount);
    const newRemainingAmount = receivable.amount - newPaidAmount;

    let newStatus = receivable.status;
    let paymentDate = receivable.paymentDate;

    if (newRemainingAmount <= 0) {
      // Pagamento completo
      newStatus = 'PAID' as any;
      paymentDate = new Date();
    } else if (newPaidAmount > 0) {
      // Pagamento parcial
      newStatus = 'PARTIALLY_PAID' as any;
    }

    const updatedReceivable = await prisma.receivable.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(0, newRemainingAmount),
        status: newStatus,
        paymentDate: paymentDate,
      },
      include: {
        client: true,
      },
    });

    res.json(updatedReceivable);
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ message: 'Erro ao processar pagamento' });
  }
});

// DELETE /api/receivables/:id - Deletar recebimento
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const receivable = await prisma.receivable.findUnique({
      where: { id },
    });

    if (!receivable) {
      return res.status(404).json({ message: 'Recebimento não encontrado' });
    }

    await prisma.receivable.delete({
      where: { id },
    });

    res.json({ message: 'Recebimento deletado com sucesso' });
  } catch (error) {
    console.error('Error deleting receivable:', error);
    res.status(500).json({ message: 'Erro ao deletar recebimento' });
  }
});

// DELETE /api/receivables/group/:recurringGroupId - Deletar grupo de recorrência
router.delete('/group/:recurringGroupId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { recurringGroupId } = req.params;

    const result = await prisma.receivable.deleteMany({
      where: {
        recurringGroupId,
      },
    });

    res.json({
      message: 'Grupo de recebimentos deletado com sucesso',
      count: result.count,
    });
  } catch (error) {
    console.error('Error deleting receivable group:', error);
    res.status(500).json({ message: 'Erro ao deletar grupo de recebimentos' });
  }
});

// GET /api/receivables/notifications/pending - Buscar recebimentos que precisam de notificação
router.get('/notifications/pending', authenticate, async (req: AuthRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    res.json(receivables);
  } catch (error) {
    console.error('Error fetching pending notifications:', error);
    res.status(500).json({ message: 'Erro ao buscar notificações pendentes' });
  }
});

// POST /api/receivables/:id/send-notification - Enviar notificação via webhook
router.post('/:id/send-notification', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!receivable) {
      return res.status(404).json({ message: 'Recebimento não encontrado' });
    }

    // Webhook URL (deve ser configurada nas variáveis de ambiente)
    const webhookUrl = config.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(400).json({
        message: 'URL do webhook não configurada',
      });
    }

    // Preparar dados para envio
    const notificationData = {
      phoneNumber: receivable.phoneNumber || receivable.client?.phone,
      name: receivable.client?.name || 'Cliente',
      description: receivable.description,
      type: receivable.type,
      amount: receivable.remainingAmount,
      dueDate: receivable.dueDate.toISOString().split('T')[0],
      status: receivable.status,
    };

    // Enviar webhook
    try {
      await axios.post(webhookUrl, notificationData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      // Atualizar registro de notificação
      await prisma.receivable.update({
        where: { id },
        data: {
          notificationSent: true,
          lastNotificationDate: new Date(),
        },
      });

      res.json({
        message: 'Notificação enviada com sucesso',
        data: notificationData,
      });
    } catch (webhookError) {
      console.error('Error sending webhook:', webhookError);
      res.status(500).json({
        message: 'Erro ao enviar notificação via webhook',
        error: webhookError instanceof Error ? webhookError.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ message: 'Erro ao enviar notificação' });
  }
});

export default router;
