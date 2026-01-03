FROM node:20-alpine

WORKDIR /app

COPY services/xml-service/package*.json ./
RUN npm ci

COPY services/xml-service/ ./

EXPOSE 7001
CMD ["npm", "run", "dev"]