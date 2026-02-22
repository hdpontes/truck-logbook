import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

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

export default router;
