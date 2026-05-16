import type { Response } from "express";
import { randomUUID } from "node:crypto";

type SseClient = { id: string; res: Response };

const clients = new Map<string, SseClient>();

export function emitDashboardEvent(
  event: string,
  data: Record<string, unknown>,
): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client.id);
    }
  }
}

export function registerSseClient(res: Response): string {
  const id = randomUUID();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: connected\ndata: {}\n\n`);
  clients.set(id, { id, res });
  res.on("close", () => clients.delete(id));
  return id;
}

export function getSseClientCount(): number {
  return clients.size;
}
