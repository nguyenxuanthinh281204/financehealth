# Build web tĩnh, phục vụ bằng Caddy (dùng cho triển khai 1 VPS, xem docs/DEPLOY-VN.md)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# API chạy cùng tên miền (/api) nên để trống
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
