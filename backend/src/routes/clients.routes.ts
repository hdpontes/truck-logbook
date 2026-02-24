import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { convertToCSV, parseCSV } from '../utils/csv';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/clients - Listar todos os clientes
router.get('/', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
    });

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/clients/:id - Obter detalhes de um cliente
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/clients - Criar novo cliente
router.post('/', async (req, res) => {
  try {
    const { name, cnpj, address, city, state, phone, email } = req.body;

    if (!name || !cnpj || !address || !city || !state) {
      return res.status(400).json({ 
        message: 'Name, CNPJ, address, city and state are required' 
      });
    }

    const client = await prisma.client.create({
      data: {
        name,
        cnpj,
        address,
        city,
        state,
        phone,
        email,
      },
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/clients/:id - Atualizar cliente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cnpj, address, city, state, phone, email } = req.body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        name,
        cnpj,
        address,
        city,
        state,
        phone,
        email,
      },
    });

    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/clients/:id - Excluir cliente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.client.delete({
      where: { id },
    });

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/clients/export/csv - Exportar todos os clientes para CSV
router.get('/export/csv', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const csvData = clients.map(client => ({
      name: client.name,
      cnpj: client.cnpj,
      address: client.address,
      city: client.city,
      state: client.state,
      phone: client.phone || '',
      email: client.email || '',
    }));

    const csv = convertToCSV(csvData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=clientes.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting clients CSV:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/clients/import/csv - Importar clientes do CSV
router.post('/import/csv', async (req, res) => {
  try {
    const { csvData } = req.body;

    if (!csvData) {
      return res.status(400).json({ message: 'CSV data is required' });
    }

    const clients = parseCSV(csvData);
    
    console.log('📊 CSV parsed:', clients.length, 'clients');
    console.log('📋 Sample client:', clients[0]);

    if (!clients || clients.length === 0) {
      return res.status(400).json({ message: 'No valid data in CSV' });
    }

    const results = {
      success: 0,
      errors: [] as Array<{ cnpj: string; error: string }>,
    };

    for (const clientData of clients) {
      try {
        const { name, cnpj, address, city, state, phone, email } = clientData;

        console.log('🔍 Processing client:', { name, cnpj, city, state });

        if (!name || !cnpj || !address || !city || !state) {
          console.log('❌ Missing required fields:', { name: !!name, cnpj: !!cnpj, address: !!address, city: !!city, state: !!state });
          results.errors.push({
            cnpj: cnpj || 'unknown',
            error: 'Name, CNPJ, address, city and state are required',
          });
          continue;
        }

        // Verificar se o cliente já existe
        const existingClient = await prisma.client.findUnique({
          where: { cnpj },
        });

        const clientPayload = {
          name,
          cnpj: String(cnpj),
          address,
          city,
          state,
          phone: phone ? String(phone) : null,
          email: email || null,
        };

        if (existingClient) {
          console.log('🔄 Updating existing client:', cnpj);
          // Atualizar cliente existente
          await prisma.client.update({
            where: { cnpj },
            data: clientPayload,
          });
        } else {
          console.log('✨ Creating new client:', cnpj);
          // Criar novo cliente
          await prisma.client.create({
            data: clientPayload,
          });
        }

        results.success++;
      } catch (error: any) {
        console.error('❌ Error processing client:', error);
        results.errors.push({
          cnpj: clientData.cnpj || 'unknown',
          error: error.message || 'Unknown error',
        });
      }
    }

    console.log('✅ Import finished:', results);
    res.json(results);
  } catch (error) {
    console.error('Error importing clients CSV:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
