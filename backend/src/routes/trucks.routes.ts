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

// GET /api/trucks - Listar todos os caminhões
router.get('/', async (req, res) => {
  try {
    const trucks = await prisma.truck.findMany({
      include: {
        _count: {
          select: {
            trips: true,
            expenses: true,
            maintenances: true,
          },
        },
        maintenances: {
          where: {
            status: { in: ['PENDING', 'SCHEDULED'] },
            OR: [
              {
                scheduledMileage: { not: null },
              },
              {
                scheduledDate: { not: null },
              },
            ],
          },
          select: {
            id: true,
            type: true,
            description: true,
            status: true,
            scheduledMileage: true,
            scheduledDate: true,
            priority: true,
          },
          orderBy: { scheduledDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Adicionar flag de manutenção atrasada
    const trucksWithStatus = trucks.map(truck => {
      const overdueMaintenance = truck.maintenances.find(m => 
        m.scheduledMileage && 
        truck.currentMileage && 
        truck.currentMileage >= m.scheduledMileage
      );
      
      return {
        ...truck,
        hasOverdueMaintenance: !!overdueMaintenance,
        pendingMaintenancesCount: truck.maintenances.length,
      };
    });

    res.json(trucksWithStatus);
  } catch (error) {
    console.error('Error fetching trucks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/trucks/plate/:plate - Consultar placa via SINESP (não oficial)
router.get('/plate/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    // Validar formato da placa (ABC1234 ou ABC1D23)
    const plateRegex = /^[A-Z]{3}[0-9]{1}[A-Z0-9]{1}[0-9]{2}$/;
    const cleanPlate = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    if (!plateRegex.test(cleanPlate)) {
      return res.status(400).json({ 
        message: 'Formato de placa inválido. Use ABC1234 ou ABC1D23' 
      });
    }

    // Tentar consultar via SINESP (não oficial)
    // Nota: Esta API não é oficial e pode parar de funcionar
    try {
      const response = await axios.get(`https://apicarros.com/v1/consulta/${cleanPlate}/json`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data && response.data.marca) {
        return res.json({
          success: true,
          data: {
            plate: cleanPlate,
            brand: response.data.marca || '',
            model: response.data.modelo || '',
            year: response.data.ano ? parseInt(response.data.ano) : null,
            color: response.data.cor || '',
            chassisNum: response.data.chassi || '',
            municipality: response.data.municipio || '',
            state: response.data.uf || '',
          },
          source: 'SINESP (não oficial)',
          warning: 'Esta consulta utiliza API não oficial e pode falhar. Verifique os dados antes de salvar.'
        });
      }

      throw new Error('Dados não encontrados');
    } catch (apiError: any) {
      console.error('Error consulting SINESP:', apiError.message);
      
      return res.status(404).json({
        success: false,
        message: 'Não foi possível consultar a placa. A API pode estar indisponível.',
        details: apiError.response?.data?.message || apiError.message,
        suggestion: 'Por favor, preencha os dados manualmente.'
      });
    }
  } catch (error) {
    console.error('Error in plate consultation:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro ao consultar placa',
      suggestion: 'Por favor, preencha os dados manualmente.'
    });
  }
});

// GET /api/trucks/:id - Obter detalhes de um caminhão
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const truck = await prisma.truck.findUnique({
      where: { id },
      include: {
        trips: {
          include: {
            driver: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { startDate: 'desc' },
        },
        expenses: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        maintenances: {
          orderBy: { scheduledDate: 'desc' },
        },
      },
    });

    if (!truck) {
      return res.status(404).json({ message: 'Caminhão não encontrado' });
    }

    // Calcular métricas
    const metrics = await prisma.trip.aggregate({
      where: {
        truckId: id,
        status: 'COMPLETED',
      },
      _sum: {
        revenue: true,
        totalCost: true,
        profit: true,
      },
      _count: true,
    });

    // Separar manutenções pendentes/atrasadas
    const pendingMaintenances = truck.maintenances.filter(m => 
      m.status === 'PENDING' || m.status === 'SCHEDULED'
    );
    
    const overdueMaintenances = pendingMaintenances.filter(m => 
      m.scheduledMileage && 
      truck.currentMileage && 
      truck.currentMileage >= m.scheduledMileage
    );

    res.json({
      ...truck,
      metrics: {
        totalRevenue: metrics._sum.revenue || 0,
        totalCost: metrics._sum.totalCost || 0,
        totalProfit: metrics._sum.profit || 0,
        totalTrips: metrics._count,
      },
      pendingMaintenancesCount: pendingMaintenances.length,
      overdueMaintenancesCount: overdueMaintenances.length,
      hasOverdueMaintenance: overdueMaintenances.length > 0,
    });
  } catch (error) {
    console.error('Error fetching truck:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trucks - Criar novo caminhão
router.post('/', async (req, res) => {
  try {
    const { plate, model, brand, year, color, chassisNum, capacity, avgConsumption, currentMileage, status } = req.body;

    if (!plate || !model || !brand || !year) {
      return res.status(400).json({ 
        message: 'Plate, model, brand and year are required' 
      });
    }

    const truck = await prisma.truck.create({
      data: {
        plate,
        model,
        brand,
        year: parseInt(year),
        color,
        chassisNum,
        capacity: capacity ? parseFloat(capacity) : null,
        avgConsumption: avgConsumption ? parseFloat(avgConsumption) : null,
        currentMileage: currentMileage ? parseFloat(currentMileage) : 0,
        status: status || 'GARAGE',
      },
    });

    res.status(201).json(truck);
  } catch (error: any) {
    console.error('Error creating truck:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        message: 'Truck with this plate or chassis number already exists' 
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/trucks/:id - Atualizar caminhão
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { plate, model, brand, year, color, chassisNum, capacity, avgConsumption, currentMileage, status, active } = req.body;

    const truck = await prisma.truck.update({
      where: { id },
      data: {
        ...(plate && { plate }),
        ...(model && { model }),
        ...(brand && { brand }),
        ...(year && { year: parseInt(year) }),
        ...(color && { color }),
        ...(chassisNum && { chassisNum }),
        ...(capacity && { capacity: parseFloat(capacity) }),
        ...(avgConsumption && { avgConsumption: parseFloat(avgConsumption) }),
        ...(currentMileage !== undefined && { currentMileage: parseFloat(currentMileage) }),
        ...(status && { status }),
        ...(active !== undefined && { active }),
      },
    });

    // Se a quilometragem foi atualizada, verificar manutenções atrasadas
    if (currentMileage !== undefined) {
      const scheduledMaintenances = await prisma.maintenance.findMany({
        where: {
          truckId: id,
          status: { in: ['SCHEDULED', 'PENDING'] },
          scheduledMileage: { not: null },
        },
        include: {
          truck: {
            select: { id: true, plate: true, model: true, currentMileage: true },
          },
        },
      });

      for (const maintenance of scheduledMaintenances) {
        if (maintenance.scheduledMileage && 
            truck.currentMileage !== null &&
            truck.currentMileage >= maintenance.scheduledMileage &&
            maintenance.status !== 'PENDING') {
          
          // Atualizar status para PENDING (atrasada)
          await prisma.maintenance.update({
            where: { id: maintenance.id },
            data: { status: 'PENDING' },
          });

          // Enviar webhook de manutenção atrasada
          await sendWebhook('maintenance.overdue', {
            maintenance: {
              id: maintenance.id,
              type: maintenance.type,
              description: maintenance.description,
              scheduledMileage: maintenance.scheduledMileage,
              priority: maintenance.priority,
            },
            truck: {
              id: truck.id,
              plate: truck.plate,
              model: truck.model,
              currentMileage: truck.currentMileage,
              overdueBy: truck.currentMileage - maintenance.scheduledMileage,
            },
          });

          console.log(`⚠️ Manutenção ${maintenance.id} atrasada - Caminhão ${truck.plate}`);
        }
      }
    }

    res.json(truck);
  } catch (error: any) {
    console.error('Error updating truck:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Truck not found' });
    }
    
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        message: 'Truck with this plate or chassis number already exists' 
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/trucks/:id/status - Atualizar status do caminhão
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['GARAGE', 'IN_TRANSIT', 'MAINTENANCE'].includes(status)) {
      return res.status(400).json({ 
        message: 'Valid status is required (GARAGE, IN_TRANSIT, MAINTENANCE)' 
      });
    }

    const truck = await prisma.truck.update({
      where: { id },
      data: { status },
    });

    res.json(truck);
  } catch (error: any) {
    console.error('Error updating truck status:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Truck not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/trucks/:id - Deletar caminhão
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.truck.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting truck:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Truck not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
