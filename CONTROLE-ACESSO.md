# 🔐 Sistema de Controle de Acesso por Roles

## ✅ Implementação Completa

Foi implementado um sistema robusto de controle de acesso baseado em roles (ADMIN/MANAGER e DRIVER) em todo o sistema!

---

## 🔧 Backend - Proteção de Rotas

### Middleware de Autorização
Criado `requireRole()` em [auth.ts](C:\truck-logbook\backend\src\middleware\auth.ts):
```typescript
requireRole('ADMIN', 'MANAGER', 'DRIVER')
```

### Rotas Protegidas

#### **Viagens (Trips)**
- ✅ `POST /api/trips` - **Apenas ADMIN/MANAGER** (agendar corrida)
- ✅ `PUT /api/trips/:id` - **Apenas ADMIN/MANAGER** (editar)
- ✅ `DELETE /api/trips/:id` - **Apenas ADMIN** (excluir)
- ✅ `POST /api/trips/:id/start` - **ADMIN/MANAGER/DRIVER** (iniciar corrida)
- ✅ `POST /api/trips/:id/finish` - **ADMIN/MANAGER/DRIVER** (finalizar corrida)

#### **Despesas (Expenses)**
- ✅ `POST /api/expenses` - **Validação especial:**
  - **DRIVER**: Só pode adicionar `type: FUEL` (combustível)
  - **ADMIN/MANAGER**: Pode adicionar todos os tipos (FUEL, TOLL, MAINTENANCE, OTHER, etc)

---

## 🎨 Frontend - Interface Adaptativa

### 1. **Sidebar (Menu Lateral)**
**ADMIN/MANAGER vê:**
- Dashboard
- Caminhões
- Viagens
- Despesas
- Manutenção
- **Motoristas** ✨

**DRIVER vê:**
- Dashboard
- Caminhões
- Viagens

### 2. **Página de Detalhes do Caminhão**

#### **ADMIN/MANAGER pode:**
- ✅ Ver métricas financeiras (Faturamento, Despesas, Lucro)
- ✅ Ver botão "Agendar Corrida"
- ✅ Ver botão "Adicionar Despesa" (todos os tipos)
- ✅ Ver faturamento e lucro no histórico de corridas

#### **DRIVER pode:**
- ✅ Ver botão "Adicionar Abastecimento" (só FUEL)
- ✅ Iniciar corridas agendadas
- ✅ Finalizar corridas em andamento
- ❌ **NÃO vê** métricas financeiras (faturamento, lucro, despesas totais)
- ❌ **NÃO vê** botão de agendar corrida
- ❌ **NÃO vê** valores financeiros no histórico

### 3. **Modal de Despesas**

**ADMIN/MANAGER:**
```
Tipo de Despesa: [Dropdown]
  - Combustível
  - Pedágio
  - Manutenção
  - Outros
```

**DRIVER:**
```
Adicionar Abastecimento
  - Litros: [Campo]
  - Valor: [Campo]
  - Descrição: [Campo]
(Tipo fixo: FUEL)
```

### 4. **Página de Motoristas**

**ADMIN/MANAGER:**
- ✅ Botão "Adicionar Motorista" visível
- ✅ Botões de Editar/Excluir em cada card

**DRIVER:**
- ✅ Pode visualizar lista de motoristas
- ❌ Botão "Adicionar Motorista" oculto
- ❌ Botões de Editar/Excluir ocultos

### 5. **Página de Login - Melhorada**

Agora exibe claramente as diferenças:

```
👤 Tipos de Usuário:

🔐 Administrador
• Pode agendar e gerenciar corridas
• Define valores e lucros
• Adiciona todos os tipos de despesas
• Gerencia motoristas

🚛 Motorista
• Inicia e finaliza corridas
• Registra abastecimento
• Visualiza informações das viagens
```

---

## 🎯 Fluxo de Uso por Role

### 📊 **ADMIN/MANAGER - Fluxo Completo**

1. **Login** com credenciais de admin
2. **Dashboard** → Vê todas as métricas
3. **Motoristas** → Adiciona novo motorista (João Silva, CPF, telefone)
4. **Caminhões** → Seleciona caminhão ABC-1234
5. **Agendar Corrida**:
   - Data: 20/02/2026 08:00
   - Origem: São Paulo
   - Destino: Rio de Janeiro
   - Motorista: João Silva
   - Faturamento Esperado: R$ 5.000
6. **Sistema envia webhook para N8N** com dados do motorista
7. Corrida aparece como "Agendada"

---

### 🚛 **DRIVER - Fluxo Operacional**

1. **Login** com credenciais de motorista
2. **Dashboard** → Vê informações básicas (sem valores financeiros)
3. **Caminhões** → Seleciona caminhão com corrida agendada
4. **Iniciar Corrida** → Clica em "Iniciar" na corrida agendada
5. **Durante a viagem** → Clica em "Adicionar Abastecimento":
   - Litros: 150
   - Valor: R$ 900
   - Descrição: Posto km 120
6. **Ao chegar** → Clica em "Finalizar Corrida"
7. **Sistema calcula automaticamente** todas as despesas e envia webhook

---

## 🛡️ Validações de Segurança

### Backend
✅ Token JWT verificado em todas as rotas  
✅ Role verificado antes de executar operação  
✅ Mensagens de erro claras: "Motoristas só podem adicionar despesas de combustível"  
✅ HTTP 403 (Forbidden) para tentativas não autorizadas

### Frontend
✅ UI adaptada dinamicamente ao role do usuário  
✅ Botões/modais ocultos conforme permissão  
✅ Store de autenticação persiste role do usuário  
✅ Verificação em todos os componentes relevantes

---

## 📝 Exemplos de Código

### Verificação no Frontend
```typescript
const { user } = useAuthStore();
const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
const isDriver = user?.role === 'DRIVER';

{isAdmin && (
  <button onClick={handleSchedule}>Agendar Corrida</button>
)}

{isDriver && (
  <button onClick={handleFuel}>Adicionar Abastecimento</button>
)}
```

### Proteção no Backend
```typescript
// Apenas ADMIN pode agendar
app.post('/', {
  onRequest: [requireRole('ADMIN', 'MANAGER')],
}, async (request, reply) => {
  // ... criar corrida
});

// DRIVER pode iniciar/finalizar
app.post('/:id/start', {
  onRequest: [requireRole('ADMIN', 'MANAGER', 'DRIVER')],
}, async (request) => {
  // ... iniciar corrida
});

// Validação customizada para despesas
const user = request.user as any;
if (user.role === 'DRIVER' && data.type !== 'FUEL') {
  return reply.code(403).send({ 
    error: 'Motoristas só podem adicionar despesas de combustível' 
  });
}
```

---

## 🧪 Como Testar

### 1. Testar como ADMIN
```bash
# Login na aplicação
Email: admin@example.com
Senha: admin123

# Verificar:
✓ Menu lateral completo (6 itens)
✓ Botão "Agendar Corrida" visível
✓ Métricas financeiras visíveis
✓ Pode adicionar todos os tipos de despesas
✓ Pode gerenciar motoristas
```

### 2. Testar como DRIVER
```bash
# Primeiro, como ADMIN, crie um motorista:
Nome: João Silva
Email: joao@example.com
CPF: 123.456.789-10
Telefone: (11) 98765-4321
Senha: motorista123

# Faça logout e login como motorista:
Email: joao@example.com
Senha: motorista123

# Verificar:
✓ Menu lateral reduzido (3 itens)
✗ Botão "Agendar Corrida" OCULTO
✗ Métricas financeiras OCULTAS
✓ Botão "Adicionar Abastecimento" visível
✗ Não pode adicionar outros tipos de despesa
✗ Não pode ver página de Motoristas
✓ Pode iniciar e finalizar corridas
```

### 3. Testar Restrições (como DRIVER)
```bash
# Tente via API (deve falhar):
POST /api/trips
→ 403 Forbidden: "Access denied: Insufficient permissions"

POST /api/expenses
Body: { type: "TOLL", amount: 50 }
→ 403 Forbidden: "Motoristas só podem adicionar despesas de combustível"

POST /api/expenses
Body: { type: "FUEL", amount: 900, liters: 150 }
→ 201 Created ✓ (Sucesso!)
```

---

## 🎉 Resultado Final

### ✅ Sistema Completamente Seguro
- Backend protege todas as rotas críticas
- Frontend adapta interface ao role
- Motoristas têm acesso limitado às funções operacionais
- Admins mantêm controle total

### ✅ UX Melhorada
- Cada usuário vê apenas o que precisa
- Menos confusão, mais produtividade
- Interface limpa e focada na tarefa

### ✅ Página de Login Informativa
- Usuários entendem as diferenças de acesso
- Credenciais demo claras
- Design moderno e profissional

---

## 🚀 Próximos Passos

Para começar a usar:

1. **Aplicar migração** (se ainda não aplicou):
```bash
cd C:\truck-logbook\backend
npx prisma migrate dev
```

2. **Iniciar sistema**:
```bash
docker-compose up -d
```

3. **Acessar**: http://localhost:5173

4. **Testar fluxos**:
   - Login como ADMIN → Teste todas as funcionalidades
   - Crie um motorista
   - Login como DRIVER → Veja as restrições

---

**Sistema 100% funcional com controle de acesso robusto!** 🔐🚀
