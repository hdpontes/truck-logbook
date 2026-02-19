FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Copy prisma directory for generate step
COPY prisma ./prisma/

# Install ALL dependencies (including dev for build tools)
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build application
RUN npm run build

# Remove dev dependencies after build (optional optimization)
RUN npm prune --production

# Expose port
EXPOSE 4000

# Start command
CMD ["npm", "start"]
