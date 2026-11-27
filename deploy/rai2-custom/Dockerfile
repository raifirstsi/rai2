# RAI2 Custom On-Premise Image (Compiled Artifacts Only — NO raw src/, server/*.ts, or saas/)
FROM node:24-bookworm-slim AS build
WORKDIR /src
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm install -g pnpm@10.33.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/docs/package.json ./apps/docs/package.json
COPY cloudflare/control-plane/package.json ./cloudflare/control-plane/package.json
COPY scripts/install-git-hooks.mjs ./scripts/install-git-hooks.mjs
RUN pnpm install --frozen-lockfile
COPY tsconfig*.json vite.config.ts ./
COPY scripts ./scripts
COPY skills ./skills
COPY src ./src
COPY server ./server
ARG TARGETARCH=amd64
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm exec tsc -b \
 && NODE_OPTIONS="--max-old-space-size=4096" VITE_RAI2_SAAS=1 pnpm exec vite build \
 && node scripts/build-oss-server.mjs \
 && arch=x64 && if [ "$TARGETARCH" = "arm64" ]; then arch=arm64; fi \
 && OMB_DUCKDB_ARCH=$arch node scripts/prepare-duckdb.mjs \
 && mkdir -p dist-native/duckdb/target \
 && mv "dist-native/duckdb/linux-$arch"/* dist-native/duckdb/target/ 2>/dev/null || true

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV RAI2_CUSTOM_ONPREM=1
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates tini git \
 && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY --from=build /src/dist ./dist
COPY --from=build /src/dist-server ./dist-server
COPY --from=build /src/skills ./skills
COPY --from=build /src/dist-native ./dist-native
RUN npm install --omit=dev --no-audit --no-fund
VOLUME ["/data"]
EXPOSE 8799
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist-server/index.js"]
