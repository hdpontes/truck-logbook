import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// GET /api/settings - Obter configurações (público - sem autenticação)
router.get('/', async (req, res) => {
  try {
    // Buscar primeira configuração ou criar se não existir
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      // Migrar webhook URL da variável de ambiente na primeira vez
      const webhookUrl = config.N8N_WEBHOOK_URL || null;
      
      settings = await prisma.settings.create({
        data: {
          companyName: 'Truck Logbook',
          dieselPrice: 0,
          webhookUrl,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/settings - Atualizar configurações (requer autenticação)
router.put('/', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { companyName, companyLogo, dieselPrice, webhookUrl } = req.body;

    // Verificar permissões
    if (companyName !== undefined || companyLogo !== undefined || webhookUrl !== undefined) {
      // Apenas ADMIN pode alterar nome, logo e webhook da empresa
      if (user.role !== 'ADMIN') {
        return res.status(403).json({
          message: 'Apenas administradores podem alterar essas configurações',
        });
      }
    }

    // ADMIN e MANAGER podem alterar preço do diesel
    if (dieselPrice !== undefined) {
      if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
        return res.status(403).json({
          message: 'Apenas administradores e gerentes podem alterar o preço do diesel',
        });
      }
    }

    // Buscar configuração existente ou criar
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          companyName: companyName || 'Truck Logbook',
          companyLogo: companyLogo || null,
          dieselPrice: dieselPrice || 0,
          webhookUrl: webhookUrl || null,
        },
      });
    } else {
      const updateData: any = {};
      
      if (companyName !== undefined && user.role === 'ADMIN') {
        updateData.companyName = companyName;
      }
      
      if (companyLogo !== undefined && user.role === 'ADMIN') {
        updateData.companyLogo = companyLogo;
      }
      
      if (webhookUrl !== undefined && user.role === 'ADMIN') {
        updateData.webhookUrl = webhookUrl || null;
      }
      
      if (dieselPrice !== undefined && (user.role === 'ADMIN' || user.role === 'MANAGER')) {
        updateData.dieselPrice = parseFloat(dieselPrice);
      }

      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
