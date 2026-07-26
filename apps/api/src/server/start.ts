import "dotenv/config";
import { createApp } from "@/server/server";
import { env } from "@/config/env";
import {
  ensurePortAvailable,
  reportPortInUse,
} from "@/server/ensure-port-available";

await ensurePortAvailable(env.PORT);

const server = createApp().listen(env.PORT, () => {
  console.log(`api listening on http://localhost:${env.PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") reportPortInUse(env.PORT);
  throw err;
});
