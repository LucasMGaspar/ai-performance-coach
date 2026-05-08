import Fastify, { FastifyInstance } from "fastify";
import formbody from "@fastify/formbody";
import { config } from "./config";
import { logger } from "./lib/logger";
import healthRoute from "./routes/health";
import webhookRoute from "./routes/webhook";
import nudgeRoute from "./routes/nudge";

export function buildServer(): FastifyInstance {
  const server = Fastify({
    logger: config.nodeEnv === "development",
  });

  server.register(formbody);

  server.register(healthRoute, { prefix: "/" });
  server.register(webhookRoute, { prefix: "/webhook" });
  server.register(nudgeRoute, { prefix: "/" });

  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    reply.status(500).send({ error: "Internal server error" });
  });

  return server;
}

async function main(): Promise<void> {
  const server = buildServer();

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await server.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err) => {
  logger.fatal({ err }, "erro fatal ao iniciar o servidor");
  process.exit(1);
});
