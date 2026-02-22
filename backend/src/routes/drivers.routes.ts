import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import bcrypt from 'bcrypt';
import { config } from '../config';
import axios from 'axios';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Função auxiliar para enviar webhook
async function sendWebhook(eventType: string, data: any) {
  if (!config.N8N_WEBHOOK_URL) {
    console.log('⚠️  N8N_WEBHOOK_URL not configured, skipping webhook');
    return;
  }

  try {
    await axios.post(config.N8N_WEBHOOK_URL, {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    });
    console.log(`✅ Webhook sent: ${eventType}`);
  } catch (error) {
    console.error(`❌ Error sending webhook ${eventType}:`, error);
  }
}

// GET /api/drivers - Listar todos os motoristas
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;

    const drivers = await prisma.user.findMany({
      where: {
        role: 'DRIVER',
        ...(active !== undefined && { active: active === 'true' }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        cpf: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            trips: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/drivers/:id - Obter detalhes de um motorista
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        cpf: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        trips: {
          include: {
            truck: {
              select: { id: true, plate: true, model: true },
            },
          },
          orderBy: { startDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/drivers - Criar novo motorista
router.post('/', async (req, res) => {
  try {
    const { email, password, name, cpf, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ 
        message: 'Email, password and name are required' 
      });
    }

    // Verificar se o email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Verificar se o CPF já existe (se fornecido)
    if (cpf) {
      const existingCpf = await prisma.user.findUnique({
        where: { cpf },
      });

      if (existingCpf) {
        return res.status(409).json({ message: 'CPF already in use' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const driver = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        cpf,
        phone,
        role: 'DRIVER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        cpf: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    // Enviar webhook com os dados do novo usuário
    await sendWebhook('user.created', {
      user: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        cpf: driver.cpf,
        phone: driver.phone,
        role: driver.role,
      },
      credentials: {
        email: driver.email,
        password: password, // Senha em texto plano para enviar no WhatsApp
      },
    });

    res.status(201).json(driver);
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/drivers/:id - Atualizar um motorista
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, cpf, phone, active, password } = req.body;

    const updateData: any = {
      ...(email && { email }),
      ...(name && { name }),
      ...(cpf !== undefined && { cpf }),
      ...(phone !== undefined && { phone }),
      ...(active !== undefined && { active }),
    };

    // Se uma nova senha foi fornecida, hash ela
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const driver = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        cpf: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.json(driver);
  } catch (error: any) {
    console.error('Error updating driver:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Driver not found' });
    }
    
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        message: 'Email or CPF already in use' 
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/drivers/:id - Deletar um motorista
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o motorista tem viagens
    const tripCount = await prisma.trip.count({
      where: { driverId: id },
    });

    if (tripCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete driver with existing trips. Consider deactivating instead.' 
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting driver:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Driver not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/drivers/:id/deactivate - Toggle active status
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar motorista atual
    const driver = await prisma.user.findUnique({
      where: { id },
      select: { active: true },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Toggle active status
    const updatedDriver = await prisma.user.update({
      where: { id },
      data: { active: !driver.active },
      select: {
        id: true,
        email: true,
        name: true,
        cpf: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.json(updatedDriver);
  } catch (error: any) {
    console.error('Error toggling driver status:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Driver not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
