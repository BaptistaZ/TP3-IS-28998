FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libxml2-utils

COPY services/xml-service/package*.json ./
RUN npm ci

COPY services/xml-service/ ./

EXPOSE 7001
CMD ["npm", "run", "dev"]