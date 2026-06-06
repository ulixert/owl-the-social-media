import type { Server } from 'http';

import { WebSocket, WebSocketServer } from 'ws';

import { jwtVerify } from '../middlewares/utils/jwtVerify.js';
import { redis } from '../redis.js';

const HEARTBEAT_MS = 30_000;
const WS_PATH = `${process.env.API_PREFIX ?? '/api/v1'}/ws`;

// `ws` doesn't track liveness for us, so tag each socket with its user and a
// per-tick alive flag for the ping/pong heartbeat.
type TaggedSocket = WebSocket & { userId: number; isAlive: boolean };

// userId -> live sockets for that user ON THIS PROCESS. Redis pub/sub is what
// makes delivery work across instances; this map is just the local fan-out.
const connections = new Map<number, Set<TaggedSocket>>();

function register(ws: TaggedSocket) {
  let set = connections.get(ws.userId);
  if (!set) {
    set = new Set();
    connections.set(ws.userId, set);
  }
  set.add(ws);
}

function unregister(ws: TaggedSocket) {
  const set = connections.get(ws.userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connections.delete(ws.userId);
}

// Attach the notification WebSocket to the existing HTTP server. The browser
// WebSocket API can't set an Authorization header, so the access token is
// passed as ?token=… and verified on the upgrade handshake.
export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams } = new URL(
      req.url ?? '',
      'http://localhost',
    );
    if (pathname !== WS_PATH) {
      socket.destroy();
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      socket.destroy();
      return;
    }

    jwtVerify(token, process.env.ACCESS_TOKEN_SECRET!)
      .then(({ userId }) => {
        wss.handleUpgrade(req, socket, head, (ws) => {
          const tagged = ws as TaggedSocket;
          tagged.userId = userId;
          tagged.isAlive = true;
          register(tagged);
          tagged.on('pong', () => {
            tagged.isAlive = true;
          });
          tagged.on('close', () => unregister(tagged));
          tagged.on('error', () => unregister(tagged));
        });
      })
      .catch(() => socket.destroy());
  });

  // Drop dead connections: ping every tick, terminate anything that didn't pong
  // since the last one.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const tagged = ws as TaggedSocket;
      if (!tagged.isAlive) {
        tagged.terminate();
        continue;
      }
      tagged.isAlive = false;
      tagged.ping();
    }
  }, HEARTBEAT_MS);
  wss.on('close', () => clearInterval(heartbeat));

  // A subscriber connection can't issue normal commands, so duplicate the
  // command client. One psubscribe per process; we filter by the local map.
  const sub = redis.duplicate();
  sub.on('error', (err: Error) =>
    console.error('[ws] redis sub error:', err.message),
  );
  void sub.psubscribe('notifications:user:*');
  sub.on('pmessage', (_pattern, channel, message) => {
    const userId = Number(channel.slice(channel.lastIndexOf(':') + 1));
    const sockets = connections.get(userId);
    if (!sockets) return;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
    }
  });

  console.log(`WebSocket listening on ${WS_PATH}`);
}
