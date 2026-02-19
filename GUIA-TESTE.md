# 🚀 Guia Rápido - Testando o Sistema

## Iniciando o Sistema

### Opção 1: Docker (Recomendado)
```bash
cd C:\truck-logbook
docker-compose up -d
```

### Opção 2: Manual
```bash
# Terminal 1 - Backend
cd C:\truck-logbook\backend
npm run dev

# Terminal 2 - Frontend  
cd C:\truck-logbook\frontend
npm run dev
```

## URLs de Acesso
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Login**: admin@example.com / admin123

## 🎯 Testando as Novas Funcionalidades

### 1️⃣ Testando Cadastro de Motoristas

1. Acesse http://localhost:5173 e faça login
2. No menu lateral, clique em **"Motoristas"**
3. Clique no botão **"Adicionar Motorista"**
4. Preencha:
   - Nome: João Silva
   - Email: joao.silva@example.com
   - CPF: 123.456.789-10 (formatação automática!)
   - Telefone: (11) 98765-4321 (formatação automática!)
   - Senha: motorista123
5. Clique em **"Criar"**
6. ✅ Motorista aparece na lista com suas informações

**Teste também:**
- Editar motorista (sem alterar senha)
- Tentar criar motorista com CPF duplicado (deve dar erro)

---

### 2️⃣ Testando Visualização de Caminhões

1. No menu lateral, clique em **"Caminhões"**
2. Você verá cards com todos os caminhões
3. Cada card mostra:
   - Placa, marca, modelo, ano
   - Quantidade de viagens, despesas e manutenções
   - Status (Ativo/Inativo)

**Dica**: Se não tiver caminhões, execute o seed:
```bash
cd C:\truck-logbook\backend
npm run seed
```

---

### 3️⃣ Testando Agendamento de Corrida

1. Na página **"Caminhões"**, clique em qualquer card
2. Você será direcionado para a página de detalhes
3. Clique no botão **"Agendar Corrida"** (azul, canto superior direito)
4. Preencha o formulário:
   - Data e Hora: Escolha uma data futura
   - Origem: São Paulo, SP
   - Destino: Rio de Janeiro, RJ
   - Motorista: Selecione "João Silva" (criado no passo 1)
   - Faturamento Esperado: 5000
5. Clique em **"Agendar"**
6. ✅ Corrida aparece na seção "Corridas Agendadas"
7. 🔔 **Webhook enviado para N8N** com dados do motorista!

**Verifique no console do backend:**
```
Webhook enviado: trip.scheduled
Motorista: João Silva
Telefone: (11) 98765-4321
Email: joao.silva@example.com
```

---

### 4️⃣ Testando Iniciar Corrida

1. Na mesma página de detalhes do caminhão
2. Na seção **"Corridas Agendadas"**, você verá a corrida que acabou de criar
3. Clique no botão **"Iniciar"** (verde)
4. ✅ A corrida desaparece de "agendadas"
5. ✅ Aparece uma seção destacada em verde: **"Corrida em Andamento"**
6. ✅ Status mudou de PLANNED para IN_PROGRESS

**Observação**: Só é possível ter 1 corrida ativa por vez por caminhão

---

### 5️⃣ Testando Adicionar Despesas

Durante a corrida, você pode adicionar despesas:

#### Despesa de Combustível:
1. Clique em **"Adicionar Despesa"** (vermelho, canto superior direito)
2. Selecione:
   - Tipo: Combustível
   - Litros: 180
   - Valor: 1080
   - Descrição: Abastecimento posto km 150
3. Clique em **"Adicionar"**
4. ✅ Despesa registrada e vinculada à corrida ativa

#### Despesa de Pedágio:
1. Clique novamente em **"Adicionar Despesa"**
2. Selecione:
   - Tipo: Pedágio
   - Valor: 95.50
   - Descrição: Pedagios SP-RJ
3. Clique em **"Adicionar"**

#### Outras Despesas:
1. Adicione mais uma despesa:
   - Tipo: Outros
   - Valor: 50
   - Descrição: Alimentação motorista
3. ✅ Total de despesas acumulando

---

### 6️⃣ Testando Finalizar Corrida

1. Quando o motorista concluir a viagem
2. Na seção **"Corrida em Andamento"**, clique em **"Finalizar Corrida"**
3. 🎯 **Sistema calcula automaticamente:**
   - Total de combustível: R$ 1.080,00
   - Total de pedágios: R$ 95,50
   - Outras despesas: R$ 50,00
   - **Total de custos: R$ 1.225,50**
   - **Receita: R$ 5.000,00**
   - **Lucro: R$ 3.774,50**
   - **Margem de lucro: 75,49%**
4. ✅ Corrida aparece no **"Histórico de Corridas"**
5. ✅ Status mudou para COMPLETED
6. 🔔 **Webhook enviado para N8N**: `trip.completed`

**Métricas atualizadas** nos cards do topo:
- Faturamento total aumentou
- Despesas totais aumentaram
- Lucro total aumentou
- Total de viagens aumentou

---

### 7️⃣ Testando Múltiplas Corridas

Teste o ciclo completo novamente:

1. Agendar nova corrida (diferente motorista ou rota)
2. Iniciar corrida
3. Adicionar várias despesas
4. Finalizar
5. Ver histórico crescendo

---

## 🧪 Cenários de Teste Importantes

### ✅ Validações que Funcionam:

1. **CPF Duplicado**: 
   - Tente criar dois motoristas com mesmo CPF
   - Sistema deve impedir

2. **Corrida Ativa Única**:
   - Tente iniciar 2 corridas agendadas do mesmo caminhão
   - Sistema só permite uma ativa

3. **Status da Corrida**:
   - Tente iniciar uma corrida já iniciada (não deve deixar)
   - Tente finalizar uma corrida ainda agendada (não deve deixar)

4. **Cálculo Automático**:
   - Adicione 5 despesas de combustível
   - Ao finalizar, soma deve estar correta
   - Lucro = Receita - Total Despesas

### 📊 Acompanhando os Webhooks

Se você configurou o N8N, verá os webhooks sendo recebidos:

**1. Ao agendar corrida:**
```json
{
  "event": "trip.scheduled",
  "data": {
    "driver": {
      "name": "João Silva",
      "email": "joao.silva@example.com", 
      "phone": "(11) 98765-4321"
    }
  }
}
```

**2. Ao finalizar corrida:**
```json
{
  "event": "trip.completed",
  "data": {
    "revenue": 5000,
    "totalCost": 1225.50,
    "profit": 3774.50,
    "profitMargin": 0.7549
  }
}
```

**3. Ao adicionar despesa alta (>= R$ 5.000):**
```json
{
  "event": "expense.high_value",
  "data": {
    "amount": 6000,
    "type": "MAINTENANCE"
  }
}
```

---

## 🎬 Fluxo Completo de Teste (10 minutos)

```
1. Login → admin@example.com / admin123
2. Motoristas → Adicionar "João Silva" com CPF e telefone
3. Caminhões → Selecionar um caminhão
4. Agendar Corrida → SP para RJ, R$ 5.000
5. Iniciar Corrida → Botão verde "Iniciar"
6. Adicionar Despesas → 
   - Combustível: R$ 1.080 (180L)
   - Pedágio: R$ 95,50
   - Outros: R$ 50
7. Finalizar Corrida → Ver cálculos automáticos
8. Verificar Histórico → Corrida aparece completa
9. Dashboard → Ver métricas atualizadas
```

---

## 🐛 Problemas Comuns

### Backend não inicia:
```bash
cd C:\truck-logbook\backend
npx prisma migrate dev
npx prisma generate
npm run dev
```

### Frontend dá erro de autenticação:
- Verifique se o backend está rodando na porta 3000
- Limpe localStorage do navegador (F12 → Application → Clear)
- Faça login novamente

### Não aparece nenhum caminhão:
```bash
cd C:\truck-logbook\backend
npm run seed
```

### N8N não recebe webhooks:
- Verifique o `.env` do backend
- Confirme que `N8N_WEBHOOK_URL` está correto
- Veja os logs do backend para confirmar envio

---

## 📱 Interface Mobile

O sistema é totalmente responsivo! Teste em:
- Desktop: Chrome, Firefox, Edge
- Tablet: iPad, Android tablets
- Mobile: iPhone, Android phones

Acesse pelo IP da sua máquina:
```
http://192.168.x.x:5173
```

---

## 🎉 Pronto!

Agora você pode:
- ✅ Gerenciar motoristas com CPF e telefone
- ✅ Visualizar caminhões em cards modernos
- ✅ Agendar corridas com notificações
- ✅ Iniciar e finalizar corridas
- ✅ Registrar despesas em tempo real
- ✅ Ver cálculos automáticos de lucro
- ✅ Acompanhar histórico completo
- ✅ Receber webhooks no N8N

**Divirta-se testando!** 🚀
