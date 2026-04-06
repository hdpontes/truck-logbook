import { prisma } from '../lib/prisma';
import axios from 'axios';
import { config } from '../config';

/**
 * Envia webhook para N8N com os dados fornecidos
 * Busca a URL do webhook das configurações do banco de dados
 * Se não configurada, usa a variável de ambiente como fallback
 * 
 * @param eventType - Tipo do evento (ex: 'trip.scheduled', 'auth.forgot_password')
 * @param data - Dados a serem enviados no webhook
 */
export async function sendWebhook(eventType: string, data: any) {
  try {
    // Buscar URL do webhook das configurações
    const settings = await prisma.settings.findFirst();
    const webhookUrl = settings?.webhookUrl || config.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log('⚠️  Webhook URL não configurada, pulando envio');
      return;
    }

    // Enviar webhook
    await axios.post(webhookUrl, {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    }, {
      timeout: 10000, // 10 segundos
    });

    console.log(`✅ Webhook enviado: ${eventType}`);
  } catch (error) {
    console.error(`❌ Erro ao enviar webhook ${eventType}:`, error);
    // Não lançar erro para não quebrar o fluxo principal
  }
}
