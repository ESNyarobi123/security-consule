# PSSMS NestJS backend — multi-app image (core-api, integration-gateway, worker, realtime)
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npx nest build core-api \
 && npx nest build integration-gateway \
 && npx nest build background-worker \
 && npx nest build realtime-gateway \
 && npx nest build reporting-service

# Runtime with Prisma CLI for db-migrate job
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Default: core-api (override command per service in compose)
CMD ["node", "dist/apps/core-api/main.js"]
