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

// GET /api/users - Listar todos os usuários
router.get('/', async (req, res) => {
  try {
    const { active, role } = req.query;

    const users = await prisma.user.findMany({
      where: {
        ...(active !== undefined && { active: active === 'true' }),
        ...(role && { role: role as any }),
      },
      select: {
        id: true,
        login: true,
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

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/users/:id - Obter detalhes de um usuário
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        login: true,
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

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/users - Criar novo usuário
router.post('/', async (req, res) => {
  try {
    const { login, email, password, name, cpf, phone, role } = req.body;

    if (!login || !email || !password || !name || !role) {
      return res.status(400).json({ 
        message: 'Login, email, senha, nome e perfil são obrigatórios' 
      });
    }

    // Validar role
    if (!['ADMIN', 'MANAGER', 'DRIVER'].includes(role)) {
      return res.status(400).json({ 
        message: 'Perfil inválido. Use ADMIN, MANAGER ou DRIVER' 
      });
    }

    // Verificar se o login já existe
    const existingLogin = await prisma.user.findUnique({
      where: { login },
    });

    if (existingLogin) {
      return res.status(409).json({ message: 'Login já está em uso' });
    }

    // Verificar se o email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Email já está em uso' });
    }

    // Verificar se o CPF já existe (se fornecido)
    if (cpf) {
      const existingCpf = await prisma.user.findUnique({
        where: { cpf },
      });

      if (existingCpf) {
        return res.status(409).json({ message: 'CPF já está em uso' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        login,
        email,
        password: hashedPassword,
        name,
        cpf,
        phone,
        role,
      },
      select: {
        id: true,
        login: true,
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
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        phone: user.phone,
        role: user.role,
      },
      credentials: {
        login: user.login,
        email: user.email,
        password: password, // Senha em texto plano para enviar no WhatsApp
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/users/:id - Atualizar um usuário
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { login, email, name, cpf, phone, active, password, role } = req.body;

    const updateData: any = {
      ...(login && { login }),
      ...(email && { email }),
      ...(name && { name }),
      ...(cpf !== undefined && { cpf }),
      ...(phone !== undefined && { phone }),
      ...(active !== undefined && { active }),
      ...(role && { role }),
    };

    // Validar role se fornecido
    if (role && !['ADMIN', 'MANAGER', 'DRIVER'].includes(role)) {
      return res.status(400).json({ 
        message: 'Invalid role. Must be ADMIN, MANAGER or DRIVER' 
      });
    }

    // Se uma nova senha foi fornecida, hash ela
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
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

    res.json(user);
  } catch (error: any) {
    console.error('Error updating user:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        message: 'Email or CPF already in use' 
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/users/:id - Deletar um usuário
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o usuário tem viagens
    const tripCount = await prisma.trip.count({
      where: { driverId: id },
    });

    if (tripCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete user with existing trips. Consider deactivating instead.' 
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting user:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/users/:id/deactivate - Toggle active status
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar usuário atual
    const user = await prisma.user.findUnique({
      where: { id },
      select: { active: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle active status
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { active: !user.active },
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

    res.json(updatedUser);
  } catch (error: any) {
    console.error('Error toggling user status:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
