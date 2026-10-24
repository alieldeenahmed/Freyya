import Fastify from "fastify";

const app = Fastify({ logger: true });
app.get("/health", async () => ({ status: "ok", probe: true }));
await app.listen({ port: 3000 });
