import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

export async function driversRoutes(app: FastifyInstance) {
  // List all drivers
  app.get('/', {
    onRequest: [authenticate],
  }, async () => {
    const drivers = await prisma.user.findMany({
      where: { 
        role: 'DRIVER',
        active: true 
      },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        phone: true,
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

    return { drivers };
  });

  // Get driver by ID
  app.get('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    const driver = await prisma.user.findUnique({
      where: { id, role: 'DRIVER' },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        phone: true,
        active: true,
        createdAt: true,
        trips: {
          orderBy: { startDate: 'desc' },
          take: 10,
          include: {
            truck: true,
          },
        },
      },
    });

    if (!driver) {
      throw new Error('Driver not found');
    }

    return { driver };
  });

  // Create driver
  app.post('/', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const createDriverSchema = z.object({
      name: z.string().min(3),
      email: z.string().email(),
      cpf: z.string().min(11).max(14),
      phone: z.string().min(10).max(15),
      password: z.string().min(6).default('motorista123'),
    });

    const data = createDriverSchema.parse(request.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return reply.status(400).send({ error: 'Email already exists' });
    }

    // Check if CPF already exists
    if (data.cpf) {
      const existingCPF = await prisma.user.findUnique({
        where: { cpf: data.cpf },
      });

      if (existingCPF) {
        return reply.status(400).send({ error: 'CPF already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const driver = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        cpf: data.cpf,
        phone: data.phone,
        password: hashedPassword,
        role: 'DRIVER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    return reply.status(201).send({ driver });
  });

  // Update driver
  app.put('/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const updateDriverSchema = z.object({
      name: z.string().min(3).optional(),
      email: z.string().email().optional(),
      cpf: z.string().min(11).max(14).optional(),
      phone: z.string().min(10).max(15).optional(),
      active: z.boolean().optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const data = updateDriverSchema.parse(request.body);

    const driver = await prisma.user.update({
      where: { id, role: 'DRIVER' },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        phone: true,
        active: true,
      },
    });

    return { driver };
  });

  // Delete driver (inactivate)
  app.delete('/:id', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = paramsSchema.parse(request.params);

    await prisma.user.update({
      where: { id, role: 'DRIVER' },
      data: { active: false },
    });

    return reply.status(204).send();
  });
}
