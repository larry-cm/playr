# Job nocturno del registro de compras (ver README.md). Contexto de build = raiz del repo:
#   docker build -f jobs/historial-proveedor/Dockerfile -t playr-historial-job .
# Etapa 1: empaqueta sync.ts + app/lib (alias de tsconfig) + supabase-js en un solo .mjs con esbuild.
FROM node:24-alpine AS build
WORKDIR /build
RUN npm install --no-save --no-package-lock --no-audit --no-fund esbuild@0.28.2 @supabase/supabase-js@2.110.8
COPY tsconfig.json ./
COPY app/lib/ app/lib/
COPY jobs/historial-proveedor/ jobs/historial-proveedor/
RUN npx esbuild jobs/historial-proveedor/sync.ts --bundle --platform=node --target=node24 --format=esm --minify \
    --outfile=dist/sync.mjs

# Etapa 2: solo el bundle, sin node_modules ni codigo fuente, usuario sin privilegios.
FROM node:24-alpine
WORKDIR /app
COPY --from=build /build/dist/sync.mjs ./
USER node
CMD ["node", "sync.mjs"]
