# 🚀 Deploy via Git + Portainer - Sistema de Recebimentos

## 📋 Visão Geral

Este guia é para deploy do Sistema de Recebimentos usando **Git + Portainer**.

---

## 🔄 Processo de Deploy

### 1️⃣ Commit e Push para Git

```bash
# Na pasta do projeto
cd c:\truck-logbook

# Adicionar todos os arquivos
git add .

# Commit
git commit -m "feat: Implementar sistema de recebimentos completo"

# Push para o repositório
git push origin main
# ou
git push origin master
```

### 2️⃣ Atualizar no Portainer

#### Opção A: Webhook (Recomendado)
Se você configurou webhook no Portainer:

1. Acesse o webhook configurado ou
2. O Portainer puxa automaticamente após o push

#### Opção B: Atualização Manual
1. Acesse o Portainer
2. Vá em **Stacks** ou **Services**
3. Selecione o stack do Truck Logbook
4. Clique em **Pull and Redeploy** ou **Update**
5. Aguarde o rebuild dos containers

### 3️⃣ Aplicar Migration no Container

Após o container backend estar rodando:

```bash
# Via Portainer Console (recomendado)
1. Acesse Portainer
2. Vá em Containers
3. Selecione o container do backend
4. Clique em "Console" ou "Exec Console"
5. Execute:

npx prisma migrate deploy
npx prisma generate
```

**OU via Docker CLI:**

```bash
# Encontrar o nome do container
docker ps | grep backend

# Executar migration no container
docker exec -it <container-name> npx prisma migrate deploy
docker exec -it <container-name> npx prisma generate
```

### 4️⃣ Reiniciar Containers (se necessário)

```bash
# Via Portainer
Containers → Backend → Restart

# Via Docker CLI
docker restart <backend-container-name>
```

---

## 📝 Checklist de Deploy

### Antes do Deploy
- [ ] Código testado localmente
- [ ] Backup do banco de dados realizado
- [ ] Variáveis de ambiente verificadas no Portainer
- [ ] `N8N_WEBHOOK_URL` configurada (opcional)

### Durante o Deploy
- [ ] Commit realizado
- [ ] Push para Git concluído
- [ ] Portainer atualizou o stack
- [ ] Containers recriados com sucesso
- [ ] Migration aplicada no container
- [ ] Logs verificados sem erros

### Após o Deploy
- [ ] Frontend acessível
- [ ] Menu "Recebimentos" visível
- [ ] Criou recebimento de teste
- [ ] Testou pagamento
- [ ] Verificou relatório financeiro

---

## 🔧 Comandos Úteis

### Ver logs do backend
```bash
# Via Portainer
Containers → Backend → Logs

# Via Docker CLI
docker logs -f <backend-container-name>
```

### Ver status da migration
```bash
docker exec -it <backend-container-name> npx prisma migrate status
```

### Acessar banco de dados
```bash
docker exec -it <backend-container-name> npx prisma studio
```

### Rollback (se necessário)
```bash
# Voltar para commit anterior
git revert HEAD
git push origin main

# Atualizar no Portainer
# (mesmo processo do deploy)
```

---

## 🐛 Troubleshooting

### Migration não aplicada
```bash
# Verificar migrations pendentes
docker exec -it <backend-container-name> npx prisma migrate status

# Aplicar manualmente
docker exec -it <backend-container-name> npx prisma migrate deploy
```

### Container não inicia
```bash
# Ver logs
docker logs <backend-container-name>

# Verificar se a imagem foi construída
docker images | grep truck-logbook

# Rebuild forçado no Portainer
Stack → Edit → Save & Redeploy
```

### Erro "Table doesn't exist"
```bash
# Migration não foi aplicada
docker exec -it <backend-container-name> npx prisma migrate deploy
```

---

## 📊 Estrutura de Arquivos Commitados

```
c:\truck-logbook\
├── backend/
│   ├── prisma/
│   │   └── schema.prisma                    ← Modificado
│   └── src/
│       ├── routes/
│       │   ├── receivables.routes.ts        ← Novo
│       │   └── reports.routes.ts            ← Modificado
│       ├── jobs/
│       │   └── receivables-notification.job.ts ← Novo
│       └── server.ts                        ← Modificado
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   └── ReceivablesPage.tsx          ← Novo
│       ├── components/
│       │   └── Sidebar.tsx                  ← Modificado
│       └── App.tsx                          ← Modificado
│
└── Documentação/
    ├── INDICE-RECEBIMENTOS.md
    ├── RESUMO-EXECUTIVO-RECEBIMENTOS.md
    ├── GUIA-TESTE-RECEBIMENTOS.md
    ├── FUNCIONALIDADE-RECEBIMENTOS.md
    ├── IMPLEMENTACAO-COMPLETA.md
    ├── RECEBIMENTOS-README.md
    ├── CHECKLIST-DEPLOY-RECEBIMENTOS.md
    └── DEPLOY-GIT-PORTAINER-RECEBIMENTOS.md ← Este arquivo
```

---

## 🎯 Fluxo Completo de Deploy

```
1. Desenvolvimento Local
   ├── Código implementado
   └── Testado localmente

2. Git
   ├── git add .
   ├── git commit -m "feat: recebimentos"
   └── git push origin main

3. Portainer
   ├── Detecta mudança (webhook ou manual)
   ├── Pull do repositório
   ├── Rebuild das imagens
   └── Restart dos containers

4. Migration
   ├── docker exec -it backend npx prisma migrate deploy
   └── docker exec -it backend npx prisma generate

5. Verificação
   ├── Logs sem erros
   ├── Frontend acessível
   ├── Funcionalidade testada
   └── ✅ Deploy concluído!
```

---

## 🔐 Variáveis de Ambiente

Certifique-se de que estas variáveis estão configuradas no Portainer:

```env
# Backend
DATABASE_URL=postgresql://user:password@db:5432/trucklogbook
JWT_SECRET=seu-secret-jwt
CORS_ORIGIN=https://seu-dominio.com
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/xxxxx  # Opcional
PORT=4000
```

### Como adicionar no Portainer:
1. Stacks → Truck Logbook Stack
2. Editor
3. Seção `environment:` do serviço backend
4. Adicionar: `- N8N_WEBHOOK_URL=https://...`
5. Save & Redeploy

---

## 📱 Teste Rápido Pós-Deploy

```bash
# 1. Verificar se backend está rodando
curl https://seu-dominio.com/api/health

# 2. Verificar rota de recebimentos
curl https://seu-dominio.com/api/receivables \
  -H "Authorization: Bearer SEU_TOKEN"

# 3. Acessar frontend
# https://seu-dominio.com/receivables
```

---

## 🎉 Deploy Concluído!

Quando todos os passos estiverem completos:

✅ Código no repositório Git  
✅ Portainer atualizou os containers  
✅ Migration aplicada  
✅ Sistema funcionando  
✅ Testes realizados  

**Sistema de Recebimentos em PRODUÇÃO! 🚀**

---

## 📞 Suporte

### Problemas Comuns

**"Migration não aplica automaticamente"**
→ Migrations devem ser aplicadas manualmente via `prisma migrate deploy` no container

**"Container fica reiniciando"**
→ Verifique logs: `docker logs <container-name>`
→ Provavelmente erro na migration ou variável de ambiente

**"Frontend não atualiza"**
→ Limpe cache: Ctrl+Shift+R
→ Verifique se Portainer rebuilou o container frontend

**"Webhook não funciona"**
→ Verifique `N8N_WEBHOOK_URL` no Portainer
→ Reinicie container backend após adicionar

---

## 📚 Documentação Relacionada

- [INDICE-RECEBIMENTOS.md](INDICE-RECEBIMENTOS.md) - Índice geral
- [GUIA-TESTE-RECEBIMENTOS.md](GUIA-TESTE-RECEBIMENTOS.md) - Como testar
- [IMPLEMENTACAO-COMPLETA.md](IMPLEMENTACAO-COMPLETA.md) - Detalhes técnicos

---

**Versão:** 1.0  
**Data:** 01/03/2026  
**Deploy Method:** Git + Portainer
