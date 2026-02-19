# 🚀 Guia de Inicialização - Truck Logbook

## 📋 Pré-requisitos

- Node.js 20+ e npm
- Docker e Docker Compose
- PostgreSQL (via Docker)
- Git

## 🔧 Configuração Inicial

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd truck-logbook
```

### 2. Configure o Backend

```bash
cd backend

# Copie o arquivo de exemplo
copy .env.example .env

# Edite o .env e configure:
# - N8N_WEBHOOK_URL com a URL do seu N8N
# - Outras variáveis conforme necessário

# Instale as dependências
npm install

# Gere o Prisma Client
npx prisma generate

# Execute as migrations
npx prisma migrate dev --name init
```

### 3. Configure o Frontend

```bash
cd ../frontend

# Copie o arquivo de exemplo
copy .env.example .env

# Instale as dependências
npm install
```

### 4. Inicie com Docker (Recomendado)

```bash
# Na raiz do projeto
docker-compose up -d
```

Isso iniciará:
- ✅ PostgreSQL na porta 5432
- ✅ Redis na porta 6379
- ✅ Backend na porta 4000
- ✅ Frontend na porta 3000

### 5. Ou inicie manualmente (Desenvolvimento)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 👤 Criar Usuário Inicial

### Opção 1: Via API (Postman/cURL)

```bash
# Windows PowerShell
Invoke-RestMethod -Uri "http://localhost:4000/api/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
    email = "admin@truck.com"
    password = "admin123"
    name = "Administrador"
    role = "ADMIN"
  } | ConvertTo-Json)
```

### Opção 2: Via Prisma Studio

```bash
cd backend
npx prisma studio
```

Acesse http://localhost:5555 e crie um usuário manualmente.

### Opção 3: Via seed script

Crie o arquivo `backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@truck.com' },
    update: {},
    create: {
      email: 'admin@truck.com',
      password: hashedPassword,
      name: 'Administrador',
      role: 'ADMIN',
    },
  });

  console.log({ admin });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Execute:
```bash
npx tsx prisma/seed.ts
```

## 🔗 Configure o N8N

1. Acesse seu N8N em outra VPS
2. Importe os workflows da pasta `n8n-workflows/`
3. Configure as credenciais (Telegram, Email)
4. Copie a URL do webhook e adicione no `.env` do backend:

```env
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/truck-logbook
```

Ver guia completo em: [n8n-workflows/GUIA-INTEGRACAO.md](n8n-workflows/GUIA-INTEGRACAO.md)

## ✅ Acessar a Aplicação

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000
- **API Docs**: http://localhost:4000/health

**Login:**
- Email: `admin@truck.com`
- Senha: `admin123`

## 🧪 Testar a Aplicação

### 1. Cadastrar um caminhão

POST http://localhost:4000/api/trucks
```json
{
  "plate": "ABC-1234",
  "model": "FH 540",
  "brand": "Volvo",
  "year": 2020,
  "capacity": 25,
  "avgConsumption": 2.5
}
```

### 2. Criar uma viagem

POST http://localhost:4000/api/trips
```json
{
  "truckId": "<id-do-caminhao>",
  "driverId": "<id-do-usuario>",
  "origin": "São Paulo",
  "destination": "Rio de Janeiro",
  "startDate": "2026-02-20T08:00:00Z",
  "distance": 450,
  "revenue": 8000,
  "status": "IN_PROGRESS"
}
```

### 3. Adicionar despesas

POST http://localhost:4000/api/expenses
```json
{
  "truckId": "<id-do-caminhao>",
  "tripId": "<id-da-viagem>",
  "type": "FUEL",
  "amount": 1200,
  "quantity": 400,
  "unitPrice": 3.00,
  "date": "2026-02-20T10:00:00Z"
}
```

## 📊 Verificar Notificações

Após criar uma viagem e marcá-la como concluída, você deve receber uma notificação no seu N8N configurado!

## 🐛 Troubleshooting

### Porta já em uso

```bash
# Ver qual processo está usando a porta
netstat -ano | findstr :4000
netstat -ano | findstr :3000

# Matar o processo (substitua <PID>)
taskkill /PID <PID> /F
```

### Erro de conexão com banco

1. Certifique-se que o PostgreSQL está rodando:
```bash
docker ps
```

2. Verifique a `DATABASE_URL` no `.env`

3. Tente recriar o banco:
```bash
npx prisma migrate reset
```

### Prisma Client não encontrado

```bash
npx prisma generate
```

### N8N não recebe webhooks

1. Verifique se a URL está correta no `.env`
2. Teste manualmente com curl/Postman
3. Veja os logs do backend para erros

## 📚 Próximos Passos

- [ ] Complete o desenvolvimento das páginas do frontend
- [ ] Adicione mais workflows no N8N
- [ ] Configure backup automático
- [ ] Adicione testes automatizados
- [ ] Configure CI/CD para deploy

## 🆘 Precisa de Ajuda?

- Veja os logs do backend: `docker logs truck-backend`
- Veja os logs do frontend: `docker logs truck-frontend`
- Verifique os workflows no N8N
- Consulte a documentação do Prisma: https://www.prisma.io/docs
