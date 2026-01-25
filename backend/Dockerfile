# Node.js 22 slim base image
FROM node:22-slim

# Install build dependencies for better-sqlite3 native module
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directory for SQLite
RUN mkdir -p data

# Cloud Run injects PORT environment variable
ENV PORT=8080
ENV NODE_ENV=production

# Expose port (documentation, Cloud Run handles this automatically)
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
