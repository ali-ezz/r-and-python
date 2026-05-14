FROM node:20-slim as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Use a small nginx server to serve the static build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
# Update nginx config to listen on 5173 if needed, or just map it in docker-compose
# For Vite apps, we usually just need to serve the dist folder.
# We'll use a simple nginx config or just map 80 to 5173.
CMD ["nginx", "-g", "daemon off;"]
