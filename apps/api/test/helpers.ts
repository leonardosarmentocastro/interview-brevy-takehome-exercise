import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { createApp } from "@/server/server";

export const startServer = async (
  connectExtraRoutes?: (app: Express) => void,
): Promise<{ server: Server; base: string }> => {
  const server = createApp(connectExtraRoutes).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, base: `http://localhost:${port}` };
};

export const stopServer = (server: Server): Promise<void> =>
  new Promise((resolve) => server.close(() => resolve()));
