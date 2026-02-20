# 🚛 Truck Logbook - Sistema de Gestão de Frotas

Sistema completo de gestão de frotas de caminhões com **controle de acesso baseado em roles** (ADMIN/MANAGER e DRIVER).

> ✅ **Projeto Revisado e Corrigido** - Todas as funcionalidades implementadas e testadas. Veja [CORRECOES.md](./CORRECOES.md) para detalhes.

## 🚀 Quick Start

### Opção 1: Setup Automatizado

**Windows:**
```bash
setup.bat
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### Opção 2: Setup Manual

Veja instruções detalhadas em [COMO-INICIAR.md](./COMO-INICIAR.md)

## 🎯 Funcionalidades Principais

### 🔐 Sistema de Roles
- **Administrador/Gerente**: Controle completo - agendar corridas, definir valores, gerenciar motoristas, ver métricas financeiras
- **Motorista**: Acesso operacional - iniciar/finalizar corridas, registrar abastecimento

### 📊 Gestão Completa
- ✅ **Caminhões**: Cadastro com métricas de desempenho
- ✅ **Motoristas**: Gestão com CPF e telefone
- ✅ **Viagens**: Agendamento, início, finalização com cálculo automático de custos
- ✅ **Despesas**: Controle por tipo (combustível, pedágio, manutenção, etc)
- ✅ **Manutenção**: Agendamento e histórico
- ✅ **Dashboard**: Métricas e indicadores em tempo real

### 🔔 Integração N8N
- Webhooks automáticos para notificações:
  - Corrida agendada (com dados do motorista para envio de SMS/WhatsApp)
  - Corrida finalizada
  - Despesa alta
  - Lucro baixo
  - Manutenção programada

## 📚 Documentação

- **[CORRECOES.md](./CORRECOES.md)** - ✅ Lista completa de correções implementadas
- **[CONTROLE-ACESSO.md](./CONTROLE-ACESSO.md)** - Sistema de roles e permissões
- **[FUNCIONALIDADES-IMPLEMENTADAS.md](./FUNCIONALIDADES-IMPLEMENTADAS.md)** - Detalhamento técnico completo
- **[GUIA-TESTE.md](./GUIA-TESTE.md)** - Como testar todas as funcionalidades
- **[COMO-INICIAR.md](./COMO-INICIAR.md)** - Guia de inicialização

## 🚀 Tecnologias

- **Frontend**: React 18 + Vite + TailwindCSS + Shadcn/UI
- **Backend**: Fastify + Prisma + PostgreSQL
- **Mobile**: React Native (futuro)
- **Automação**: N8N
- **Infraestrutura**: Docker + Docker Compose
- **Cache**: Redis

## 📋 Funcionalidades

- ✅ Cadastro e gestão de caminhões
- ✅ Registro de viagens com origem/destino
- ✅ Controle de despesas (combustível, pedágio, manutenção)
- ✅ Cálculo automático de lucro por viagem
- ✅ Dashboard com métricas em tempo real
- ✅ Relatórios e gráficos interativos
- ✅ Sistema de alertas via N8N
- ✅ Gestão de manutenção preventiva

## 🏗️ Estrutura do Projeto

```
truck-logbook/
├── frontend/          # Aplicação React
├── backend/           # API Fastify
├── docker-compose.yml # Orquestração dos serviços
└── n8n-workflows/     # Automações N8N
```

## 🐳 Como Executar

```bash
# Subir todos os serviços
docker-compose up -d

# Acessar aplicações
Frontend: http://localhost:3000
Backend: http://localhost:4000
N8N: http://localhost:5678
```

## 📊 Acesso Padrão

- **N8N**: admin / admin123
- **PostgreSQL**: postgres / postgres123

## 🔧 Desenvolvimento Local

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## 📝 Licença

MIT
