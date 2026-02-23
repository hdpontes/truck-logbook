import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/external/cnpj/:cnpj - Consultar CNPJ na Receita Federal
router.get('/cnpj/:cnpj', async (req, res) => {
  try {
    const { cnpj } = req.params;
    
    // Remove caracteres não numéricos
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
      return res.status(400).json({ message: 'CNPJ inválido. Deve conter 14 dígitos.' });
    }

    // Consulta na BrasilAPI
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      timeout: 10000,
    });

    const data = response.data;

    // Formatar resposta
    const formattedData = {
      cnpj: data.cnpj,
      name: data.razao_social || data.nome_fantasia,
      fantasyName: data.nome_fantasia,
      address: `${data.logradouro}, ${data.numero}${data.complemento ? ' - ' + data.complemento : ''}${data.bairro ? ' - ' + data.bairro : ''}`,
      city: data.municipio,
      state: data.uf,
      zipCode: data.cep,
      phone: data.ddd_telefone_1 || '',
      email: data.email || '',
      situation: data.descricao_situacao_cadastral,
      openingDate: data.data_inicio_atividade,
    };

    res.json(formattedData);
  } catch (error: any) {
    console.error('Erro ao consultar CNPJ:', error);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'CNPJ não encontrado na Receita Federal.' });
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ message: 'Tempo limite excedido ao consultar CNPJ. Tente novamente.' });
    }
    
    res.status(500).json({ message: 'Erro ao consultar CNPJ. Tente novamente mais tarde.' });
  }
});

// GET /api/external/cep/:cep - Consultar CEP
router.get('/cep/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    
    // Remove caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return res.status(400).json({ message: 'CEP inválido. Deve conter 8 dígitos.' });
    }

    // Consulta na BrasilAPI (alternativa: ViaCEP)
    const response = await axios.get(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, {
      timeout: 10000,
    });

    const data = response.data;

    // Formatar resposta
    const formattedData = {
      cep: data.cep,
      street: data.street,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      fullAddress: `${data.street}${data.neighborhood ? ', ' + data.neighborhood : ''}, ${data.city} - ${data.state}`,
    };

    res.json(formattedData);
  } catch (error: any) {
    console.error('Erro ao consultar CEP:', error);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'CEP não encontrado.' });
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ message: 'Tempo limite excedido ao consultar CEP. Tente novamente.' });
    }
    
    res.status(500).json({ message: 'Erro ao consultar CEP. Tente novamente mais tarde.' });
  }
});

export default router;
