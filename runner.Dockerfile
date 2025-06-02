FROM node:24.1.0-alpine
COPY . /app
WORKDIR /app
RUN corepack enable
RUN pnpm i

CMD ["node", "--no-warnings=ExperimentalWarning", "runner.ts"]