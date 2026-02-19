import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { webhookService } from '../services/webhook';

export async function maintenanceRoutes(app: FastifyInstance) {
  // List all maintenances
  app.get('/', {
    onRequest: [authenticate],
  }, async (request) => {
    const querySchema = z.object({
      truckId: z.string().uuid().optional(),
      status: z.string().optional(),
      type: z.string().optional(),
    });

    const query = querySchema.parse(request.query);

    const where: any = {};

    if (query.truckId) where.truckId = query.truckId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const maintenances = await prisma.maintenance.findMany({
      where,
      include: {
        truck: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { maintenances };
  });

  // Get maintenance by ID
  app.get('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    const maintenance = await prisma.maintenance.findUnique({
      where: { id },
      include: {
        truck: true,
      },
    });

    if (!maintenance) {
      throw new Error('Maintenance not found');
    }

    return { maintenance };
  });

  // Create maintenance
  app.post('/', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const createMaintenanceSchema = z.object({
      truckId: z.string().uuid(),
      type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'INSPECTION', 'OIL_CHANGE', 'TIRE_CHANGE', 'BRAKE', 'ENGINE', 'TRANSMISSION', 'ELECTRICAL', 'OTHER']),
      description: z.string(),
      cost: z.number().default(0),
      mileage: z.number().optional(),
      scheduledDate: z.string().transform(val => new Date(val)).optional(),
      completedDate: z.string().transform(val => new Date(val)).optional(),
      supplier: z.string().optional(),
      invoice: z.string().optional(),
      receipt: z.string().optional(),
      status: z.enum(['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      notes: z.string().optional(),
    });

    const data = createMaintenanceSchema.parse(request.body);

    const maintenance = await prisma.maintenance.create({
      data,
      include: {
        truck: true,
      },
    });

    // Enviar notificação se foi agendada
    if (maintenance.status === 'SCHEDULED' && maintenance.scheduledDate) {
      await webhookService.notifyMaintenanceScheduled(maintenance);
    }

    return reply.status(201).send({ maintenance });
  });

  // Update maintenance
  app.put('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const updateMaintenanceSchema = z.object({
      type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'INSPECTION', 'OIL_CHANGE', 'TIRE_CHANGE', 'BRAKE', 'ENGINE', 'TRANSMISSION', 'ELECTRICAL', 'OTHER']).optional(),
      description: z.string().optional(),
      cost: z.number().optional(),
      mileage: z.number().optional(),
      scheduledDate: z.string().transform(val => new Date(val)).optional(),
      completedDate: z.string().transform(val => new Date(val)).optional(),
      supplier: z.string().optional(),
      invoice: z.string().optional(),
      receipt: z.string().optional(),
      status: z.enum(['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      notes: z.string().optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const data = updateMaintenanceSchema.parse(request.body);

    const currentMaintenance = await prisma.maintenance.findUnique({
      where: { id },
      include: { truck: true },
    });

    const maintenance = await prisma.maintenance.update({
      where: { id },
      data,
      include: {
        truck: true,
      },
    });

    // Notificar se status mudou para concluída
    if (data.status === 'COMPLETED' && currentMaintenance?.status !== 'COMPLETED') {
      await webhookService.notifyMaintenanceCompleted(maintenance);
    }

    // Notificar se foi agendada
    if (data.status === 'SCHEDULED' && data.scheduledDate) {
      await webhookService.notifyMaintenanceScheduled(maintenance);
    }

    return { maintenance };
  });

  // Delete maintenance
  app.delete('/:id', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    await prisma.maintenance.delete({
      where: { id },
    });

    return reply.status(204).send();
  });

  // Get upcoming maintenances
  app.get('/upcoming/all', {
    onRequest: [authenticate],
  }, async () => {
    const maintenances = await prisma.maintenance.findMany({
      where: {
        status: {
          in: ['PENDING', 'SCHEDULED'],
        },
        scheduledDate: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // próximos 30 dias
        },
      },
      include: {
        truck: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return { maintenances };
  });
}
