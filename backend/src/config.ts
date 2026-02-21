import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN || '7d') as string,
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || '',
  EXPENSE_HIGH_THRESHOLD: parseInt(process.env.EXPENSE_HIGH_THRESHOLD || '5000', 10),
  PROFIT_LOW_THRESHOLD: parseFloat(process.env.PROFIT_LOW_THRESHOLD || '0.1'),
};
