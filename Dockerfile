# Use the lightweight official Node.js 20 Alpine base image
FROM node:20-alpine

# Set the container workspace directory
WORKDIR /usr/src/app

# Copy dependency definition manifest first
COPY package.json ./

# Install clean, production-level dependencies
RUN npm install --only=production

# Copy core backend, seed files and static web directories
COPY server.js ./
COPY projects.json ./
COPY hero.json ./
COPY public/ ./public/

# Inform Docker that our Express web application listens on port 3001
EXPOSE 3001

# Environment variables configuration
ENV NODE_ENV=production
ENV PORT=3001

# Boot Express platform server inside the container
CMD ["node", "server.js"]
