FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.18.0
WORKDIR /source
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY patches ./patches
COPY apps ./apps
COPY packages ./packages
COPY scripts/build-server.mjs ./scripts/build-server.mjs
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate && pnpm build
RUN pnpm --filter @fishing/server --prod deploy /prod/server

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --uid 10001 --create-home fishing
WORKDIR /app
COPY --from=build /prod/server ./apps/server
COPY --from=build /source/apps/client/dist ./apps/client/dist
COPY scripts/container-entry.mjs ./scripts/container-entry.mjs
RUN DATABASE_URL=postgresql://build:build@postgres:5432/fishing node apps/server/node_modules/prisma/build/index.js generate --schema apps/server/prisma/schema.prisma
ENV NODE_ENV=production PORT=2567 HOST=0.0.0.0
USER fishing
EXPOSE 2567
ENTRYPOINT ["node", "scripts/container-entry.mjs"]
