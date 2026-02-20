import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
console.log('📦 Loading auth routes...');
app.use('/api/auth', authRoutes);
console.log('✅ Auth routes mounted at /api/auth');

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
  console.log('✅ Environment:', process.env.NODE_ENV || 'development');
  console.log('✅ CORS Origin:', process.env.CORS_ORIGIN || '*');
  console.log('✅ ============================================');
  console.log('');
  console.log('📋 Available Routes:');
  console.log('   GET  /health');
  console.log('   POST /api/auth/login');
  console.log('   POST /api/auth/register');
  console.log('   GET  /api/auth/me');
  console.log('');
  console.log('✅ Ready to accept connections!');
  console.log('');
});

export default app;
