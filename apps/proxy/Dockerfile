FROM node:22-slim AS base
# Ensure python and build tools are available for better-sqlite3 native bindings
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Install dependencies from root
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/proxy/package.json ./apps/proxy/
COPY clients/node/package.json ./clients/node/
RUN npm ci

# Copy proxy code
COPY apps/proxy ./apps/proxy

WORKDIR /app/apps/proxy
EXPOSE 3001
CMD ["npm", "run", "start"]
