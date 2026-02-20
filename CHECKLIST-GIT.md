# ✅ Checklist para Git Commit

Use este checklist antes de fazer commit das correções.

## 📋 Antes de Commitar

### ✅ Verificações de Código

- [ ] Todas as dependências estão listadas no `package.json`
- [ ] Não há `console.log` desnecessários em código de produção
- [ ] Código formatado e sem erros de lint
- [ ] Arquivos `.env` **NÃO** estão sendo commitados (apenas `.env.example`)

### ✅ Arquivos Sensíveis

Certifique-se que estes arquivos **NÃO** estão no commit:

- [ ] `backend/.env`
- [ ] `frontend/.env`
- [ ] `.env`
- [ ] `backend/node_modules/`
- [ ] `frontend/node_modules/`
- [ ] `backend/dist/`
- [ ] `frontend/dist/`
- [ ] Arquivos de upload (`backend/uploads/`)

### ✅ Arquivos que DEVEM estar no commit:

- [x] `backend/.env.example`
- [x] `frontend/.env.example`
- [x] `.env.example`
- [x] `backend/.gitignore`
- [x] `frontend/.gitignore`
- [x] `.gitignore`
- [x] `CORRECOES.md`
- [x] `COMANDOS.md`
- [x] `setup.sh`
- [x] `setup.bat`
- [x] Todas as rotas novas (`backend/src/routes/*`)
- [x] Middleware de auth (`backend/src/middleware/auth.ts`)
- [x] Arquivos corrigidos

## 🔍 Verificar Mudanças

```bash
git status
```

Revise a lista de arquivos modificados:
- ✅ Verde = arquivos que serão commitados
- ❌ Vermelho = arquivos não rastreados

## 📦 Adicionar Arquivos

### Adicionar tudo (CUIDADO!)
```bash
git add .
```

### Ou adicionar seletivamente
```bash
# Backend
git add backend/src/
git add backend/package.json
git add backend/.env.example
git add backend/.gitignore
git add backend/prisma/seed.ts

# Frontend
git add frontend/src/
git add frontend/.env.example
git add frontend/.gitignore

# Root
git add .env.example
git add .gitignore
git add CORRECOES.md
git add COMANDOS.md
git add CHECKLIST-GIT.md
git add setup.sh
git add setup.bat
git add README.md
```

## 📝 Fazer Commit

### Mensagem de Commit Sugerida

```bash
git commit -m "feat: implementação completa do sistema com todas as correções

✅ Backend:
- Corrigido bcrypt no seed.ts
- Implementadas todas as rotas (trucks, trips, expenses, drivers, maintenance, dashboard)
- Criado middleware de autenticação
- Adicionado axios para webhooks
- Melhorias de segurança (JWT, validações)

✅ Frontend:
- Consolidada API (removida duplicação)
- Corrigida navegação após login
- Integração com todas as rotas do backend

✅ Configuração:
- Criados arquivos .env.example
- Scripts de setup automatizado (setup.sh e setup.bat)
- Arquivos .gitignore configurados
- Documentação completa (CORRECOES.md, COMANDOS.md)

✅ Deploy:
- Docker configurado (docker-compose.cloud.yml)
- Suporte para Traefik e SSL
- Variáveis de ambiente documentadas

Ref: Correção de todos os problemas identificados na análise"
```

### Ou mensagem curta
```bash
git commit -m "feat: implementação completa com todas as correções do sistema"
```

## 🚀 Push para Repositório

```bash
# Push para branch atual
git push origin main

# Ou se estiver em outra branch
git push origin nome-da-branch
```

## 🔄 Se algo der errado

### Desfazer último commit (mantendo mudanças)
```bash
git reset --soft HEAD~1
```

### Desfazer mudanças não commitadas
```bash
git checkout -- arquivo.txt
```

### Ver diferenças antes de commitar
```bash
git diff
```

## 📊 Após o Commit

### Verificar histórico
```bash
git log --oneline
```

### Ver último commit
```bash
git show
```

### Criar tag de versão (opcional)
```bash
git tag -a v1.0.0 -m "Versão 1.0.0 - Sistema completo"
git push origin v1.0.0
```

## 🎯 Checklist Final

Antes de fazer push:

- [ ] Todas as mudanças estão commitadas
- [ ] Mensagem de commit é clara e descritiva
- [ ] Não há arquivos sensíveis (`.env`) no commit
- [ ] Código foi testado localmente
- [ ] Arquivos `.env.example` estão atualizados
- [ ] Documentação está completa

## 💡 Dicas

1. **Sempre revise antes de commitar:**
   ```bash
   git diff --staged
   ```

2. **Commite em partes menores quando possível:**
   - Não misture features diferentes no mesmo commit
   - Use commits atômicos (uma mudança por commit)

3. **Use branches para features:**
   ```bash
   git checkout -b feature/nome-da-feature
   ```

4. **Mantenha commits limpos:**
   - Evite commits com "WIP" ou "teste"
   - Use mensagens descritivas

## 🔐 Segurança

### ⚠️ NUNCA commite:
- Senhas ou chaves API
- Arquivos `.env`
- `node_modules/`
- Arquivos de build (`dist/`, `build/`)
- Tokens de autenticação
- Dados sensíveis de usuários

### ✅ SEMPRE commite:
- Código fonte
- Arquivos `.env.example`
- Documentação
- Arquivos de configuração (sem dados sensíveis)
- Tests

---

**Pronto para commitar? Execute:**

```bash
# 1. Verificar mudanças
git status

# 2. Adicionar arquivos
git add .

# 3. Commitar
git commit -m "sua mensagem aqui"

# 4. Push
git push origin main
```

🎉 **Boa sorte com seu commit!**
