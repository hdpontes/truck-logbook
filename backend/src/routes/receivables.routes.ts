import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import axios from 'axios';
import { config } from '../config';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const prisma = new PrismaClient();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/receipts');
    // Criar diretório se não existir
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens (JPEG, PNG) e PDFs são permitidos!'));
    }
  }
});

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
        payments: {
          orderBy: {
            paymentDate: 'desc',
          },
        },
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
        payments: {
          orderBy: {
            paymentDate: 'desc',
          },
        },
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
    if (!type || !amount || !dueDate) {
      return res.status(400).json({
        message: 'Campos obrigatórios: type, amount, dueDate',
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
          payments: true,
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
          description: description ? `${description} - Parcela ${i}/${totalInstallments}` : `Parcela ${i}/${totalInstallments}`,
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
          payments: true,
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
        payments: true,
      },
    });

    res.json(updatedReceivable);
  } catch (error) {
    console.error('Error updating receivable:', error);
    res.status(500).json({ message: 'Erro ao atualizar recebimento' });
  }
});

// POST /api/receivables/:id/payment - Registrar pagamento com upload de comprovante
router.post('/:id/payment', authenticate, upload.single('receipt'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { paidAmount, paymentMethod, notes } = req.body;

    if (!paidAmount || paidAmount <= 0) {
      return res.status(400).json({
        message: 'O valor pago deve ser maior que zero',
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        message: 'A forma de pagamento é obrigatória',
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

    const amount = parseFloat(paidAmount);
    const newPaidAmount = receivable.paidAmount + amount;
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

    // Criar registro de pagamento
    const payment = await prisma.receivablePayment.create({
      data: {
        receivableId: id,
        amount: amount,
        paymentMethod: paymentMethod,
        paymentDate: new Date(),
        receiptPath: req.file ? req.file.path : null,
        receiptFileName: req.file ? req.file.originalname : null,
        notes: notes || null,
      },
    });

    // Atualizar recebimento
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
        payments: {
          orderBy: {
            paymentDate: 'desc',
          },
        },
      },
    });

    res.json({
      receivable: updatedReceivable,
      payment: payment,
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ message: 'Erro ao processar pagamento' });
  }
});

// GET /api/receivables/:id/payments - Listar todos os pagamentos de um recebimento
router.get('/:id/payments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const payments = await prisma.receivablePayment.findMany({
      where: {
        receivableId: id,
      },
      orderBy: {
        paymentDate: 'desc',
      },
    });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Erro ao buscar pagamentos' });
  }
});

// GET /api/receivables/payments/:paymentId/receipt - Download do comprovante
router.get('/payments/:paymentId/receipt', authenticate, async (req: AuthRequest, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.receivablePayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return res.status(404).json({ message: 'Pagamento não encontrado' });
    }

    if (!payment.receiptPath) {
      return res.status(404).json({ message: 'Comprovante não encontrado' });
    }

    // Verificar se o arquivo existe
    if (!fs.existsSync(payment.receiptPath)) {
      return res.status(404).json({ message: 'Arquivo de comprovante não encontrado' });
    }

    // Enviar arquivo para download
    res.download(payment.receiptPath, payment.receiptFileName || 'comprovante');
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ message: 'Erro ao baixar comprovante' });
  }
});

// DELETE /api/receivables/:id - Deletar recebimento
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: {
        payments: true,
      },
    });

    if (!receivable) {
      return res.status(404).json({ message: 'Recebimento não encontrado' });
    }

    // Deletar arquivos de comprovantes
    for (const payment of receivable.payments) {
      if (payment.receiptPath && fs.existsSync(payment.receiptPath)) {
        fs.unlinkSync(payment.receiptPath);
      }
    }

    // Deletar recebimento (cascade delete para payments)
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

    // Buscar todos os recebimentos do grupo com seus pagamentos
    const receivables = await prisma.receivable.findMany({
      where: {
        recurringGroupId,
      },
      include: {
        payments: true,
      },
    });

    // Deletar arquivos de comprovantes
    for (const receivable of receivables) {
      for (const payment of receivable.payments) {
        if (payment.receiptPath && fs.existsSync(payment.receiptPath)) {
          fs.unlinkSync(payment.receiptPath);
        }
      }
    }

    // Deletar recebimentos (cascade delete para payments)
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
      type: 'receivable.notification',
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

// POST /api/receivables/test-job - Testar job de notificações manualmente (ADMIN ONLY)
router.post('/test-job', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { force } = req.body; // force=true ignora verificação de notificação anterior
    
    console.log('🔔 Executando job de notificações MANUALMENTE...');
    console.log(`Force mode: ${force ? 'SIM' : 'NÃO'}`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar recebimentos vencidos ou com vencimento hoje que precisam de notificação
    const where: any = {
      dueDate: {
        lte: today,
      },
      status: {
        in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'],
      },
    };

    // Se não for force mode, adicionar verificação de notificação
    if (!force) {
      where.OR = [
        { notificationSent: false },
        {
          lastNotificationDate: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Mais de 24h desde última notificação
          },
        },
      ];
    }

    const receivables = await prisma.receivable.findMany({
      where,
      include: {
        client: true,
      },
    });

    console.log(`📋 Encontrados ${receivables.length} recebimentos para notificar`);

    // Debug: Mostrar informações dos recebimentos encontrados
    if (receivables.length === 0) {
      // Buscar TODOS os recebimentos para debug
      const allReceivables = await prisma.receivable.findMany({
        where: {
          status: {
            in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'],
          },
        },
        select: {
          id: true,
          type: true,
          dueDate: true,
          status: true,
          notificationSent: true,
          lastNotificationDate: true,
        },
        take: 10,
      });

      console.log('📊 DEBUG - Mostrando até 10 recebimentos pendentes:');
      allReceivables.forEach(r => {
        const dueDate = new Date(r.dueDate);
        const isOverdue = dueDate < today;
        console.log(`  - ${r.type} | Vence: ${dueDate.toISOString().split('T')[0]} | Status: ${r.status} | Atrasado: ${isOverdue} | Notificado: ${r.notificationSent} | Última notif: ${r.lastNotificationDate?.toISOString() || 'Nunca'}`);
      });

      return res.json({
        message: 'Nenhum recebimento encontrado para notificar',
        receivablesFound: 0,
        successCount: 0,
        errorCount: 0,
        results: [],
        debug: {
          today: today.toISOString(),
          forceMode: force || false,
          totalPendingReceivables: allReceivables.length,
          sample: allReceivables,
        },
      });
    }

    const webhookUrl = config.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(400).json({
        message: 'URL do webhook não configurada',
        receivablesFound: receivables.length,
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const results = [];

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
        results.push({
          id: receivable.id,
          status: 'success',
          message: `Notificação enviada para ${notificationData.data.name}`,
        });
        console.log(`✅ Notificação enviada para ${notificationData.data.name} - ${receivable.description || receivable.type}`);
      } catch (error) {
        errorCount++;
        results.push({
          id: receivable.id,
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
        console.error(`❌ Erro ao enviar notificação para ${receivable.id}:`, error);
      }
    }

    console.log(`✅ Teste concluído: ${successCount} enviadas, ${errorCount} erros`);

    res.json({
      message: 'Teste do job executado',
      receivablesFound: receivables.length,
      successCount,
      errorCount,
      results,
    });
  } catch (error) {
    console.error('❌ Erro ao executar teste do job:', error);
    res.status(500).json({ 
      message: 'Erro ao executar teste do job',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
