FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

FROM dependencies AS test
COPY . .
RUN npm run check
RUN npm run test:coverage

FROM dependencies AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY benchmarks ./benchmarks
COPY tools ./tools
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/evidence.db
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY contracts ./contracts
COPY benchmarks/config.json ./benchmarks/config.json
COPY docker-entrypoint.mjs ./
RUN mkdir -p /app/data /app/benchmarks/results && chown -R node:node /app/data /app/benchmarks/results
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "docker-entrypoint.mjs"]
CMD ["serve"]
