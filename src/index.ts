import Fastify, { FastifyRequest } from "fastify";
import Revo365Routes from "./routes/routes.js";
import Multer from "fastify-multer";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { checkDatabaseConnection } from "./database/postgres.js";
import cors from "@fastify/cors";
import { PORT } from "./config/config.js";
import formbody from "@fastify/formbody";
import fs from "fs";
import { connectGetSessionredis } from "./database/redis.session.js";

// Configuration
const logFilePath = "./request_logs.csv";

// Create a write stream for logging in append mode
const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

// Create Fastify instance
const fastify = Fastify({ logger: true });

// Log CSV header if file is empty
fs.stat(logFilePath, (err, stats) => {
  if (err || stats.size === 0) {
    logStream.write("timestamp,method,url,statusCode,duration\n");
  }
});

// Define a custom request interface to include startTime
interface CustomRequest extends FastifyRequest {
  startTime?: [number, number];
}

// Register plugins and routes
function registerPlugins() {
  fastify.register(cors);
  fastify.register(formbody);
  fastify.register(Multer.contentParser);
  fastify.register(Revo365Routes, { fastifyInstance: fastify });
  fastify.register(fastifyStatic, {
    root: join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "/uploads"),
  });
}

// Setup hooks
function setupHooks() {
  fastify.addHook("onRequest", (request: CustomRequest, reply, done) => {
    request.startTime = process.hrtime(); // Start timer
    done();
  });

  fastify.addHook("onReady", async () => {
    try {
      await checkDatabaseConnection();
      await connectGetSessionredis();
    } catch (error) {
      fastify.log.error("Failed to connect to the database:", error);
    }
  });
}

// Start server
async function startServer() {
  try {
    await fastify.listen({ port: Number(PORT) || 5600, host: "0.0.0.0" });
    const address = fastify.server.address();
    if (typeof address === "object" && address !== null) {
      fastify.log.info(`Server listening on ${address.port}`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Initialize application
function init() {
  registerPlugins();
  setupHooks();
  startServer();
}

init();
