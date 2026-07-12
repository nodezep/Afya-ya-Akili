# AKILI API — multi-stage production image
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace apps/api --include-workspace-root=false || npm install --prefix apps/api

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

# ---- Runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S akili && adduser -S akili -G akili

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/node_modules ./root_node_modules
COPY apps/api/prisma ./prisma
COPY apps/api/package.json ./

# Merge hoisted workspace deps that the API resolves at runtime
RUN cp -rn /app/root_node_modules/* /app/node_modules/ 2>/dev/null; rm -rf /app/root_node_modules

USER akili
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
