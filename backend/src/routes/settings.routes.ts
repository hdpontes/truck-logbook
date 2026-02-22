import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/settings - Obter configurações (todos autenticados)
router.get('/', async (req, res) => {
  try {
    // Buscar primeira configuração ou criar se não existir
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          companyName: 'Truck Logbook',
          dieselPrice: 0,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/settings - Atualizar configurações
router.put('/', async (req, res) => {
  try {
    const user = (req as any).user;
    const { companyName, companyLogo, dieselPrice } = req.body;

    // Verificar permissões
    if (companyName !== undefined || companyLogo !== undefined) {
      // Apenas ADMIN pode alterar nome e logo da empresa
      if (user.role !== 'ADMIN') {
        return res.status(403).json({
          message: 'Apenas administradores podem alterar nome e logo da empresa',
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
