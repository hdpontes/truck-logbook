FROM node:20-slim

# Instalar OpenSSL
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma/

# Usar npm install em vez de npm ci
RUN npm install

# Copiar código fonte
COPY . .

# Remover arquivos de desenvolvimento
RUN rm -rf src/routes/dev src/services/dev src/middleware/dev

# Gerar Prisma Client
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build

EXPOSE 4000

# Executar migrations e iniciar servidor
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
