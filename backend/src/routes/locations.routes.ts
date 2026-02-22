import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/locations - Listar todas as localizações
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;

    const locations = await prisma.location.findMany({
      where: type ? { OR: [{ type: type as any }, { type: 'BOTH' }] } : undefined,
      orderBy: { name: 'asc' },
    });

    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/locations/:id - Obter detalhes de uma localização
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    res.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/locations - Criar nova localização
router.post('/', async (req, res) => {
  try {
    const { name, city, state, type } = req.body;

    if (!name || !city || !state || !type) {
      return res.status(400).json({ 
        message: 'Name, city, state and type are required' 
      });
    }

    const location = await prisma.location.create({
      data: {
        name,
        city,
        state,
        type,
      },
    });

    res.status(201).json(location);
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/locations/:id - Atualizar localização
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, state, type } = req.body;

    const location = await prisma.location.update({
      where: { id },
      data: {
        name,
        city,
        state,
        type,
      },
    });

    res.json(location);
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/locations/:id - Excluir localização
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.location.delete({
      where: { id },
    });

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
