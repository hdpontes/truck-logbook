import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { convertToCSV, parseCSV } from '../utils/csv';

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

// GET /api/locations/export/csv - Exportar todas as localizações para CSV
router.get('/export/csv', async (req, res) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const csvData = locations.map(location => ({
      id: location.id,
      name: location.name,
      city: location.city,
      state: location.state,
      type: location.type,
    }));

    const csv = convertToCSV(csvData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=localizacoes.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting locations CSV:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/locations/import/csv - Importar localizações do CSV
router.post('/import/csv', async (req, res) => {
  try {
    const { csvData } = req.body;

    if (!csvData) {
      return res.status(400).json({ message: 'CSV data is required' });
    }

    const locations = parseCSV(csvData);

    if (!locations || locations.length === 0) {
      return res.status(400).json({ message: 'No valid data in CSV' });
    }

    const results = {
      success: 0,
      errors: [] as Array<{ location: string; error: string }>,
    };

    for (const locationData of locations) {
      try {
        const { name, city, state, type } = locationData;

        if (!name || !city || !state || !type) {
          results.errors.push({
            location: name || 'unknown',
            error: 'Name, city, state and type are required',
          });
          continue;
        }

        // Validar type
        if (!['ORIGIN', 'DESTINATION', 'BOTH'].includes(type)) {
          results.errors.push({
            location: name,
            error: 'Invalid type. Must be ORIGIN, DESTINATION or BOTH',
          });
          continue;
        }

        // Verificar se a localização já existe (por nome, cidade e estado)
        const existingLocation = await prisma.location.findFirst({
          where: {
            name,
            city,
            state,
          },
        });

        const locationPayload = {
          name,
          city,
          state,
          type,
        };

        if (existingLocation) {
          // Atualizar localização existente
          await prisma.location.update({
            where: { id: existingLocation.id },
            data: locationPayload,
          });
        } else {
          // Criar nova localização
          await prisma.location.create({
            data: locationPayload,
          });
        }

        results.success++;
      } catch (error: any) {
        results.errors.push({
          location: locationData.name || 'unknown',
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error importing locations CSV:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
