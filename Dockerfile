FROM node:22-bookworm-slim

# ponytail: jdk-headless keeps image small on free tier; javac still included
RUN apt-get update \
  && apt-get install -y --no-install-recommends default-jdk-headless python3 g++ \
  && rm -rf /var/lib/apt/lists/* \
  && javac -version && java -version && python3 --version && g++ --version

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

