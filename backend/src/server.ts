import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from './config';
import { prisma } from './lib/prisma';
import { trucksRoutes } from './routes/trucks';
import { tripsRoutes } from './routes/trips';
import { expensesRoutes } from './routes/expenses';
import { maintenanceRoutes } from './routes/maintenance';
import { dashboardRoutes } from './routes/dashboard';
import { authRoutes } from './routes/auth';
import { driversRoutes } from './routes/drivers';
import path from 'path';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'error',
  },
});

// Plugins
app.register(cors, {
  origin: true,
  credentials: true,
});

app.register(jwt, {
  secret: config.JWT_SECRET,
});

app.register(multipart, {
  limits: {
    fileSize: config.MAX_FILE_SIZE,
  },
});

app.register(fastifyStatic, {
  root: path.join(__dirname, '../uploads'),
  prefix: '/uploads/',
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Routes
app.register(authRoutes, { prefix: '/api/auth' });
app.register(driversRoutes, { prefix: '/api/drivers' });
app.register(trucksRoutes, { prefix: '/api/trucks' });
app.register(tripsRoutes, { prefix: '/api/trips' });
app.register(expensesRoutes, { prefix: '/api/expenses' });
app.register(maintenanceRoutes, { prefix: '/api/maintenance' });
app.register(dashboardRoutes, { prefix: '/api/dashboard' });

// Error handler
app.setErrorHandler((error, request, reply) => {
  console.error(error);
  reply.status(500).send({
    error: 'Internal Server Error',
    message: error.message,
  });
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  await app.close();
  process.exit(0);
});

start();
