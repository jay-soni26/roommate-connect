# Use lightweight Node image
FROM node:18-alpine
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose backend port
EXPOSE 3000

# Start server
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]