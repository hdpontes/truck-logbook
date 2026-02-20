#!/bin/bash

echo "🚛 Truck Logbook - Setup Script"
echo "================================"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.cloud.yml" ]; then
    echo "❌ Erro: Execute este script a partir do diretório raiz do projeto"
    exit 1
fi

# 1. Backend
echo "📦 Instalando dependências do Backend..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências do backend"
    exit 1
fi

# Configurar .env do backend
if [ ! -f ".env" ]; then
    echo "📝 Criando arquivo .env do backend..."
    cp .env.example .env
    echo "⚠️  IMPORTANTE: Edite backend/.env com suas configurações!"
fi

echo "✅ Backend configurado!"
cd ..

# 2. Frontend
echo ""
echo "📦 Instalando dependências do Frontend..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências do frontend"
    exit 1
fi

# Configurar .env do frontend
if [ ! -f ".env" ]; then
    echo "📝 Criando arquivo .env do frontend..."
    cp .env.example .env
fi

echo "✅ Frontend configurado!"
cd ..

# 3. Prisma
echo ""
echo "🗄️  Configurando Prisma..."
cd backend
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Erro ao gerar Prisma Client"
    exit 1
fi

echo "✅ Prisma configurado!"
cd ..

echo ""
echo "========================================="
echo "✅ Setup concluído com sucesso!"
echo "========================================="
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Configure as variáveis de ambiente:"
echo "   - Edite backend/.env"
echo "   - Edite frontend/.env (opcional)"
echo ""
echo "2. Execute as migrations do banco de dados:"
echo "   cd backend"
echo "   npx prisma migrate dev"
echo "   npx prisma db seed  # (opcional - dados de exemplo)"
echo ""
echo "3. Inicie os servidores:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "4. Acesse a aplicação:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4000"
echo ""
echo "🔑 Credenciais padrão (após seed):"
echo "   Email: admin@truck.com"
echo "   Senha: admin123"
echo ""
