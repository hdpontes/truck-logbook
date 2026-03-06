import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware para verificar se é ADMIN
const requireAdmin = (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem visualizar logs.' });
  }
  next();
};

// GET /api/logs - Buscar logs com filtros (somente ADMIN)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { 
      userId, 
      action, 
      entity, 
      startDate, 
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtros
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (entity) {
      where.entity = entity;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Buscar logs com paginação
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ message: 'Erro ao buscar logs de auditoria' });
  }
});

// GET /api/logs/stats - Estatísticas de logs (somente ADMIN)
router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Buscar estatísticas
    const [
      totalLogs,
      logsByAction,
      logsByEntity,
      logsByUser,
    ] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
      }),
      prisma.auditLog.groupBy({
        by: ['entity'],
        where,
        _count: true,
      }),
      prisma.auditLog.groupBy({
        by: ['userId', 'userName'],
        where,
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
    ]);

    res.json({
      totalLogs,
      byAction: logsByAction.map(item => ({
        action: item.action,
        count: item._count,
      })),
      byEntity: logsByEntity.map(item => ({
        entity: item.entity,
        count: item._count,
      })),
      topUsers: logsByUser.map(item => ({
        userId: item.userId,
        userName: item.userName,
        count: item._count,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ message: 'Erro ao buscar estatísticas' });
  }
});

// GET /api/logs/actions - Listar tipos de ações disponíveis
router.get('/actions', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const actions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });

    res.json(actions.map(a => a.action));
  } catch (error) {
    console.error('Erro ao buscar ações:', error);
    res.status(500).json({ message: 'Erro ao buscar ações' });
  }
});

// GET /api/logs/entities - Listar tipos de entidades disponíveis
router.get('/entities', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const entities = await prisma.auditLog.findMany({
      select: { entity: true },
      distinct: ['entity'],
      orderBy: { entity: 'asc' },
    });

    res.json(entities.map(e => e.entity));
  } catch (error) {
    console.error('Erro ao buscar entidades:', error);
    res.status(500).json({ message: 'Erro ao buscar entidades' });
  }
});

export default router;
