FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
RUN mkdir -p /data/documents && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["npm", "start"]
