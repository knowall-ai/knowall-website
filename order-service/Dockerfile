# KnowAll AI order service — production image (Azure Container Apps).
# Build in the cloud from this directory:
#   az acr build -r knowallshopacr -t order-service:<tag> order-service
# ORDER_SERVICE_KEY is injected at runtime from Key Vault — never baked in.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY index.js ./
COPY lib ./lib

# The dedup + invoice store (data/.processed.json) lives on a mounted volume.
RUN mkdir -p /app/data && chown node:node /app/data

USER node
CMD ["node", "index.js"]
