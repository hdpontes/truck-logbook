# 🚀 Guia Rápido de Comandos

## 🔧 Setup Inicial

### Windows
```bash
setup.bat
```

### Linux/Mac
```bash
chmod +x setup.sh
./setup.sh
```

## 📦 Instalação Manual

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edite .env com suas configurações
npx prisma generate
npx prisma migrate dev
npx prisma db seed  # Opcional - dados de exemplo
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# API_URL será http://localhost:4000 por padrão
```

## 🏃 Executar em Desenvolvimento

### Backend
```bash
cd backend
npm run dev
```
Servidor rodando em: http://localhost:4000

### Frontend
```bash
cd frontend
npm run dev
```
Aplicação rodando em: http://localhost:3000

## 🗄️ Comandos do Prisma

### Gerar Prisma Client
```bash
cd backend
npx prisma generate
```

### Criar Migration
```bash
cd backend
npx prisma migrate dev --name nome_da_migration
```

### Executar Migrations
```bash
cd backend
npx prisma migrate deploy
```

### Seed (Popular banco com dados)
```bash
cd backend
npx prisma db seed
```

### Prisma Studio (Interface visual do banco)
```bash
cd backend
npx prisma studio
```
Abre em: http://localhost:5555

### Reset do Banco (⚠️ CUIDADO - Apaga todos os dados)
```bash
cd backend
npx prisma migrate reset
```

## 🏗️ Build para Produção

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview  # Testar build localmente
```

## 🐳 Docker

### Build e Start
```bash
docker-compose -f docker-compose.cloud.yml up -d
```

### Parar Containers
```bash
docker-compose -f docker-compose.cloud.yml down
```

### Ver Logs
```bash
# Todos os serviços
docker-compose -f docker-compose.cloud.yml logs -f

# Backend apenas
docker-compose -f docker-compose.cloud.yml logs -f backend

# Frontend apenas
docker-compose -f docker-compose.cloud.yml logs -f frontend
```

### Rebuild
```bash
docker-compose -f docker-compose.cloud.yml up -d --build
```

## 🔍 Debug e Testes

### Ver Logs do Backend
```bash
cd backend
npm run dev
```

### Testar Endpoint da API
```bash
# Health check
curl http://localhost:4000/health

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@truck.com","password":"admin123"}'

# Listar caminhões (precisa do token)
curl http://localhost:4000/api/trucks \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## 🔑 Credenciais Padrão

Após executar `prisma db seed`:

- **Email:** admin@truck.com
- **Senha:** admin123
- **Role:** ADMIN

## 📝 Git

### Commit Inicial
```bash
git add .
git commit -m "feat: implementação completa com todas as correções"
git push origin main
```

### Verificar Status
```bash
git status
```

### Ver Mudanças
```bash
git diff
```

## 🛠️ Troubleshooting

### Problema: Erro de módulo não encontrado
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Problema: Prisma Client desatualizado
```bash
cd backend
npx prisma generate
```

### Problema: Migrations falhando
```bash
cd backend
npx prisma migrate reset  # ⚠️ Apaga dados
npx prisma migrate dev
npx prisma db seed
```

### Problema: Porta já em uso
```bash
# Windows
netstat -ano | findstr :4000
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :4000
lsof -i :3000

# Matar processo (substitua PID)
# Windows
taskkill /PID <PID> /F

# Linux/Mac
kill -9 <PID>
```

## 📊 Monitoramento

### Health Check
```bash
curl http://localhost:4000/health
```

### Verificar Conexão com Banco
```bash
cd backend
npx prisma db pull
```

## 🔄 Atualizar Dependências

### Backend
```bash
cd backend
npm update
npm audit fix
```

### Frontend
```bash
cd frontend
npm update
npm audit fix
```

## 📤 Deploy

### Preparar para Deploy
1. Configure variáveis de ambiente
2. Execute migrations
3. Build dos projetos
4. Teste localmente
5. Deploy!

### Variáveis de Ambiente Importantes

**Backend (.env):**
- `DATABASE_URL` - String de conexão do PostgreSQL
- `JWT_SECRET` - Chave secreta para JWT
- `N8N_WEBHOOK_URL` - URL do N8N (opcional)
- `CORS_ORIGIN` - URL do frontend

**Frontend (.env):**
- `VITE_API_URL` - URL da API backend

## 🎯 Endpoints Principais

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `GET /api/auth/me` - Usuário atual

### Trucks
- `GET /api/trucks` - Listar
- `GET /api/trucks/:id` - Detalhes
- `POST /api/trucks` - Criar
- `PUT /api/trucks/:id` - Atualizar
- `DELETE /api/trucks/:id` - Deletar

### Trips
- `GET /api/trips` - Listar
- `POST /api/trips` - Agendar
- `POST /api/trips/:id/start` - Iniciar
- `POST /api/trips/:id/finish` - Finalizar

### Expenses
- `GET /api/expenses` - Listar
- `POST /api/expenses` - Criar

### Drivers
- `GET /api/drivers` - Listar
- `POST /api/drivers` - Criar

### Maintenance
- `GET /api/maintenance` - Listar
- `POST /api/maintenance` - Criar

### Dashboard
- `GET /api/dashboard/stats` - Estatísticas
- `GET /api/dashboard/overview` - Visão geral

---

💡 **Dica:** Use `Ctrl+C` para parar os servidores em desenvolvimento.
