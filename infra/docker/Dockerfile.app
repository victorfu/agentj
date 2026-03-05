FROM node:22-alpine AS builder

WORKDIR /workspace

ENV COREPACK_ENABLE_AUTO_PIN=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @agentj/contracts build
RUN pnpm --filter @agentj/tunnel-gateway build
RUN pnpm --filter @agentj/web build

FROM node:22-alpine AS runtime

WORKDIR /workspace

ENV COREPACK_ENABLE_AUTO_PIN=0
RUN corepack enable \
  && addgroup -S agentj \
  && adduser -S -G agentj agentj

ENV NODE_ENV=production

COPY --from=builder --chown=agentj:agentj /workspace /workspace

USER agentj

CMD ["pnpm", "--filter", "@agentj/web", "start", "--hostname", "0.0.0.0", "--port", "3000"]
