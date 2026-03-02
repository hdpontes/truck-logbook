# Guia Rápido de Teste - Recebimentos

## Pré-requisitos
1. Backend rodando
2. Frontend rodando
3. Migration aplicada
4. Usuário ADMIN ou MANAGER logado

## Teste 1: Criar Recebimento Simples ✅

1. Acesse o menu lateral e clique em **"Recebimentos"** (abaixo de Relatórios)
2. Clique em **"Novo Recebimento"**
3. Preencha:
   - **Tipo**: Aluguel
   - **Descrição**: Aluguel do galpão comercial
   - **Valor**: 5000
   - **Telefone**: (11) 99999-9999
   - **Data de Vencimento**: Hoje ou amanhã
   - **Pagamento Recorrente**: NÃO marcar
4. Clique em **"Criar Recebimento"**
5. ✅ Deve aparecer um card azul com status "Pendente"

## Teste 2: Criar Recebimento Recorrente (Parcelado) ✅

1. Clique em **"Novo Recebimento"**
2. Preencha:
   - **Cliente**: Selecione um cliente existente
   - **Tipo**: Empréstimo
   - **Descrição**: Empréstimo para capital de giro
   - **Valor**: 1000
   - **Telefone**: (11) 88888-8888
   - **Data de Vencimento**: 01/04/2026
   - **Pagamento Recorrente**: ✅ MARCAR
   - **Número de Parcelas**: 12
3. Clique em **"Criar Recebimentos"**
4. ✅ Devem aparecer 12 cards, cada um com:
   - "Parcela 1/12", "Parcela 2/12", etc.
   - Datas de vencimento mensais (abril, maio, junho...)
   - Todos com status "Pendente"

## Teste 3: Pagamento Total ✅

1. Localize um recebimento com status "Pendente"
2. Clique em **"Concluir Pagamento"**
3. Modal abre mostrando o valor restante
4. O campo já vem preenchido com o valor total
5. Clique em **"Confirmar Pagamento"**
6. ✅ Card deve ficar:
   - Verde na borda esquerda
   - Status "Pago"
   - Mostrar data de pagamento
   - Botão "Concluir Pagamento" desaparece

## Teste 4: Pagamento Parcial ✅

1. Localize um recebimento com status "Pendente" (valor 5000)
2. Clique em **"Concluir Pagamento"**
3. Altere o valor de 5000 para **3000** (pagamento parcial)
4. Clique em **"Confirmar Pagamento"**
5. ✅ Card deve ficar:
   - Vermelho claro (borda laranja)
   - Status "Pago Parcialmente"
   - Mostrar: "Pago: R$ 3.000,00" e "Restante: R$ 2.000,00"
   - Botão "Concluir Pagamento" ainda visível

6. Clique novamente em **"Concluir Pagamento"**
7. Pague os R$ 2.000,00 restantes
8. ✅ Agora deve ficar verde com status "Pago"

## Teste 5: Recebimento Atrasado ✅

1. Crie um recebimento com data de vencimento **passada** (ex: 01/02/2026)
2. Ao atualizar a página ou após algum tempo
3. ✅ Card deve ficar:
   - Vermelho (borda vermelha escura)
   - Status "Atrasado"
   - Fundo vermelho claro

## Teste 6: Filtros ✅

1. Na barra de busca, digite "Aluguel"
2. ✅ Deve mostrar apenas recebimentos com "Aluguel" no tipo ou descrição

3. No dropdown de status, selecione "Pago"
4. ✅ Deve mostrar apenas recebimentos pagos

5. Selecione "Pendente"
6. ✅ Deve mostrar apenas pendentes

7. Selecione "Todos os Status"
8. ✅ Volta a mostrar todos

## Teste 7: Validações ✅

### 7.1 Campos obrigatórios
1. Clique em "Novo Recebimento"
2. Tente salvar sem preencher nada
3. ✅ Deve mostrar mensagem de erro

### 7.2 Parcelas mínimas
1. Marque "Pagamento Recorrente"
2. Coloque 1 ou 0 parcelas
3. Tente salvar
4. ✅ Deve mostrar erro "informe no mínimo 2 parcelas"

### 7.3 Não pode excluir pago
1. Tente excluir um recebimento que já teve pagamento
2. ✅ Deve dar erro (implementar botão de exclusão se necessário)

## Teste 8: Relatório Financeiro ✅

1. Pague alguns recebimentos (totalmente ou parcialmente)
2. Vá em **"Relatórios"**
3. Selecione o período que inclua os pagamentos
4. Clique em **"Gerar Relatório"**
5. ✅ Deve aparecer:
   - Recebimentos pagos na lista como "RECEITA"
   - Valores somados no faturamento total
   - Contribuindo para o lucro

## Teste 9: Notificações WhatsApp 📱

**Pré-requisito**: N8N_WEBHOOK_URL configurado no .env do backend

### Opção A: Aguardar horário (09:00)
1. Crie recebimentos com vencimento para hoje
2. Aguarde até 09:00 da manhã
3. ✅ Verifique logs do backend
4. ✅ Verifique webhook no N8N recebendo dados

### Opção B: Testar manualmente
1. Altere o cron no arquivo `receivables-notification.job.ts`
2. Mude de `'0 9 * * *'` para `'* * * * *'` (executa a cada minuto)
3. Reinicie o backend
4. Aguarde 1 minuto
5. ✅ Verifique logs e webhook

### Dados esperados no webhook:
```json
{
  "type": "receivable_due",
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

## Teste 10: Interface Responsiva 📱

1. Reduza o tamanho da janela do navegador
2. ✅ Layout deve se adaptar
3. ✅ Formulário deve empilhar campos
4. ✅ Cards devem ficar em coluna única
5. ✅ Botões devem permanecer clicáveis

## Checklist Final ✅

- [ ] Recebimento simples criado com sucesso
- [ ] Recebimento recorrente cria múltiplas parcelas
- [ ] Parcelas têm datas mensais corretas
- [ ] Pagamento total marca como "Pago"
- [ ] Pagamento parcial marca como "Pago Parcialmente"
- [ ] Card vermelho para pagamento parcial
- [ ] Segundo pagamento completa e fica verde
- [ ] Recebimentos atrasados ficam vermelhos
- [ ] Filtros funcionam corretamente
- [ ] Busca funciona
- [ ] Validações impedem dados inválidos
- [ ] Relatório financeiro inclui recebimentos
- [ ] Notificações são enviadas (se configurado)
- [ ] Interface responsiva

## Problemas Comuns

### Erro: "Cannot find module '@prisma/client'"
**Solução**: Execute `npx prisma generate` no backend

### Erro: "Table 'receivables' doesn't exist"
**Solução**: Execute a migration com `npx prisma migrate dev`

### Recebimentos não aparecem no relatório
**Verifique**: Apenas recebimentos **PAGOS** ou **PARCIALMENTE_PAGOS** aparecem

### Notificações não enviam
**Verifique**: 
1. N8N_WEBHOOK_URL está configurado no .env
2. Backend foi reiniciado após configurar
3. Horário está correto (09:00 ou alterado para teste)
4. Recebimento tem `notificationSent: false`

### Cards não mudam de cor
**Verifique**: 
1. Frontend foi recompilado
2. Cache do navegador (Ctrl+Shift+R para limpar)
3. Status do recebimento no banco de dados

## Comandos Úteis

### Ver recebimentos no banco
```sql
SELECT * FROM receivables ORDER BY dueDate DESC;
```

### Ver logs do job
Verifique o console do backend às 09:00 ou quando o cron executar

### Resetar notificações
```sql
UPDATE receivables 
SET notificationSent = false, lastNotificationDate = NULL 
WHERE dueDate = CURRENT_DATE;
```

### Limpar recebimentos de teste
```sql
DELETE FROM receivables WHERE description LIKE '%teste%';
```
