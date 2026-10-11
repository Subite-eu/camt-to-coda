FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts ./
COPY src/ src/
COPY examples/catalog.json examples/catalog.json
COPY examples/download-catalog.json examples/download-catalog.json
COPY examples/bank-published/catalog.json examples/bank-published/catalog.json
COPY examples/bank-catalog/catalog.json examples/bank-catalog/catalog.json
COPY examples/bank-catalog/country-references.json examples/bank-catalog/country-references.json
COPY examples/bank-catalog/channel-definitions.json examples/bank-catalog/channel-definitions.json
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
