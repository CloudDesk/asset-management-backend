# Use Node.js 20 as the base image with AMD64 architecture for GCP compatibility
FROM --platform=linux/amd64 node:20-slim

# Install runtime dependencies required by Prisma on slim Debian images.
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY src ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Expose the port that your application will run on
EXPOSE 5600

# Set the default PORT environment variable
ENV PORT=5600

# Start the application
CMD ["node", "build/index.js"]
