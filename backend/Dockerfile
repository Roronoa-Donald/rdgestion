FROM node:20-alpine AS builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/src/database/migrations ./dist/database/migrations
COPY frontend /app/frontend

EXPOSE 3000
CMD ["npm", "run", "start"]
