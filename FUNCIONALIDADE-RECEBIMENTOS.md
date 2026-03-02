# Sistema de Recebimentos - Documentação

## Funcionalidades Implementadas

### 1. Backend

#### Modelo de Dados (Prisma Schema)
- **Tabela `receivables`** com os seguintes campos:
  - `id`: Identificador único
  - `clientId`: Cliente associado (opcional)
  - `type`: Tipo de recebimento (Aluguel, Empréstimo, Serviço, etc)
  - `description`: Descrição detalhada
  - `amount`: Valor total da parcela
  - `paidAmount`: Valor já pago
  - `remainingAmount`: Valor restante a pagar
  - `phoneNumber`: Telefone para contato/cobrança
  - `dueDate`: Data de vencimento
  - `paymentDate`: Data do pagamento efetivo
  - `status`: Status do recebimento (PENDING, PARTIALLY_PAID, PAID, OVERDUE)
  - `isRecurring`: Se é recorrente
  - `installmentNumber`: Número da parcela
  - `totalInstallments`: Total de parcelas
  - `recurringGroupId`: ID do grupo de recorrência
  - `notificationSent`: Se foi enviada notificação
  - `lastNotificationDate`: Data da última notificação

#### Rotas da API (`/api/receivables`)
- **GET /api/receivables**: Listar recebimentos com filtros
  - Filtros: status, clientId, startDate, endDate, recurringGroupId
  - Atualiza automaticamente status de atrasados
  
- **GET /api/receivables/:id**: Obter um recebimento específico

- **POST /api/receivables**: Criar recebimento(s)
  - Cria um único recebimento ou múltiplas parcelas se recorrente
  - Gera automaticamente todas as parcelas com datas mensais
  
- **PUT /api/receivables/:id**: Atualizar recebimento
  - Não permite editar recebimentos já pagos
  
- **POST /api/receivables/:id/payment**: Registrar pagamento
  - Aceita pagamento parcial
  - Atualiza status automaticamente (PARTIALLY_PAID ou PAID)
  - Registra data de pagamento quando totalmente pago
  
- **DELETE /api/receivables/:id**: Excluir recebimento
  - Não permite excluir se já teve pagamentos
  
- **GET /api/receivables/summary/stats**: Estatísticas de recebimentos

#### Job de Notificações (`receivables-notification.job.ts`)
- **Execução**: Diariamente às 09:00
- **Função**: 
  - Busca recebimentos que vencem no dia
  - Filtra por status PENDING, PARTIALLY_PAID, OVERDUE
  - Envia notificação via webhook N8N com os dados:
    - `type`: 'receivable_due'
    - `receivableId`: ID do recebimento
    - `clientName`: Nome do cliente
    - `type_label`: Tipo do recebimento
    - `description`: Descrição
    - `amount`: Valor total
    - `remainingAmount`: Valor restante
    - `dueDate`: Data de vencimento
    - `status`: Status atual
    - `phoneNumber`: Número para contato
    - `installmentInfo`: Info da parcela (se recorrente)
  - Marca como notificado após envio
  - Atualiza status de recebimentos atrasados

#### Integração com Relatórios Financeiros
- Os recebimentos **PAGOS** ou **PARCIALMENTE PAGOS** são incluídos no relatório financeiro
- Aparecem como **INCOME** (receita)
- Usam o valor **paidAmount** (não o valor total)
- São somados ao **faturamento** e **lucro** do período

### 2. Frontend

#### Página de Recebimentos (`/receivables`)
**Funcionalidades:**

1. **Listagem de Recebimentos**
   - Cards coloridos por status:
     - PENDING: Azul
     - PARTIALLY_PAID: Laranja/Vermelho claro
     - OVERDUE: Vermelho
     - PAID: Verde
   - Exibe: descrição, tipo, cliente, parcela, vencimento, valores
   - Busca por descrição, tipo ou cliente
   - Filtro por status

2. **Formulário de Criação**
   - Campos:
     - Cliente (opcional, seleção)
     - Tipo (texto livre)
     - Descrição (textarea)
     - Valor
     - Telefone
     - Data de vencimento
     - Checkbox: Pagamento Recorrente
     - Número de Parcelas (se recorrente)
   - Validações:
     - Campos obrigatórios
     - Mínimo 2 parcelas se recorrente

3. **Pagamento de Recebimentos**
   - Modal para registrar pagamento
   - Mostra valor restante
   - Permite pagamento parcial
   - Feedback visual do status

4. **Status Visual**
   - Badges com ícones
   - Cores diferenciadas
   - Cards com borda colorida

#### Integração no Sistema
- Menu lateral: Item "Recebimentos" com ícone DollarSign
- Posicionado logo abaixo de "Relatórios"
- Acessível para ADMIN e MANAGER
- Rota: `/receivables`

### 3. Fluxo de Uso

#### Criando um Recebimento Simples
1. Acessar menu "Recebimentos"
2. Clicar em "Novo Recebimento"
3. Preencher dados (tipo, descrição, valor, vencimento)
4. Opcional: selecionar cliente e telefone
5. Salvar

#### Criando Recebimento Recorrente (Parcelado)
1. Acessar menu "Recebimentos"
2. Clicar em "Novo Recebimento"
3. Preencher dados básicos
4. Marcar "Pagamento Recorrente"
5. Informar número de parcelas (ex: 12)
6. Salvar
7. Sistema cria automaticamente todas as parcelas mensais

#### Registrando Pagamento
1. Na lista, clicar em "Concluir Pagamento" no card
2. Modal abre com valor restante
3. Digitar valor recebido
4. Confirmar
5. Status atualiza automaticamente:
   - Se valor = restante → PAID (verde)
   - Se valor < restante → PARTIALLY_PAID (vermelho claro)

#### Notificações Automáticas
- Sistema verifica diariamente às 09:00
- Para cada recebimento que vence hoje:
  - Envia dados para webhook N8N
  - N8N processa e envia WhatsApp
  - Sistema marca como notificado

### 4. Webhook N8N - Formato de Dados

```json
{
  "type": "receivable_due",
  "receivableId": "uuid",
  "clientName": "Nome do Cliente",
  "type_label": "Aluguel",
  "description": "Aluguel do galpão - Parcela 3/12",
  "amount": 5000.00,
  "remainingAmount": 5000.00,
  "dueDate": "2026-03-01",
  "status": "PENDING",
  "phoneNumber": "5511999999999",
  "installmentInfo": "Parcela 3/12"
}
```

### 5. Comandos para Deploy

#### Backend
```bash
cd c:\truck-logbook\backend

# Gerar migration
npx prisma migrate dev --name add_receivables

# Aplicar migration em produção
npx prisma migrate deploy

# Gerar client
npx prisma generate
```

#### Reiniciar Serviços
```bash
# Se usando Docker
docker-compose restart backend

# Ou rebuild
docker-compose up -d --build backend
```

### 6. Variáveis de Ambiente

Certifique-se de que o arquivo `.env` do backend contém:
```env
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/xxxxxxx
```

### 7. Testes Recomendados

1. **Criar recebimento simples**
   - Verificar criação no banco
   - Testar filtros

2. **Criar recebimento recorrente**
   - Verificar se criou todas as parcelas
   - Verificar datas de vencimento mensais
   - Verificar números de parcela

3. **Registrar pagamento total**
   - Verificar mudança de status para PAID
   - Verificar data de pagamento

4. **Registrar pagamento parcial**
   - Verificar status PARTIALLY_PAID
   - Verificar valores paidAmount e remainingAmount
   - Verificar card vermelho claro

5. **Testar notificações**
   - Aguardar horário 09:00 ou ajustar cron
   - Verificar logs do job
   - Verificar recebimento no N8N

6. **Testar relatório financeiro**
   - Criar e pagar recebimentos
   - Verificar inclusão no relatório
   - Verificar soma no lucro

### 8. Recursos Adicionais Implementados

- ✅ Atualização automática de status (PENDING → OVERDUE)
- ✅ Validações de negócio (não editar/excluir pagos)
- ✅ Suporte a múltiplas parcelas
- ✅ Pagamentos parciais com feedback visual
- ✅ Integração com clientes existentes
- ✅ Relatório financeiro integrado
- ✅ Notificações automáticas diárias
- ✅ Interface responsiva
- ✅ Filtros e busca
- ✅ Estatísticas de recebimentos

### 9. Melhorias Futuras Sugeridas

- [ ] Histórico de pagamentos por recebimento
- [ ] Anexar comprovantes de pagamento
- [ ] Relatório específico de recebimentos
- [ ] Dashboard com gráficos de recebimentos
- [ ] Envio manual de notificação
- [ ] Múltiplas formas de pagamento
- [ ] Juros e multa por atraso
- [ ] Desconto para pagamento antecipado
- [ ] Exportar lista de recebimentos (PDF/Excel)
- [ ] Notificações por email além de WhatsApp
