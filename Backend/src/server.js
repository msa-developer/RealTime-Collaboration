import express from "express";
import dotenv from "dotenv";
import connectdb from "./lib/db.js";
import path from "path";

dotenv.config({ quiet: true });

const app = express();

const __dirname = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("/{*any}", (_, res) =>
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html")),
  );
}

connectdb().then(() => {
  app.listen(process.env.port, () => {
    console.log("connected to port");
  });
});
