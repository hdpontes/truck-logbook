import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import bcrypt from 'bcrypt';
import { config } from '../config';
import axios from 'axios';
import { convertToCSV, parseCSV } from '../utils/csv';

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
    const currentUser = (req as any).user;

    const users = await prisma.user.findMany({
      where: {
        ...(active !== undefined && { active: active === 'true' }),
        ...(role && { role: role as any }),
        // MANAGER não pode ver usuários ADMIN
        ...(currentUser.role === 'MANAGER' && {
          role: {
            not: 'ADMIN',
          },
        }),
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
    const currentUser = (req as any).user;

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

    // MANAGER só pode criar MANAGER ou DRIVER
    if (currentUser.role === 'MANAGER' && role === 'ADMIN') {
      return res.status(403).json({ 
        message: 'Você não tem permissão para criar usuários administradores' 
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
    const currentUser = (req as any).user;

    // Buscar usuário que será editado
    const userToEdit = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!userToEdit) {
      return res.status(404).json({ message: 'User not found' });
    }

    // MANAGER não pode editar usuários ADMIN
    if (currentUser.role === 'MANAGER' && userToEdit.role === 'ADMIN') {
      return res.status(403).json({ 
        message: 'Você não tem permissão para editar usuários administradores' 
      });
    }

    // MANAGER não pode promover usuários para ADMIN
    if (currentUser.role === 'MANAGER' && role === 'ADMIN') {
      return res.status(403).json({ 
        message: 'Você não tem permissão para promover usuários para administrador' 
      });
    }

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

// GET /api/users/export/csv - Exportar todos os usuários para CSV
router.get('/export/csv', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const csvData = users.map(user => ({
      id: user.id,
      login: user.login,
      email: user.email,
      name: user.name,
      cpf: user.cpf || '',
      phone: user.phone || '',
      role: user.role,
      active: user.active,
      // Senha não é incluída por segurança
    }));

    const csv = convertToCSV(csvData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=usuarios.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting users CSV:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/users/import/csv - Importar usuários do CSV
router.post('/import/csv', async (req, res) => {
  try {
    const { csvData } = req.body;
    const currentUser = (req as any).user;

    if (!csvData) {
      return res.status(400).json({ message: 'CSV data is required' });
    }

    const users = parseCSV(csvData);

    if (!users || users.length === 0) {
      return res.status(400).json({ message: 'No valid data in CSV' });
    }

    const results = {
      success: 0,
      errors: [] as Array<{ email: string; error: string }>,
    };

    // Senha padrão para novos usuários importados
    const defaultPassword = await bcrypt.hash('123456', 10);

    for (const userData of users) {
      try {
        const { login, email, name, cpf, phone, role, active } = userData;

        if (!email || !name) {
          results.errors.push({
            email: email || 'unknown',
            error: 'Email and name are required',
          });
          continue;
        }

        // Validar role
        if (role && !['ADMIN', 'MANAGER', 'DRIVER'].includes(role)) {
          results.errors.push({
            email,
            error: 'Invalid role. Must be ADMIN, MANAGER or DRIVER',
          });
          continue;
        }

        // MANAGER não pode importar usuários ADMIN
        if (currentUser.role === 'MANAGER' && role === 'ADMIN') {
          results.errors.push({
            email,
            error: 'You do not have permission to create ADMIN users',
          });
          continue;
        }

        // Verificar se o usuário já existe
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        const userPayload = {
          login: login || email, // Se não tiver login, usa o email
          email,
          name,
          cpf: cpf || null,
          phone: phone || null,
          role: role || 'DRIVER', // Default DRIVER
          active: active !== false, // Default to true if not specified
        };

        if (existingUser) {
          // Atualizar usuário existente (exceto senha)
          await prisma.user.update({
            where: { email },
            data: userPayload,
          });
        } else {
          // Criar novo usuário com senha padrão
          await prisma.user.create({
            data: {
              ...userPayload,
              password: defaultPassword, // Senha padrão: 123456
            },
          });
        }

        results.success++;
      } catch (error: any) {
        results.errors.push({
          email: userData.email || 'unknown',
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error importing users CSV:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
