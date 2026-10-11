FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts ./
COPY src/ src/
COPY examples/catalog.json examples/catalog.json
COPY examples/camt/ examples/camt/
COPY examples/coda/ examples/coda/
COPY examples/invalid/ examples/invalid/
RUN npm run build && npm run build:app

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-web ./dist-web
EXPOSE 3000
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
