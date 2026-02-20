@echo off
echo 🚛 Truck Logbook - Setup Script
echo ================================
echo.

REM Verificar se estamos no diretório correto
if not exist "docker-compose.cloud.yml" (
    echo ❌ Erro: Execute este script a partir do diretório raiz do projeto
    exit /b 1
)

REM 1. Backend
echo 📦 Instalando dependências do Backend...
cd backend
call npm install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências do backend
    exit /b 1
)

REM Configurar .env do backend
if not exist ".env" (
    echo 📝 Criando arquivo .env do backend...
    copy .env.example .env
    echo ⚠️  IMPORTANTE: Edite backend\.env com suas configurações!
)

echo ✅ Backend configurado!
cd ..

REM 2. Frontend
echo.
echo 📦 Instalando dependências do Frontend...
cd frontend
call npm install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências do frontend
    exit /b 1
)

REM Configurar .env do frontend
if not exist ".env" (
    echo 📝 Criando arquivo .env do frontend...
    copy .env.example .env
)

echo ✅ Frontend configurado!
cd ..

REM 3. Prisma
echo.
echo 🗄️  Configurando Prisma...
cd backend
call npx prisma generate
if errorlevel 1 (
    echo ❌ Erro ao gerar Prisma Client
    exit /b 1
)

echo ✅ Prisma configurado!
cd ..

echo.
echo =========================================
echo ✅ Setup concluído com sucesso!
echo =========================================
echo.
echo 📋 Próximos passos:
echo.
echo 1. Configure as variáveis de ambiente:
echo    - Edite backend\.env
echo    - Edite frontend\.env (opcional)
echo.
echo 2. Execute as migrations do banco de dados:
echo    cd backend
echo    npx prisma migrate dev
echo    npx prisma db seed  (opcional - dados de exemplo)
echo.
echo 3. Inicie os servidores:
echo    Terminal 1: cd backend ^&^& npm run dev
echo    Terminal 2: cd frontend ^&^& npm run dev
echo.
echo 4. Acesse a aplicação:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:4000
echo.
echo 🔑 Credenciais padrão (após seed):
echo    Email: admin@truck.com
echo    Senha: admin123
echo.
pause
