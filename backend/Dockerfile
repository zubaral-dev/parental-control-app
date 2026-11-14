# Dockerfile for Deploying Parental Control Backend to Cloud (Railway, Render, Fly.io, or VPS)
FROM node:20-alpine

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend source code
COPY . .

# Expose HTTP port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
