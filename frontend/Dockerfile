# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Angular app
RUN npm run build:prod

# Runtime stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist/videostream-frontend/browser /usr/share/nginx/html

# Copy nginx configuration for SPA routing
RUN echo 'server { \
    listen 4200; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://backend:3000; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 4200

CMD ["nginx", "-g", "daemon off;"]
