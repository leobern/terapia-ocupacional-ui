ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# ==============================
# Stage 1: DEV — resolve deps & run tests
# ==============================
FROM node:20-browsers AS dev

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    NO_PROXY=$NO_PROXY \
    http_proxy=$HTTP_PROXY \
    https_proxy=$HTTPS_PROXY \
    no_proxy=$NO_PROXY

RUN npm install -g pnpm

WORKDIR /app

# Copiar arquivos de config para resolver dependências
COPY openapitools.json package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY openapi ./openapi

# Instalar dependências
RUN pnpm i --frozen-lockfile --ignore-scripts

# Preparar workspace (gerar models OpenAPI, etc.)
RUN pnpm run workspace:prepare

# Copiar todo o código
COPY . ./

# Keep alive para executar tasks da pipeline
CMD ["sleep", "infinity"]

# ==============================
# Stage 2: BUILD — compila a aplicação
# ==============================
FROM dev AS builder
RUN pnpm run build && pnpm run compress

# ==============================
# Stage 3: PROD — imagem Nginx final
# ==============================
FROM nginx:alpine AS prod

COPY .docker/nginx.conf /etc/nginx/nginx.conf
COPY .docker/check_http.sh /opt/tools/check_http.sh
RUN chmod +x /opt/tools/check_http.sh

# Copiar build Angular para o Nginx
COPY --from=builder /app/dist/terapia-nutricional-ui/browser/ /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD /opt/tools/check_http.sh || exit 1
