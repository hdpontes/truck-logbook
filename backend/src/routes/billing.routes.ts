import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import axios from 'axios';
import { config } from '../config';

const router = express.Router();
const prisma = new PrismaClient();

// Interface para o item de cobrança
interface BillingItem {
  id: string;
  type: string;
  date: string;
  tripCode: string;
  truck: {
    id: string;
    plate: string;
  };
  trailer?: {
    id: string;
    plate: string;
  } | null;
  driver: {
    id: string;
    name: string;
    firstName: string;
  };
  amount: number;
  client?: {
    id: string;
    name: string;
  };
}

// GET /api/billing - Obter dados de cobrança por cliente
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      startDate,
      endDate,
      tripCode,
      truckId,
      driverId,
      clientId,
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

    // Construir filtros para viagens
    const tripsFilter: any = {
      status: 'COMPLETED', // Apenas viagens completas
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

    if (truckId) {
      tripsFilter.truckId = truckId as string;
    }

    if (driverId) {
      tripsFilter.driverId = driverId as string;
    }

    if (clientId) {
      tripsFilter.clientId = clientId as string;
    }

    const trips = await prisma.trip.findMany({
      where: tripsFilter,
      include: {
        truck: {
          select: { id: true, plate: true },
        },
        trailer: {
          select: { id: true, plate: true },
        },
        driver: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true },
        },
      },
      orderBy: { endDate: 'desc' },
    });

    const billingItems: BillingItem[] = trips.map((trip) => {
      // Extrair primeiro nome do motorista
      const firstName = trip.driver.name.split(' ')[0];

      return {
        id: trip.id,
        type: 'RECEITA',
        date: trip.endDate!.toISOString(),
        tripCode: trip.tripCode || '-',
        truck: trip.truck,
        trailer: trip.trailer || null,
        driver: {
          id: trip.driver.id,
          name: trip.driver.name,
          firstName,
        },
        amount: trip.revenue,
        client: trip.client || undefined,
      };
    });

    // Calcular total
    const totalAmount = billingItems.reduce((sum, item) => sum + item.amount, 0);

    res.json({
      items: billingItems,
      summary: {
        totalAmount,
        itemCount: billingItems.length,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar relatório de cobrança:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório de cobrança' });
  }
});

// POST /api/billing/send-webhook - Enviar screenshot ou CSV via webhook
router.post('/send-webhook', authenticate, async (req: AuthRequest, res) => {
  try {
    const { imageData, csvData, whatsappNumber, type, filters } = req.body;

    // Validar permissões
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (!imageData && !csvData) {
      return res.status(400).json({ message: 'Imagem ou CSV não fornecido' });
    }

    if (!whatsappNumber) {
      return res.status(400).json({ message: 'Número do WhatsApp não fornecido' });
    }

    // Processar imageData para extrair tipo e base64 puro
    let imageType: string | undefined;
    let imageBase64: string | undefined;
    
    if (imageData) {
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        imageType = matches[1];
        imageBase64 = matches[2];
      } else {
        imageBase64 = imageData;
        imageType = 'image/jpeg';
      }
    }

    // Preparar dados para webhook
    const webhookData = {
      type: type || 'billing_report',
      sentBy: {
        id: req.user?.userId,
        email: req.user?.email,
      },
      whatsappNumber,
      filters: filters || {},
      timestamp: new Date().toISOString(),
      ...(imageBase64 && { 
        imageType,
        imageBase64,
      }),
      ...(csvData && { csvData }),
    };

    // Enviar para webhook do N8N
    if (config.N8N_WEBHOOK_URL) {
      try {
        await axios.post(config.N8N_WEBHOOK_URL, webhookData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        console.log('Relatório de cobrança enviado para webhook com sucesso');
      } catch (webhookError: any) {
        console.error('Erro ao enviar webhook:', webhookError.message);
        return res.status(500).json({ message: 'Erro ao enviar para webhook' });
      }
    } else {
      console.warn('Webhook URL não configurada');
      return res.status(400).json({ message: 'Webhook não configurado' });
    }

    res.json({ message: 'Relatório de cobrança enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar relatório de cobrança:', error);
    res.status(500).json({ message: 'Erro ao enviar relatório de cobrança' });
  }
});

export default router;
