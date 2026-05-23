FROM node:18-alpine

WORKDIR /app

# Cache-bust: forces npm ci to re-run on every build, preventing stale layer reuse
ARG CACHEBUST=20260523

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
