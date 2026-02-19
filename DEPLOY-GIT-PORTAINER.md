# 🚀 Deploy via Git no Portainer Online

## Guia Completo para Deploy via Repositório Git

---

## 📋 Pré-requisitos

- ✅ Código no GitHub/GitLab (público ou privado)
- ✅ Portainer online rodando
- ✅ Postgres, Redis e NPM já configurados na sua VPS
- ✅ Domínio configurado via Cloudflare Tunnel

---

## 🔧 1️⃣ Preparar Repositório Git

### A) Estrutura de Arquivos

Certifique-se que tem:
```
truck-logbook/
├── backend/
│   ├── Dockerfile ✅
│   ├── package.json
│   ├── prisma/
│   └── src/
├── frontend/
│   ├── Dockerfile ✅
│   ├── package.json
│   └── src/
├── docker-compose.cloud.yml ✅ (arquivo criado)
└── .env.example
```

### B) Criar .env.example

```bash
# Database (use seu Postgres existente)
DATABASE_URL=postgresql://user:password@postgres:5432/truck_logbook

# Redis (use seu Redis existente)
REDIS_URL=redis://redis:6379

# JWT Secret (gere uma chave forte)
JWT_SECRET=sua-chave-secreta-aqui

# N8N Webhook
N8N_WEBHOOK_URL=https://n8n.seudominio.com/webhook/truck-logbook

# Frontend API URL (seu domínio)
VITE_API_URL=https://api-truck.seudominio.com
```

### C) Commit e Push

```powershell
git add .
git commit -m "Add cloud deployment config"
git push origin main
```

---

## 🌐 2️⃣ Descobrir Nome da Rede NPM

No seu Portainer online:

1. Menu → **Networks**
2. Procure a rede do seu Nginx Proxy Manager
   - Exemplos: `npm_default`, `nginx-proxy-manager_default`, `proxy`
3. **Anote o nome exato**

### Se não souber, descubra via terminal:

```bash
# SSH no seu servidor
docker network ls | grep npm
docker network ls | grep nginx
docker network ls | grep proxy
```

### Edite docker-compose.cloud.yml:

```yaml
networks:
  npm_default:  # ⚠️ SUBSTITUA pelo nome real da sua rede
    external: true
```

---

## 🗄️ 3️⃣ Preparar Database

### Criar database no seu Postgres existente:

**Opção A - Via DBeaver/pgAdmin:**
1. Conecte no seu Postgres
2. Execute: `CREATE DATABASE truck_logbook;`

**Opção B - Via Portainer Console:**
1. Containers → Seu container Postgres
2. Console → Connect → `/bin/sh`
3. Execute:
```bash
psql -U postgres
CREATE DATABASE truck_logbook;
\q
```

---

## 🚀 4️⃣ Configurar Stack no Portainer

### Passo 1: Criar Stack

1. Acesse seu Portainer: `https://seu-portainer.com`
2. Login
3. Selecione o **Environment** (servidor)
4. Menu → **Stacks**
5. Click **"+ Add stack"**

### Passo 2: Configurações Básicas

- **Name**: `truck-logbook`
- **Build method**: ⭐ Selecione **"Repository"**

### Passo 3: Configuração do Repositório

**Repository URL:**
```
https://github.com/seu-usuario/truck-logbook
```

**Repository reference:**
```
refs/heads/main
```
(ou `refs/heads/master` se usar master)

**Compose path:**
```
docker-compose.cloud.yml
```

### Passo 4: Autenticação (se repositório privado)

Se seu repo for privado:

1. ✅ Marque **"Authentication"**
2. **Username**: seu usuário GitHub/GitLab
3. **Personal Access Token**: 
   - GitHub: Settings → Developer settings → Personal access tokens → Generate
   - GitLab: Settings → Access Tokens

### Passo 5: Environment Variables

Scroll até **Environment variables** e adicione (click em **+ add** para cada):

```bash
# 1. Database (use o nome do seu container Postgres)
DATABASE_URL=postgresql://seu_user:sua_senha@postgres:5432/truck_logbook

# 2. Redis (use o nome do seu container Redis)
REDIS_URL=redis://redis:6379

# 3. JWT Secret (gere uma chave aleatória forte)
JWT_SECRET=gere-uma-string-bem-longa-aleatoria-123456789

# 4. N8N Webhook (seu domínio N8N)
N8N_WEBHOOK_URL=https://n8n.seudominio.com/webhook/truck-logbook

# 5. Frontend API URL (seu domínio para API)
VITE_API_URL=https://api-truck.seudominio.com
```

**💡 Dica:** Para gerar JWT_SECRET forte:
```powershell
# No PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### Passo 6: Deploy

1. ✅ (Opcional) Marque **"Enable auto update"** para deploy automático em push
2. Scroll até o final
3. Click **"Deploy the stack"**

---

## ⏱️ 5️⃣ Acompanhar Build

O Portainer vai:
1. 🔄 Clonar repositório do Git
2. 🔨 Build backend (3-5 min)
3. 🔨 Build frontend (2-3 min)
4. 🚀 Iniciar containers

**Acompanhe:**
- Stacks → truck-logbook → Ver logs na parte superior
- Se der erro, veja em **"Deployment logs"**

---

## 🗄️ 6️⃣ Executar Migrações

Após containers subirem (🟢 Running):

1. Menu → **Containers**
2. Click no container `truck-logbook-backend-1`
3. Tab **Console** → **Connect** → Escolha `/bin/sh`
4. Execute:

```bash
cd /app
npx prisma migrate deploy
npm run seed
exit
```

---

## 🌐 7️⃣ Configurar Nginx Proxy Manager

### A) Proxy Host para Backend API

1. Acesse seu NPM Admin
2. **Proxy Hosts** → **Add Proxy Host**
3. **Details:**
   - Domain Names: `api-truck.seudominio.com`
   - Scheme: `http`
   - Forward Hostname/IP: `truck-backend`
   - Forward Port: `4000`
   - ✅ Cache Assets
   - ✅ Block Common Exploits
   - ✅ Websockets Support

4. **SSL:**
   - SSL Certificate: Request new SSL
   - ✅ Force SSL
   - ✅ HTTP/2 Support
   - ✅ HSTS Enabled

5. **Save**

### B) Proxy Host para Frontend

1. **Add Proxy Host**
2. **Details:**
   - Domain Names: `truck.seudominio.com`
   - Scheme: `http`
   - Forward Hostname/IP: `truck-frontend`
   - Forward Port: `80`
   - ✅ Cache Assets
   - ✅ Block Common Exploits
   - ✅ Websockets Support

3. **SSL:** (mesmo config do backend)
4. **Save**

---

## ☁️ 8️⃣ Configurar Cloudflare Tunnel

No Cloudflare Zero Trust:

1. Access → Tunnels → Seu tunnel
2. **Public Hostname** → Add a public hostname

**Backend:**
- Subdomain: `api-truck`
- Domain: `seudominio.com`
- Type: HTTP
- URL: `nginx-proxy-manager` (ou IP do NPM)

**Frontend:**
- Subdomain: `truck`
- Domain: `seudominio.com`
- Type: HTTP
- URL: `nginx-proxy-manager`

---

## ✅ 9️⃣ Verificar Funcionamento

### No Portainer:
```
Containers → Deve ver:
✅ truck-logbook-backend-1 (Running)
✅ truck-logbook-frontend-1 (Running)
```

### No Navegador:
```
https://truck.seudominio.com
Login: admin@example.com / admin123
```

### Testar API:
```bash
curl https://api-truck.seudominio.com/health
# Retorno esperado: {"status":"ok"}
```

---

## 🔄 10️⃣ Configurar Auto-Deploy (Webhook)

Para deploy automático ao fazer `git push`:

### A) Gerar Webhook no Portainer

1. Stacks → truck-logbook
2. Click no ícone ⚙️ (Settings)
3. Section **Webhooks**
4. Click **"Create a webhook"**
5. **Copie a URL** gerada (ex: `https://portainer.com/api/webhooks/xxx`)

### B) Configurar no GitHub

1. Seu repositório → **Settings**
2. **Webhooks** → **Add webhook**
3. **Payload URL**: Cole a URL do Portainer
4. **Content type**: `application/json`
5. **Which events**: ✅ Just the push event
6. **Active**: ✅ 
7. **Add webhook**

### C) Configurar no GitLab

1. Repositório → Settings → **Webhooks**
2. **URL**: Cole a URL do Portainer
3. **Trigger**: ✅ Push events
4. **Add webhook**

**🎉 Pronto!** Agora todo `git push` faz rebuild automático!

---

## 🔧 Troubleshooting

### ❌ "Cannot clone repository"

**Repositório privado sem auth:**
1. Stacks → truck-logbook → Editor
2. Marque ✅ Authentication
3. Adicione Username + Token
4. Update stack

### ❌ "Network not found: npm_default"

**Nome da rede errado:**
1. Descubra nome real: `docker network ls`
2. Edite docker-compose.cloud.yml no repositório
3. Ajuste linha da network
4. Git commit + push
5. Portainer vai rebuild automaticamente

### ❌ "Cannot connect to database"

**Container não está na rede do Postgres:**

**Opção A - Adicionar via Portainer:**
1. Containers → truck-backend
2. Duplicate/Edit
3. Network → Adicione rede do Postgres
4. Deploy

**Opção B - Ajustar docker-compose:**
```yaml
services:
  backend:
    networks:
      - npm_default
      - postgres_network  # Adicione a rede do Postgres
```

### ❌ Frontend não carrega API

**CORS não configurado:**

Adicione no backend:

```typescript
// backend/src/server.ts
import cors from '@fastify/cors';

await server.register(cors, {
  origin: [
    'https://truck.seudominio.com',
    'https://api-truck.seudominio.com'
  ],
  credentials: true
});
```

Commit + push → Auto-deploy via webhook

### ❌ VITE_API_URL undefined no build

**Variável não passou para Docker build:**

Verifique que no docker-compose.cloud.yml tem:
```yaml
frontend:
  build:
    args:
      - VITE_API_URL=${VITE_API_URL}  # ← Necessário!
```

E no Dockerfile frontend tem:
```dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
```

---

## 📊 Monitoramento

### Ver Logs de Deployment

Stacks → truck-logbook → **Deployment logs** (topo)

### Ver Logs dos Containers

Containers → Select container → **Logs** → ✅ Auto-refresh

### Métricas

Containers → Veja uso de CPU/RAM em tempo real

---

## 🔄 Workflow Completo

```
Desenvolvedor (PC Local)
   ↓
git push origin main
   ↓
GitHub/GitLab Repository
   ↓
Webhook dispara
   ↓
Portainer Online
   ↓
git clone + docker build (5-7 min)
   ↓
Containers Running
   ↓
Nginx Proxy Manager
   ↓
Cloudflare Tunnel
   ↓
Internet público
(https://truck.seudominio.com)
```

---

## 📋 Checklist Final

**Preparação:**
- [ ] docker-compose.cloud.yml criado
- [ ] Frontend Dockerfile aceita VITE_API_URL
- [ ] .env.example documentado
- [ ] Código commitado no Git
- [ ] Nome da rede NPM descoberto

**Portainer:**
- [ ] Stack criada via Repository
- [ ] URL do Git configurada
- [ ] Branch correta (refs/heads/main)
- [ ] Compose path: docker-compose.cloud.yml
- [ ] 5 Environment Variables configuradas
- [ ] Deploy concluído (5-7 min)

**Banco de Dados:**
- [ ] Database truck_logbook criada
- [ ] Migrações executadas (prisma migrate deploy)
- [ ] Seed executado (npm run seed)

**Proxy:**
- [ ] NPM: api-truck.seudominio.com → backend:4000
- [ ] NPM: truck.seudominio.com → frontend:80
- [ ] SSL configurado (Force SSL)
- [ ] Cloudflare Tunnel atualizado

**Testes:**
- [ ] https://truck.seudominio.com abre
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] CRUD caminhões/motoristas funciona
- [ ] API responde: curl api-truck.../health

**Auto-Deploy (Opcional):**
- [ ] Webhook criado no Portainer
- [ ] Webhook configurado no GitHub/GitLab
- [ ] Teste: git push → auto-deploy funciona

---

## 💡 Dicas Pro

### Multi-Environment

Use branches diferentes:
```yaml
# Stack dev
Repository reference: refs/heads/develop
Environment variables: use dev values

# Stack prod  
Repository reference: refs/heads/main
Environment variables: use prod values
```

### Rollback Rápido

Se deploy falhar:
1. Stacks → truck-logbook → Editor
2. Mude para commit anterior: `refs/heads/main~1`
3. Update stack

### Secrets Seguros

Use Portainer Secrets:
1. Secrets → Add secret: `jwt_secret`
2. No docker-compose:
```yaml
secrets:
  - jwt_secret
environment:
  - JWT_SECRET_FILE=/run/secrets/jwt_secret
```

---

## 🎯 Estrutura Final

```
GitHub Repository (seu-usuario/truck-logbook)
├── backend/
├── frontend/
└── docker-compose.cloud.yml

Portainer Stack (truck-logbook)
├── truck-backend (porta 4000)
└── truck-frontend (porta 80)

Infraestrutura Existente
├── Postgres (externo)
├── Redis (externo)
├── Nginx Proxy Manager
│   ├── api-truck.seudominio.com
│   └── truck.seudominio.com
└── Cloudflare Tunnel

Internet
└── https://truck.seudominio.com 🌍
```

---

**🎉 Deploy via Git configurado com sucesso!**

Agora é só desenvolver e dar `git push` → Aplicação atualiza automaticamente em 5-7 minutos! 🚀

---

## 📞 Próximos Passos

1. ✅ Teste todas as funcionalidades
2. 📊 Configure monitoramento (logs, alertas)
3. 💾 Configure backup automático do banco
4. 🔒 Revise configurações de segurança
5. 📈 Configure analytics (opcional)
6. 🚨 Configure alertas N8N

**Dúvidas? Me avise em qual passo precisa de ajuda!** 💬
