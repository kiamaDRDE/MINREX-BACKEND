# Étape 1 : Builder
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma7.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./

RUN pnpm install --frozen-lockfile

COPY src ./src

RUN npx prisma generate
RUN pnpm run build

# Étape 2 : Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma7.config.ts ./

RUN pnpm install --prod --frozen-lockfile
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]

