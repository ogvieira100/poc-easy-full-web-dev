# =====================================================================
# Dockerfile - Publicação do front-end React (Vite + TypeScript)
# Estratégia multi-stage: compila em Node e serve via nginx.
# =====================================================================
# ---------------------------------------------------------------------
# Estágio 1: build da aplicação (imagem base Node 22 na variante Alpine,
# que é leve e suficiente para compilar um projeto Vite)
# ---------------------------------------------------------------------
FROM node:22-alpine AS build

# Define o diretório de trabalho padrão para os comandos seguintes (RUN, COPY)
WORKDIR /app

# Declara um argumento de build: a URL da API embutida no bundle pelo Vite.
# Pode ser sobrescrito na linha de comando:
#   docker build --build-arg VITE_API_BASE_URL=http://seu-host:5031 ...
# Em produção a API é interna no Container Apps e o nginx do front faz o
# reverse proxy de /api/ (ver nginx.conf), então o bundle usa URL relativa:
# "/" vira "" após o strip de barras finais em httpClient.ts e as chamadas
# saem como /api/... (same-origin, sem CORS).
ARG VITE_API_BASE_URL=/
# Converte o ARG em variável de ambiente para que o Vite a leia no build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copia apenas os manifestos de dependências primeiro, para que o Docker
# aproveite o cache da camada do "npm ci" quando só o código-fonte mudar
COPY package.json package-lock.json ./

# Instala as dependências exatas do package-lock.json (mais rápido e
# determinístico que "npm install"; remove node_modules antes de instalar)
RUN npm ci

# Copia todo o restante do contexto de build (src, public, configs, nginx.conf)
COPY . .

# Compila o projeto: "tsc -b" faz o type-check e "vite build" gera o
# bundle otimizado de produção na pasta /app/dist
RUN npm run build

# ---------------------------------------------------------------------
# Estágio 2: servidor web (nginx Alpine, imagem enxuta apenas para
# servir os arquivos estáticos gerados no estágio anterior)
# ---------------------------------------------------------------------
FROM nginx:1.27-alpine AS final

# Copia o bundle gerado no estágio "build" para a pasta padrão do nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Substitui a configuração padrão do nginx pela nossa (com fallback SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Documenta a porta em que o container escuta (9090, conforme o nginx.conf)
EXPOSE 9090

# Inicia o nginx em primeiro plano ("daemon off"), mantendo o container vivo
CMD ["nginx", "-g", "daemon off;"]
