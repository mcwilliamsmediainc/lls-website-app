# LLS Worker — BullMQ Docker worker
# Build from the repo root:  docker build -f packages/worker/Dockerfile -t lls-worker .

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---- install deps (workspace-aware) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/style-gate/package.json packages/style-gate/
COPY packages/worker/package.json packages/worker/
RUN pnpm install --frozen-lockfile=false

# ---- build ----
FROM deps AS build
COPY . .
RUN pnpm --filter @lls/db build \
 && pnpm --filter @lls/style-gate build \
 && pnpm --filter @lls/worker build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
# The worker resolves prompts/ and style-gate/ from the repo root at runtime.
WORKDIR /app/packages/worker
CMD ["node", "dist/index.js"]
