FROM node:22-bookworm

# ponytail: one apt layer covers java/python/cpp runners; Render native has
# no JDK and no apt.txt mechanism, Docker is the only way to add it
RUN apt-get update \
  && apt-get install -y --no-install-recommends default-jdk python3 g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV NODE_ENV=production PORT=5001
EXPOSE 5001
CMD ["npm", "start"]
