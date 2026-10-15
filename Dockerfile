# syntax=docker/dockerfile:1
# Cloud Run image: builds the web app, then runs the API server, which also serves dist/ on $PORT.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
# node_modules is pruned to production deps; tsx stays because it runs the TypeScript server
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
# The snapshot and scores live here; the runtime user must be able to write it
RUN mkdir -p server/data && chown -R node:node server/data
USER node
# Cloud Run sets PORT (8080). server/index.ts reads it.
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "server/index.ts"]
