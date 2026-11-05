# Motio API. Data lives in Postgres (DATABASE_URL), so the container itself keeps nothing.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV PORT=8787 NODE_ENV=production NODE_NO_WARNINGS=1
EXPOSE 8787
CMD ["node", "src/server.js"]
