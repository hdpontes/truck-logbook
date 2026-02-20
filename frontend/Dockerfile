FROM node:20-alpine as builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Usar npm install em vez de npm ci
RUN npm install

# Copiar código fonte
COPY . .

# Build arg para API URL
ARG VITE_API_URL=https://truck-api.hpboost.com.br
ENV VITE_API_URL=${VITE_API_URL}

# Build da aplicação
RUN npm run build

# Stage de produção
FROM nginx:alpine

# Copiar arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

# Configurar Nginx para SPA
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
