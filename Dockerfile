FROM node:24-bookworm-slim AS build
WORKDIR /atlas
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 BODY_SIZE_LIMIT=26M
WORKDIR /atlas
COPY --from=build --chown=node:node /atlas/package.json /atlas/package-lock.json ./
COPY --from=build --chown=node:node /atlas/build ./build
COPY --from=build --chown=node:node /atlas/node_modules ./node_modules
COPY --from=build --chown=node:node /atlas/migrations ./migrations
USER node
EXPOSE 8080
CMD ["node", "build"]
