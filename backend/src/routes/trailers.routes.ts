import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/trailers - Listar todas as carretas
router.get('/', async (req, res) => {
  try {
    const trailers = await prisma.trailer.findMany({
      include: {
        _count: {
          select: {
            trips: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(trailers);
  } catch (error) {
    console.error('Error fetching trailers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/trailers/:id - Obter detalhes de uma carreta
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trailer = await prisma.trailer.findUnique({
      where: { id },
      include: {
        trips: {
          include: {
            truck: {
              select: { id: true, plate: true, model: true, brand: true },
            },
            driver: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!trailer) {
      return res.status(404).json({ message: 'Trailer not found' });
    }

    // Calcular métricas
    const metrics = await prisma.trip.aggregate({
      where: {
        trailerId: id,
        status: 'COMPLETED',
      },
      _sum: {
        revenue: true,
        totalCost: true,
        profit: true,
        distance: true,
      },
      _count: true,
    });

    res.json({
      ...trailer,
      metrics: {
        totalRevenue: metrics._sum.revenue || 0,
        totalCost: metrics._sum.totalCost || 0,
        totalProfit: metrics._sum.profit || 0,
        totalDistance: metrics._sum.distance || 0,
        totalTrips: metrics._count,
      },
    });
  } catch (error) {
    console.error('Error fetching trailer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trailers - Criar nova carreta
router.post('/', async (req, res) => {
  try {
    const { plate, model, brand, year, capacity } = req.body;

    if (!plate) {
      return res.status(400).json({ 
        message: 'Plate is required' 
      });
    }

    // Verificar se a placa já existe
    const existingTrailer = await prisma.trailer.findUnique({
      where: { plate },
    });

    if (existingTrailer) {
      return res.status(400).json({ 
        message: 'A trailer with this plate already exists' 
      });
    }

    const trailer = await prisma.trailer.create({
      data: {
        plate: plate.toUpperCase(),
        model: model || null,
        brand: brand || null,
        year: year ? parseInt(year) : null,
        capacity: capacity ? parseFloat(capacity) : null,
      },
    });

    res.status(201).json(trailer);
  } catch (error) {
    console.error('Error creating trailer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/trailers/:id - Atualizar carreta
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { plate, model, brand, year, capacity, active } = req.body;

    const existingTrailer = await prisma.trailer.findUnique({
      where: { id },
    });

    if (!existingTrailer) {
      return res.status(404).json({ message: 'Trailer not found' });
    }

    // Se a placa foi alterada, verificar se já existe outra carreta com essa placa
    if (plate && plate !== existingTrailer.plate) {
      const duplicatePlate = await prisma.trailer.findUnique({
        where: { plate },
      });

      if (duplicatePlate) {
        return res.status(400).json({ 
          message: 'A trailer with this plate already exists' 
        });
      }
    }

    const trailer = await prisma.trailer.update({
      where: { id },
      data: {
        plate: plate ? plate.toUpperCase() : existingTrailer.plate,
        model: model !== undefined ? model : existingTrailer.model,
        brand: brand !== undefined ? brand : existingTrailer.brand,
        year: year !== undefined ? (year ? parseInt(year) : null) : existingTrailer.year,
        capacity: capacity !== undefined ? (capacity ? parseFloat(capacity) : null) : existingTrailer.capacity,
        active: active !== undefined ? active : existingTrailer.active,
      },
    });

    res.json(trailer);
  } catch (error) {
    console.error('Error updating trailer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/trailers/:id - Deletar carreta (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trailer = await prisma.trailer.findUnique({
      where: { id },
      include: {
        trips: {
          where: {
            status: {
              in: ['PLANNED', 'IN_PROGRESS'],
            },
          },
        },
      },
    });

    if (!trailer) {
      return res.status(404).json({ message: 'Trailer not found' });
    }

    // Verificar se há viagens ativas usando esta carreta
    if (trailer.trips.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete trailer with active trips. Please complete or cancel them first.' 
      });
    }

    // Soft delete
    await prisma.trailer.update({
      where: { id },
      data: { active: false },
    });

    res.json({ message: 'Trailer deactivated successfully' });
  } catch (error) {
    console.error('Error deleting trailer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
