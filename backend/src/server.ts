import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import trucksRoutes from './routes/trucks.routes';
import trailersRoutes from './routes/trailers.routes';
import tripsRoutes from './routes/trips.routes';
import expensesRoutes from './routes/expenses.routes';
import driversRoutes from './routes/drivers.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import dashboardRoutes from './routes/dashboard.routes';
import clientsRoutes from './routes/clients.routes';
import locationsRoutes from './routes/locations.routes';
import usersRoutes from './routes/users.routes';
import settingsRoutes from './routes/settings.routes';
import reportsRoutes from './routes/reports.routes';
import billingRoutes from './routes/billing.routes';
import externalRoutes from './routes/external.routes';
import receivablesRoutes from './routes/receivables.routes';
import recurringExpensesRoutes from './routes/recurring-expenses.routes';
import logsRoutes from './routes/logs.routes';
import { startMonthlyCronJob } from './jobs/monthly-report.job';
import { startReceivablesNotificationJob } from './jobs/receivables-notification.job';
import { startRecurringExpensesNotificationJob } from './jobs/recurring-expenses-notification.job';

const app = express();
const PORT = Number(process.env.PORT) || 4000;  // ✅ FIX: Convert to Number

console.log('🚀 Starting Truck Logbook Backend...');
console.log('📍 Port:', PORT);
console.log('🌐 CORS Origin:', process.env.CORS_ORIGIN);

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
console.log('📦 Loading routes...');
app.use('/api/auth', authRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/trailers', trailersRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/receivables', receivablesRoutes);
app.use('/api/recurring-expenses', recurringExpensesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/external', externalRoutes);
console.log('✅ All routes mounted successfully');

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.method}:${req.path} not found`,
    error: 'Not Found',
    statusCode: 404
  });
});

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('✅ ============================================');
  console.log('✅ Server running on port', PORT);
  console.log('✅ EAuth:        /api/auth/*');
  console.log('   Trucks:      /api/trucks/*');
  console.log('   Trips:       /api/trips/*');
  console.log('   Expenses:    /api/expenses/*');
  console.log('   Drivers:     /api/drivers/*');
  console.log('   Maintenance: /api/maintenance/*');
  console.log('   Dashboard:   /api/dashboard/*==========================');
  console.log('');
  console.log('📋 Available Routes:');
  console.log('   GET  /health');
  console.log('   POST /api/auth/login');
  console.log('   POST /api/auth/register');
  console.log('   GET  /api/auth/me');
  console.log('');
  console.log('✅ Ready to accept connections!');
  console.log('');
  
  // Iniciar cron jobs
  startMonthlyCronJob();
  startReceivablesNotificationJob();
  startRecurringExpensesNotificationJob();
});

export default app;
