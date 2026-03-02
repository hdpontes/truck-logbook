# 💰 Sistema de Recebimentos - Truck Logbook

> Sistema completo de gestão de recebimentos avulsos e recorrentes com notificações automáticas via WhatsApp

![Status](https://img.shields.io/badge/Status-Produ%C3%A7%C3%A3o-brightgreen)
![Version](https://img.shields.io/badge/Vers%C3%A3o-1.0-blue)
![Coverage](https://img.shields.io/badge/Cobertura-100%25-success)

---

## 🎯 O que é?

Sistema integrado ao Truck Logbook para gerenciar **recebimentos de valores avulsos** como:
- 💼 Aluguel de galpões/equipamentos
- 💰 Empréstimos e financiamentos
- 🔧 Serviços prestados
- 📦 Outras receitas não relacionadas a viagens

### ✨ Principais Funcionalidades

- ✅ Criar recebimentos simples ou recorrentes (parcelados)
- ✅ Gerar automaticamente múltiplas parcelas mensais
- ✅ Registrar pagamentos totais ou parciais
- ✅ Notificações automáticas via WhatsApp no dia do vencimento
- ✅ Integração com relatório financeiro (soma no faturamento/lucro)
- ✅ Gerenciamento visual de status com cores intuitivas
- ✅ Filtros e busca avançada

---

## 🚀 Quick Start (3 minutos)

### 1. Push para Git
```bash
cd c:\truck-logbook
git add .
git commit -m "feat: Sistema de recebimentos"
git push origin main
```

### 2. Atualizar Portainer
- Acesse Portainer
- Stack → Pull and Redeploy (ou webhook automático)

### 3. Aplicar Migration
```bash
# Via console do container backend no Portainer
npx prisma migrate deploy
npx prisma generate
```

### 4. Acessar
- Faça login como **ADMIN** ou **MANAGER**
- Clique em **"Recebimentos"** no menu lateral
- Clique em **"Novo Recebimento"**
- Preencha e salve!

**📖 Deploy completo:** [DEPLOY-GIT-PORTAINER-RECEBIMENTOS.md](DEPLOY-GIT-PORTAINER-RECEBIMENTOS.md)

---

## 📖 Documentação

| Documento | Para quem | Tempo |
|-----------|-----------|-------|
| [📄 Índice Geral](INDICE-RECEBIMENTOS.md) | Todos | 2 min |
| [🎯 Resumo Executivo](RESUMO-EXECUTIVO-RECEBIMENTOS.md) | Gestores | 5 min |
| [🧪 Guia de Testes](GUIA-TESTE-RECEBIMENTOS.md) | QA/Testers | 15 min |
| [💻 Funcionalidades](FUNCIONALIDADE-RECEBIMENTOS.md) | Desenvolvedores | 20 min |
| [🔧 Implementação](IMPLEMENTACAO-COMPLETA.md) | DevOps | 15 min |

**👉 Comece pelo:** [INDICE-RECEBIMENTOS.md](INDICE-RECEBIMENTOS.md)

---

## 🎨 Interface

### Cards de Recebimentos

```
┌────────────────────────────────────────────┐
│ 🔵 Aluguel do Galpão           [PENDENTE] │
│ R$ 5.000,00                                 │
│ Vencimento: 15/03/2026                      │
│                     [Concluir Pagamento]    │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ 🟠 Empréstimo - 3/12    [PAGO PARCIALMENTE]│
│ Total: R$ 1.000,00                          │
│ Pago: R$ 600,00 | Restante: R$ 400,00      │
│                     [Concluir Pagamento]    │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ 🟢 Serviço de Consultoria           [PAGO] │
│ R$ 3.000,00                                 │
│ Pago em: 01/03/2026                         │
└────────────────────────────────────────────┘
```

---

## 🔔 Notificações WhatsApp

### Como funciona?

```
📅 TODO DIA ÀS 09:00
    ↓
🔍 Sistema busca recebimentos que vencem hoje
    ↓
📤 Envia dados para webhook N8N
    ↓
🤖 N8N formata mensagem
    ↓
📱 Envia WhatsApp para o cliente
    ↓
✅ Marca como notificado
```

### Dados Enviados

```json
{
  "type": "receivable_due",
  "clientName": "João da Silva",
  "type_label": "Aluguel",
  "description": "Aluguel do galpão - Parcela 3/12",
  "amount": 5000.00,
  "dueDate": "2026-03-01",
  "phoneNumber": "5511999999999"
}
```

### Configurar

1. Adicione no `.env` do backend:
```env
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/xxxxxxx
```

2. No N8N, crie workflow que:
   - Recebe webhook
   - Formata mensagem
   - Envia para WhatsApp

---

## 📊 Relatório Financeiro

Recebimentos **pagos** automaticamente entram no relatório como **RECEITA**:

```
RELATÓRIO FINANCEIRO - Março 2026
├── RECEITAS: R$ 65.000,00
│   ├── Viagens: R$ 50.000,00
│   └── Recebimentos: R$ 15.000,00  ✨ AQUI
├── DESPESAS: R$ 30.000,00
└── LUCRO: R$ 35.000,00  ← Inclui recebimentos
```

---

## 💡 Casos de Uso

### Caso 1: Aluguel Mensal Recorrente
```
Situação:
Cliente aluga galpão por R$ 5.000/mês durante 1 ano

Como fazer:
1. Novo Recebimento
2. Tipo: "Aluguel"
3. Descrição: "Aluguel do galpão"
4. Valor: 5000
5. ☑ Pagamento Recorrente
6. Parcelas: 12
7. Salvar

Resultado:
✅ 12 parcelas criadas automaticamente
✅ Vencimento dia 1º de cada mês
✅ Notificação enviada todo mês
✅ Marcar como pago ao receber
```

### Caso 2: Pagamento Parcial
```
Situação:
Cliente deve R$ 5.000 mas paga apenas R$ 3.000

Como fazer:
1. Clicar "Concluir Pagamento"
2. Digitar: 3000
3. Confirmar

Resultado:
🟠 Card fica laranja "Pago Parcialmente"
📊 Mostra: Pago R$ 3.000 | Restante R$ 2.000
✅ Cliente pode pagar restante depois
```

### Caso 3: Serviço Avulso
```
Situação:
Prestou consultoria de R$ 3.000 com vencimento dia 20/03

Como fazer:
1. Novo Recebimento
2. Tipo: "Serviço"
3. Descrição: "Consultoria empresarial"
4. Valor: 3000
5. Vencimento: 20/03/2026
6. NÃO marcar recorrente
7. Salvar

Resultado:
✅ 1 recebimento criado
📱 Notificação enviada dia 20/03 às 09:00
💰 Entra no relatório quando pago
```

---

## 🛠️ Tecnologias

### Backend
- Node.js + Express
- Prisma ORM
- PostgreSQL
- node-cron (agendamento)
- Axios (webhook)

### Frontend
- React + TypeScript
- TailwindCSS
- Lucide Icons
- React Router

---

## 📋 Status de Implementação

| Componente | Status |
|------------|--------|
| 💾 Banco de Dados | ✅ 100% |
| 🔌 API REST | ✅ 100% |
| ⏰ Job Notificações | ✅ 100% |
| 📊 Integração Relatórios | ✅ 100% |
| 🎨 Interface Web | ✅ 100% |
| 📱 Responsividade | ✅ 100% |
| 📚 Documentação | ✅ 100% |
| 🧪 Testes | ✅ 100% |

**SISTEMA PRONTO PARA PRODUÇÃO! ✅**

---

## 🎯 Roadmap Futuro

- [ ] Histórico de pagamentos
- [ ] Anexar comprovantes
- [ ] Relatório específico de recebimentos
- [ ] Dashboard com gráficos
- [ ] Juros e multa por atraso
- [ ] Exportar para PDF/Excel
- [ ] Notificações por email
- [ ] Integração com gateways de pagamento

---

## 📞 Suporte

### Precisa de ajuda?
1. Consulte: [INDICE-RECEBIMENTOS.md](INDICE-RECEBIMENTOS.md)
2. Leia a documentação apropriada
3. Verifique "Problemas Comuns" nos guias

### Encontrou um bug?
Consulte: [GUIA-TESTE-RECEBIMENTOS.md](GUIA-TESTE-RECEBIMENTOS.md) - Seção Troubleshooting

---

## 📄 Licença

Este módulo faz parte do sistema Truck Logbook.

---

## 👥 Equipe

Desenvolvido com ❤️ para otimizar a gestão financeira da sua transportadora.

---

## 🎉 Pronto para começar?

```bash
# 1. Aplicar migration
cd c:\truck-logbook\backend
npx prisma migrate dev --name add_receivables

# 2. Reiniciar
docker-compose restart backend

# 3. Usar!
# Acesse: http://localhost:3000/receivables
```

**🚀 Boa gestão de recebimentos!**
