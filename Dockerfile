# Produkcyjny serwer SSR. Konto demonstracyjne: ada@silhouette.dev / silhouette
#   docker build -t silhouette .
#   docker run --rm -p 4000:4000 silhouette

FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS run

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 4000

CMD ["node", "dist/Silhouette/server/server.mjs"]
