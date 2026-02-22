import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

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
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(trucks);
  } catch (error) {
    console.error('Error fetching trucks:', error);
    res.status(500).json({ message: 'Internal server error' });
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
      return res.status(404).json({ message: 'Truck not found' });
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

    res.json({
      ...truck,
      metrics: {
        totalRevenue: metrics._sum.revenue || 0,
        totalCost: metrics._sum.totalCost || 0,
        totalProfit: metrics._sum.profit || 0,
        totalTrips: metrics._count,
      },
    });
  } catch (error) {
    console.error('Error fetching truck:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trucks - Criar novo caminhão
router.post('/', async (req, res) => {
  try {
    const { plate, model, brand, year, color, chassisNum, capacity, avgConsumption } = req.body;

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
    const { plate, model, brand, year, color, chassisNum, capacity, avgConsumption, active } = req.body;

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
        ...(active !== undefined && { active }),
      },
    });

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
