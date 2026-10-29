# Build web tĩnh, phục vụ bằng Caddy (image cho NAT VPS, xem docs/DEPLOY-NATVPS.md)
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
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
