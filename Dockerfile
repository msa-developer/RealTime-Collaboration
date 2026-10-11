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

# Render injects PORT=10000; server.mjs already reads process.env.PORT.
# EXPOSE is documentation only; CMD must stay a long-running server.
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm", "start"]

