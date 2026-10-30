import { EventEmitter } from "node:events";
import type { Response } from "express";

export interface RealtimeEvent {
  type: "status_update" | "inbound_message" | "meta_synced" | "broadcast_synced" | "heartbeat";
  data: Record<string, unknown>;
  timestamp: string;
}

class RealtimeHub extends EventEmitter {
  private clients = new Set<Response>();

  constructor() {
    super();
    this.setMaxListeners(100);

    // Heartbeat every 25s to keep connections alive through reverse proxies
    setInterval(() => {
      this.broadcast("heartbeat", { ping: "pong" });
    }, 25000);
  }

  addClient(res: Response): void {
    this.clients.add(res);

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

    res.on("close", () => {
      this.clients.delete(res);
    });
  }

  removeClient(res: Response): void {
    this.clients.delete(res);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  broadcast(type: RealtimeEvent["type"], data: Record<string, unknown> = {}): void {
    const payload: RealtimeEvent = {
      type,
      data,
      timestamp: new Date().toISOString()
    };
    const message = `data: ${JSON.stringify(payload)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(message);
      } catch (err) {
        this.clients.delete(client);
      }
    }

    this.emit("event", payload);
  }
}

export const realtimeHub = new RealtimeHub();
