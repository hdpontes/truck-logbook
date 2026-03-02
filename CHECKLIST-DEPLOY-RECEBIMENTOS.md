# ✅ CHECKLIST - Deploy do Sistema de Recebimentos
## (Deploy via Git + Portainer)

## 📋 Pré-Deploy

### Backup
- [ ] Backup do banco de dados realizado
- [ ] Commit atual identificado para rollback
- [ ] Ponto de restauração anotado

### Documentação
- [ ] Leu: DEPLOY-GIT-PORTAINER-RECEBIMENTOS.md
- [ ] Leu: RESUMO-EXECUTIVO-RECEBIMENTOS.md
- [ ] Entendeu o fluxo do sistema
- [ ] Identificou dependências

---

## 🔧 Deploy via Git + Portainer

### Git - Commit e Push
- [ ] Navegou para pasta do projeto
- [ ] Executou: `git add .`
- [ ] Executou: `git commit -m "feat: Sistema de recebimentos"`
- [ ] Executou: `git push origin main` (ou master)
- [ ] Push concluído sem erros
- [ ] Commit visível no repositório remoto

### Portainer - Atualização
- [ ] Acessou Portainer
- [ ] Navegou até Stacks
- [ ] Selecionou stack do Truck Logbook
- [ ] Clicou em "Pull and Redeploy" (ou webhook acionado)
- [ ] Aguardou rebuild dos containers
- [ ] Containers recriados com sucesso
- [ ] Status: Running (verde)

### Migration - Aplicação no Container
- [ ] Acessou console do container backend
- [ ] Executou: `npx prisma migrate deploy`
- [ ] Migration aplicada sem erros
- [ ] Executou: `npx prisma generate`
- [ ] Prisma Client gerado com sucesso
- [ ] Verificou tabela `receivables` criada

### Configuração
- [ ] Verificou variáveis de ambiente no Portainer
- [ ] Confirmou `DATABASE_URL` configurado
- [ ] Adicionou `N8N_WEBHOOK_URL` (se usar notificações)
- [ ] Salvou e aplicou alterações (Redeploy)

### Logs e Verificações
- [ ] Visualizou logs do container backend
- [ ] Logs sem erros críticos
- [ ] Rota `/api/receivables` registrada
- [ ] Job de notificações iniciado (log: "✅ Job de notificações...")
- [ ] Endpoint `/health` respondendo

---

## 🎨 Verificação Frontend

### Containers
- [ ] Container frontend rodando (Status: Running)
- [ ] Rebuild concluído com sucesso
- [ ] Porta exposta corretamente

### Build
- [ ] Arquivo `ReceivablesPage.tsx` no build
- [ ] Arquivo `Sidebar.tsx` atualizado no build
- [ ] Arquivo `App.tsx` com rota no build
- [ ] Cache do navegador limpo (Ctrl+Shift+R)

### Verificações
- [ ] Frontend carrega sem erros
- [ ] Menu "Recebimentos" aparece no sidebar
- [ ] Rota `/receivables` funciona
- [ ] Componentes carregam corretamente

---

## 🧪 Testes Funcionais

### Teste 1: Acesso
- [ ] Login como ADMIN realizado
- [ ] Menu "Recebimentos" visível
- [ ] Clique no menu abre a página
- [ ] Página carrega sem erros
- [ ] Botão "Novo Recebimento" visível

### Teste 2: Criar Recebimento Simples
- [ ] Clicou em "Novo Recebimento"
- [ ] Formulário abriu corretamente
- [ ] Preencheu: Tipo, Descrição, Valor, Data
- [ ] Salvou com sucesso
- [ ] Card apareceu na lista
- [ ] Status "Pendente" com cor azul

### Teste 3: Criar Recebimento Recorrente
- [ ] Marcou "Pagamento Recorrente"
- [ ] Definiu 3 parcelas (teste)
- [ ] Salvou com sucesso
- [ ] 3 cards apareceram
- [ ] Cada um com número de parcela (1/3, 2/3, 3/3)
- [ ] Datas de vencimento mensais corretas

### Teste 4: Pagamento Total
- [ ] Clicou "Concluir Pagamento"
- [ ] Modal abriu com valor correto
- [ ] Confirmou pagamento total
- [ ] Card ficou verde
- [ ] Status mudou para "Pago"
- [ ] Botão "Concluir" desapareceu

### Teste 5: Pagamento Parcial
- [ ] Clicou "Concluir Pagamento"
- [ ] Digitou valor menor que total
- [ ] Confirmou
- [ ] Card ficou laranja/vermelho claro
- [ ] Status "Pago Parcialmente"
- [ ] Mostra valor pago e restante
- [ ] Botão "Concluir" ainda visível

### Teste 6: Filtros
- [ ] Filtro por status funciona
- [ ] Busca por texto funciona
- [ ] Resultados corretos exibidos

### Teste 7: Validações
- [ ] Não salva sem campos obrigatórios
- [ ] Recorrente exige mínimo 2 parcelas
- [ ] Mensagens de erro aparecem

---

## 📊 Integração com Relatórios

### Verificações
- [ ] Pagou pelo menos 1 recebimento
- [ ] Acessou página "Relatórios"
- [ ] Gerou relatório do período
- [ ] Recebimento aparece na lista
- [ ] Marcado como "INCOME" (receita)
- [ ] Valor somado no faturamento
- [ ] Contribui para o lucro

---

## 🔔 Notificações (Opcional)

### Configuração N8N
- [ ] `N8N_WEBHOOK_URL` configurado no `.env`
- [ ] Backend reiniciado após configurar
- [ ] Webhook N8N criado e ativo
- [ ] Workflow N8N testado manualmente

### Teste de Notificação
- [ ] Criou recebimento com vencimento hoje
- [ ] Aguardou horário 09:00 (ou ajustou cron)
- [ ] Verificou logs do backend
- [ ] Mensagem "🔔 [Receivables Job]..." apareceu
- [ ] Webhook recebeu dados no N8N
- [ ] WhatsApp enviado com sucesso
- [ ] Campo `notificationSent` atualizado para `true`

---

## 🐛 Troubleshooting

### Erros Comuns Verificados
- [ ] Sem erro "Table doesn't exist"
- [ ] Sem erro "Cannot find module @prisma/client"
- [ ] Sem erro 404 na rota `/api/receivables`
- [ ] Sem erro TypeScript no frontend
- [ ] Sem erro de CORS

### Performance
- [ ] Página carrega em menos de 2 segundos
- [ ] Filtros respondem instantaneamente
- [ ] Modal abre sem delay
- [ ] Nenhum memory leak detectado

---

## 📱 Responsividade

### Desktop
- [ ] Layout correto em 1920x1080
- [ ] Cards alinhados
- [ ] Formulário legível
- [ ] Botões clicáveis

### Tablet
- [ ] Layout adapta em 768px
- [ ] Sidebar colapsa corretamente
- [ ] Formulário empilha campos
- [ ] Touch funciona

### Mobile
- [ ] Layout adapta em 375px
- [ ] Cards empilham
- [ ] Texto legível
- [ ] Botões acessíveis
- [ ] Modal responsivo

---

## 👥 Treinamento

### Equipe Técnica
- [ ] DevOps informado sobre deploy
- [ ] Desenvolvedores com acesso ao código
- [ ] QA com guia de testes
- [ ] Suporte técnico treinado

### Usuários Finais
- [ ] Gestores receberam resumo executivo
- [ ] Operadores treinados no uso
- [ ] Manual de uso disponibilizado
- [ ] Suporte disponível para dúvidas

---

## 📚 Documentação

### Disponibilidade
- [ ] INDICE-RECEBIMENTOS.md acessível
- [ ] RESUMO-EXECUTIVO-RECEBIMENTOS.md acessível
- [ ] GUIA-TESTE-RECEBIMENTOS.md acessível
- [ ] FUNCIONALIDADE-RECEBIMENTOS.md acessível
- [ ] IMPLEMENTACAO-COMPLETA.md acessível

### Localização
- [ ] Documentos na raiz do projeto
- [ ] Link compartilhado com equipe
- [ ] Versão atualizada confirmada

---

## 🎯 Pós-Deploy

### Monitoramento (Primeiro Dia)
- [ ] Logs do backend sem erros
- [ ] Nenhum crash reportado
- [ ] Performance estável
- [ ] Usuários conseguem acessar

### Monitoramento (Primeira Semana)
- [ ] Job de notificações executando diariamente
- [ ] Recebimentos sendo criados
- [ ] Pagamentos sendo registrados
- [ ] Relatórios incluindo recebimentos

### Feedback
- [ ] Coletado feedback dos usuários
- [ ] Identificados pontos de melhoria
- [ ] Bugs reportados (se houver)
- [ ] Documentação atualizada (se necessário)

---

## ✅ Sign-Off Final

### Aprovações
- [ ] ✅ Deploy Backend aprovado por: _____________
- [ ] ✅ Deploy Frontend aprovado por: _____________
- [ ] ✅ Testes aprovados por: _____________
- [ ] ✅ Documentação aprovada por: _____________

### Data de Deploy
- [ ] Data: ___/___/______
- [ ] Hora: ___:___
- [ ] Responsável: _____________

### Rollback Plan
- [ ] Backup disponível
- [ ] Processo de rollback documentado
- [ ] Equipe sabe como reverter
- [ ] Tempo estimado de rollback: ___ minutos

---

## 🎉 DEPLOY COMPLETO!

**Quando todos os itens estiverem marcados:**

✅ Sistema de Recebimentos está em PRODUÇÃO  
✅ Todas as funcionalidades validadas  
✅ Equipe treinada  
✅ Documentação disponível  
✅ Monitoramento ativo  

**🚀 Parabéns pelo deploy com sucesso!**

---

## 📝 Notas Adicionais

```
_____________________________________________________________

_____________________________________________________________

_____________________________________________________________

_____________________________________________________________

_____________________________________________________________
```

---

**Documento:** CHECKLIST-DEPLOY-RECEBIMENTOS.md  
**Versão:** 1.0  
**Data de Criação:** 01/03/2026  
**Última Atualização:** 01/03/2026
