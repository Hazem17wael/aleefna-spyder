FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 8081

CMD ["pnpm", "start", "--", "--host", "lan", "--port", "8081"]