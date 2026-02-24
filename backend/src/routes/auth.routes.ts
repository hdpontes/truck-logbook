import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { config } from '../config';

const router = Router();

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

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, password } = req.body;

    console.log('🔐 Login attempt:', login);

    if (!login || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ 
        message: 'Login e senha são obrigatórios' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { login }
    });

    if (!user) {
      console.log('❌ User not found:', login);
      return res.status(401).json({ 
        message: 'Credenciais inválidas' 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', login);
      return res.status(401).json({ 
        message: 'Credenciais inválidas' 
      });
    }

    // Verificar se o usuário está ativo
    if (!user.active) {
      console.log('❌ User deactivated:', login);
      return res.status(403).json({ 
        message: 'Usuário desativado. Contate o administrador.' 
      });
    }

    const jwtSecret: string = config.JWT_SECRET;
    const jwtExpiry: string | number = config.JWT_EXPIRES_IN;
    
    // @ts-expect-error - JWT library type definitions issue with expiresIn
    const token = jwt.sign(
      {
        userId: user.id,
        login: user.login,
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    console.log('✅ Login successful:', login);

    res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { login, email, password, name } = req.body;

    if (!login || !email || !password || !name) {
      return res.status(400).json({ 
        message: 'Todos os campos são obrigatórios' 
      });
    }

    // Verificar se o login já existe
    const existingLogin = await prisma.user.findUnique({
      where: { login }
    });

    if (existingLogin) {
      return res.status(409).json({ 
        message: 'Login já está em uso' 
      });
    }

    // Verificar se o email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ 
        message: 'Email já está em uso' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        login,
        email,
        password: hashedPassword,
        name,
        role: UserRole.DRIVER  // ✅ FIX: Use DRIVER instead of USER
      }
    });

    const jwtSecret: string = config.JWT_SECRET;
    const jwtExpiry: string | number = config.JWT_EXPIRES_IN;
    
    // @ts-expect-error - JWT library type definitions issue with expiresIn
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('💥 Register error:', error);
    res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(
      token, 
      config.JWT_SECRET
    ) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('💥 Auth me error:', error);
    res.status(401).json({ 
      message: 'Invalid token' 
    });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    console.log('🔑 Forgot password request for:', identifier);

    if (!identifier) {
      return res.status(400).json({ 
        message: 'Login ou email é obrigatório' 
      });
    }

    // Buscar usuário por login ou email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { login: identifier },
          { email: identifier }
        ]
      },
      select: {
        id: true,
        login: true,
        email: true,
        name: true,
        phone: true,
        role: true
      }
    });

    if (!user) {
      console.log('❌ User not found:', identifier);
      return res.status(404).json({ 
        message: 'Usuário não encontrado. Por favor, contate o administrador do sistema.' 
      });
    }

    // Gerar senha temporária (8 caracteres aleatórios)
    const tempPassword = Math.random().toString(36).slice(-8);
    
    // Hash da senha temporária
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Atualizar senha do usuário
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // Enviar webhook para notificação via WhatsApp com a senha temporária
    await sendWebhook('auth.forgot_password', {
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role
      },
      temporaryPassword: tempPassword,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Temporary password generated and sent for:', user.login);

    res.json({ 
      message: 'Uma senha temporária foi gerada e enviada! O administrador entrará em contato via WhatsApp.',
      success: true
    });
  } catch (error) {
    console.error('💥 Forgot password error:', error);
    res.status(500).json({ 
      message: 'Erro ao processar solicitação. Tente novamente.' 
    });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        message: 'Token não fornecido' 
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    const userId = decoded.userId;

    const { currentPassword, newPassword } = req.body;

    console.log('🔒 Change password request for user:', userId);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Senha atual e nova senha são obrigatórias' 
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ 
        message: 'A nova senha deve ter pelo menos 4 caracteres' 
      });
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login: true,
        password: true,
        name: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuário não encontrado' 
      });
    }

    // Validar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      console.log('❌ Invalid current password for:', user.login);
      return res.status(401).json({ 
        message: 'Senha atual incorreta' 
      });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    console.log('✅ Password changed successfully for:', user.login);

    res.json({ 
      message: 'Senha alterada com sucesso!',
      success: true
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        message: 'Token inválido' 
      });
    }
    console.error('💥 Change password error:', error);
    res.status(500).json({ 
      message: 'Erro ao alterar senha. Tente novamente.' 
    });
  }
});

export default router;
