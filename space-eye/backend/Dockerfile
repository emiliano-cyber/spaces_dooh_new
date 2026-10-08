# Backend SPACE EYE — build + runtime
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# libvips lo trae el binario prebuilt de sharp; slim (glibc) es compatible.
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# El frontend estatico y ./storage se montan como volumenes (ver compose).
EXPOSE 4000
CMD ["node", "dist/server.js"]
