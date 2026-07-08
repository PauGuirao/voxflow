import { startServer } from "./server.ts";

const port = Number(process.env.AGENT_PORT ?? 8787);
startServer({ port });
