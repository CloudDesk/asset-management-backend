import Fastify, { FastifyRequest } from "fastify";
import Multer from "fastify-multer";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import fs from "fs";

import Revo365Routes from "./routes/routes.js";
import { checkDatabaseConnection } from "./database/postgres.js";
import { connectGetSessionredis } from "./database/redis.session.js";
import { PORT } from "./config/config.js";

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

interface CustomRequest extends FastifyRequest {
  startTime?: [number, number];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parentDir = resolve(__dirname, "..");
const logFilePath = "./request_logs.csv";

const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

const fastify = Fastify({ logger: true });

function initializeLogging() {
  fs.stat(logFilePath, (err, stats) => {
    if (err || stats.size === 0) {
      logStream.write("timestamp,method,url,statusCode,duration\n");
    }
  });
}

function registerPlugins() {
  fastify.register(cors);
  fastify.register(formbody);
  fastify.register(Multer.contentParser);
  fastify.register(Revo365Routes, { fastifyInstance: fastify });
  fastify.register(fastifyStatic, {
    root: join(parentDir, "/uploads"),
  });
}

function addHooks() {
  fastify.addHook("onRequest", (request: CustomRequest, reply, done) => {
    request.startTime = process.hrtime();
    done();
  });

  fastify.addHook("onReady", async () => {
    try {
      const data = await checkDatabaseConnection();
      console.log(data, "inside");
      await connectGetSessionredis();
    } catch (error) {
      console.error("Failed to connect to the database:", error);
    }
  });
}

function startServer() {
  fastify.listen({ port: PORT || 5600, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
    } else if (address) {
      console.log("Successfully Connected", address);
    } else {
      console.log("Server Not Connected");
    }
  });
}

function initializeApp() {
  initializeLogging();
  registerPlugins();
  addHooks();
  startServer();
}

initializeApp();
