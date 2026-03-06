import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

interface LogOptions {
  userId?: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: any;
  req?: Request;
}

/**
 * Registra uma ação de auditoria no banco de dados
 */
export async function logAction(options: LogOptions): Promise<void> {
  try {
    const {
      userId,
      userName,
      userRole,
      action,
      entity,
      entityId,
      details,
      req
    } = options;

    // Extrair IP e User Agent da requisição, se disponível
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (req) {
      ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                  (req.socket?.remoteAddress) || 
                  undefined;
      userAgent = req.headers['user-agent'] || undefined;
    }

    // Converter detalhes para string JSON se for objeto
    const detailsString = details 
      ? typeof details === 'string' 
        ? details 
        : JSON.stringify(details, null, 2)
      : undefined;

    await prisma.auditLog.create({
      data: {
        userId,
        userName,
        userRole,
        action,
        entity,
        entityId,
        details: detailsString,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Não quebrar a aplicação se houver erro ao logar
    console.error('Erro ao registrar log de auditoria:', error);
  }
}

/**
 * Tipos de ação padronizados
 */
export const LogAction = {
  // Autenticação
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  
  // CRUD
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  
  // Ações específicas
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  SUBMIT: 'SUBMIT',
  CANCEL: 'CANCEL',
  COMPLETE: 'COMPLETE',
  PAYMENT: 'PAYMENT',
  NOTIFICATION: 'NOTIFICATION',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
} as const;

/**
 * Entidades do sistema
 */
export const LogEntity = {
  USER: 'User',
  TRIP: 'Trip',
  TRUCK: 'Truck',
  TRAILER: 'Trailer',
  DRIVER: 'Driver',
  CLIENT: 'Client',
  EXPENSE: 'Expense',
  MAINTENANCE: 'Maintenance',
  LOCATION: 'Location',
  RECEIVABLE: 'Receivable',
  RECEIVABLE_PAYMENT: 'ReceivablePayment',
  SETTING: 'Setting',
  BILLING: 'Billing',
  REPORT: 'Report',
  SYSTEM: 'System',
} as const;

export default {
  logAction,
  LogAction,
  LogEntity,
};
