# PSSMS Next.js portals — one image per APP_NAME
# docker build --build-arg APP_NAME=admin-web --build-arg APP_PORT=3000 .

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages

# Drop stub folders that are not real workspaces (no package.json)
RUN for d in apps/* packages/*; do \
      [ -f "$d/package.json" ] || rm -rf "$d"; \
    done

RUN npm ci

ARG APP_NAME=admin-web
ARG NEXT_PUBLIC_CORE_API_URL=http://localhost:4001
ARG NEXT_PUBLIC_REPORTING_API_URL=http://localhost:4005
ARG NEXT_PUBLIC_OIDC_REDIRECT_URI=

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CORE_API_URL=$NEXT_PUBLIC_CORE_API_URL
ENV NEXT_PUBLIC_REPORTING_API_URL=$NEXT_PUBLIC_REPORTING_API_URL
ENV NEXT_PUBLIC_OIDC_REDIRECT_URI=$NEXT_PUBLIC_OIDC_REDIRECT_URI

RUN npm run build --workspace=${APP_NAME}

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

ARG APP_NAME=admin-web
ARG APP_PORT=3000
ENV APP_NAME=$APP_NAME
ENV PORT=$APP_PORT

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/${APP_NAME} ./apps/${APP_NAME}

EXPOSE ${APP_PORT}

CMD ["sh", "-c", "npm run start --workspace=${APP_NAME}"]
