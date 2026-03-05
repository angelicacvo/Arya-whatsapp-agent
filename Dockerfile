# ====================================
# Dockerfile para WhatsApp Agent
# Compatible con Railway y Docker Desktop
# ====================================

# --- Stage 1: Dependencies ---
# Instalar solo las dependencias (se cachea si package.json no cambia)
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (dev + prod) para poder compilar TypeScript
RUN npm ci

# --- Stage 2: Build ---
# Compilar el código TypeScript a JavaScript
FROM node:20-alpine AS build

WORKDIR /app

# Copiar dependencias desde la etapa anterior
COPY --from=dependencies /app/node_modules ./node_modules

# Copiar código fuente y archivos de configuración
COPY . .

# Compilar el proyecto (NestJS genera carpeta /dist)
RUN npm run build

# Eliminar dependencias de desarrollo (solo dejar las de producción)
RUN npm prune --production

# --- Stage 3: Production ---
# Imagen final (solo lo necesario para ejecutar)
FROM node:20-alpine AS production

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

WORKDIR /app

# Cambiar permisos de la carpeta
RUN chown -R nestjs:nodejs /app

# Cambiar al usuario no-root
USER nestjs

# Copiar SOLO lo necesario desde la etapa de build
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package*.json ./

# Variables de entorno por defecto (Railway las sobreescribe)
ENV NODE_ENV=production
ENV PORT=3000

# Railway asigna un puerto aleatorio, lo exponemos dinámicamente
EXPOSE ${PORT}

# Health check (Railway verifica que el contenedor esté saludable)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar la aplicación
CMD ["node", "dist/main.js"]
