import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import axios from 'axios';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Função auxiliar para enviar webhook
async function sendWebhook(eventType: string, data: any) {
  if (!config.N8N_WEBHOOK_URL) return;

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

// GET /api/maintenance - Listar todas as manutenções
router.get('/', async (req, res) => {
  try {
    const { truckId, status, priority } = req.query;

    const maintenances = await prisma.maintenance.findMany({
      where: {
        ...(truckId && { truckId: truckId as string }),
        ...(status && { status: status as any }),
        ...(priority && { priority: priority as any }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true, currentMileage: true },
        },
      },
      orderBy: { scheduledDate: 'desc' },
    });

    res.json(maintenances);
  } catch (error) {
    console.error('Error fetching maintenances:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/maintenance/:id - Obter detalhes de uma manutenção
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const maintenance = await prisma.maintenance.findUnique({
      where: { id },
      include: {
        truck: true,
      },
    });

    if (!maintenance) {
      return res.status(404).json({ message: 'Maintenance not found' });
    }

    res.json(maintenance);
  } catch (error) {
    console.error('Error fetching maintenance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/maintenance - Criar nova manutenção
router.post('/', async (req, res) => {
  try {
    const {
      truckId,
      type,
      description,
      cost,
      mileage,
      scheduledMileage,
      scheduledDate,
      status,
      priority,
      supplier,
      notes,
    } = req.body;

    if (!truckId || !type || !description) {
      return res.status(400).json({ 
        message: 'TruckId, tipo e descrição são obrigatórios' 
      });
    }

    const truck = await prisma.truck.findUnique({
      where: { id: truckId },
      select: { id: true, plate: true, model: true, currentMileage: true },
    });

    if (!truck) {
      return res.status(404).json({ message: 'Caminhão não encontrado' });
    }

    // Verificar se a manutenção já está atrasada
    let maintenanceStatus = status || 'SCHEDULED';
    if (scheduledMileage && truck.currentMileage && truck.currentMileage >= scheduledMileage) {
      maintenanceStatus = 'PENDING'; // Atrasada se a km atual já passou da programada
      
      // Enviar webhook de manutenção atrasada
      await sendWebhook('maintenance.overdue', {
        maintenance: {
          type,
          description,
          scheduledMileage,
          priority: priority || 'MEDIUM',
        },
        truck: {
          plate: truck.plate,
          model: truck.model,
          currentMileage: truck.currentMileage,
        },
      });
    }

    const maintenance = await prisma.maintenance.create({
      data: {
        truckId,
        type,
        description,
        cost: cost ? parseFloat(cost) : 0,
        mileage: mileage ? parseFloat(mileage) : null,
        scheduledMileage: scheduledMileage ? parseFloat(scheduledMileage) : null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        status: maintenanceStatus,
        priority: priority || 'MEDIUM',
        supplier,
        notes,
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, currentMileage: true },
        },
      },
    });

    // Enviar webhook de manutenção programada
    if (scheduledDate || scheduledMileage) {
      await sendWebhook('maintenance.scheduled', {
        maintenance: {
          id: maintenance.id,
          type: maintenance.type,
          description: maintenance.description,
          scheduledDate: maintenance.scheduledDate,
          scheduledMileage: maintenance.scheduledMileage,
          priority: maintenance.priority,
        },
        truck: {
          plate: truck.plate,
          model: truck.model,
          currentMileage: truck.currentMileage,
        },
      });
    }

    res.status(201).json(maintenance);
  } catch (error) {
    console.error('Error creating maintenance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/maintenance/:id - Atualizar uma manutenção
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      description,
      cost,
      mileage,
      scheduledMileage,
      scheduledDate,
      completedDate,
      status,
      priority,
      supplier,
      invoice,
      receipt,
      notes,
    } = req.body;

    const maintenance = await prisma.maintenance.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(description && { description }),
        ...(cost !== undefined && { cost: parseFloat(cost) }),
        ...(mileage !== undefined && { mileage: mileage ? parseFloat(mileage) : null }),
        ...(scheduledMileage !== undefined && { scheduledMileage: scheduledMileage ? parseFloat(scheduledMileage) : null }),
        ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
        ...(completedDate && { completedDate: new Date(completedDate) }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(supplier !== undefined && { supplier }),
        ...(invoice !== undefined && { invoice }),
        ...(receipt !== undefined && { receipt }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, currentMileage: true },
        },
      },
    });

    // Se foi marcada como concluída, enviar webhook
    if (status === 'COMPLETED' && completedDate) {
      await sendWebhook('maintenance.completed', {
        maintenance: {
          id: maintenance.id,
          type: maintenance.type,
          description: maintenance.description,
          cost: maintenance.cost,
          completedDate: maintenance.completedDate,
        },
        truck: {
          plate: maintenance.truck.plate,
          model: maintenance.truck.model,
        },
      });
    }

    res.json(maintenance);
  } catch (error: any) {
    console.error('Error updating maintenance:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Manutenção não encontrada' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/maintenance/:id - Deletar uma manutenção
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.maintenance.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting maintenance:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Manutenção não encontrada' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/maintenance/check-overdue - Verificar manutenções atrasadas
router.get('/check-overdue', async (req, res) => {
  try {
    // Buscar manutenções programadas
    const scheduledMaintenances = await prisma.maintenance.findMany({
      where: {
        status: { in: ['SCHEDULED', 'PENDING'] },
        scheduledMileage: { not: null },
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, currentMileage: true },
        },
      },
    });

    const overdueMaintenances = [];

    for (const maintenance of scheduledMaintenances) {
      const truck = maintenance.truck;
      
      if (truck.currentMileage && maintenance.scheduledMileage && 
          truck.currentMileage >= maintenance.scheduledMileage &&
          maintenance.status !== 'PENDING') {
        
        // Atualizar status para PENDING (atrasada)
        await prisma.maintenance.update({
          where: { id: maintenance.id },
          data: { status: 'PENDING' },
        });

        overdueMaintenances.push(maintenance);

        // Enviar webhook
        await sendWebhook('maintenance.overdue', {
          maintenance: {
            id: maintenance.id,
            type: maintenance.type,
            description: maintenance.description,
            scheduledMileage: maintenance.scheduledMileage,
            priority: maintenance.priority,
          },
          truck: {
            plate: truck.plate,
            model: truck.model,
            currentMileage: truck.currentMileage,
          },
        });
      }
    }

    res.json({
      checked: scheduledMaintenances.length,
      overdue: overdueMaintenances.length,
      maintenances: overdueMaintenances,
    });
  } catch (error) {
    console.error('Error checking overdue maintenances:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
