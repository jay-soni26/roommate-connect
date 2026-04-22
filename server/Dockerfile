# Use lightweight Node image
FROM node:22-alpine
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

RUN npm config set registry https://registry.npmjs.org/
# Install dependencies
RUN npm ci --omit=dev

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