"use client";

/**
 * SocketProvider — socket.io connection to the agent-service
 * (mini-services/agent-service, port 3003, engine path "/") through the
 * sandbox gateway: io("/?XTransformPort=3003").
 *
 * The provider is mounted only for authenticated users and is keyed by
 * user id (see src/app/page.tsx), so the socket lives exactly one session.
 * Auth: the `auth` handshake callback fetches a short-lived ws-token
 * (GET /api/auth/ws-token, aud "ws", 60s TTL) on every connection attempt,
 * so reconnections always carry a fresh token. On an auth failure the
 * connection is retried once (the server calls disconnect(true) which
 * disables automatic reconnection).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";

import { api } from "@/lib/api";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  /** Make sure the socket is connected. Resolves false on timeout. */
  ensureConnected: () => Promise<boolean>;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  ensureConnected: async () => false,
});

const AUTH_ERROR = "Не авторизован";

export function SocketProvider({ children }: { children: ReactNode }) {
  // External resource created once per provider lifetime. With
  // autoConnect:false the constructor is inert until .connect() is called
  // (io() reuses the same instance for identical url+namespace, so React
  // StrictMode double-invocation is harmless). The auth callback fetches a
  // fresh ws-token on every connect attempt.
  const [socket] = useState<Socket>(() =>
    io("/?XTransformPort=3003", {
      path: "/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: false,
      auth: (cb) => {
        api
          .wsToken()
          .then(({ token }) => cb({ token }))
          .catch(() => cb({}));
      },
    }),
  );

  const [connected, setConnected] = useState(false);
  const authRetryRef = useRef(false);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    const s = socket;

    const handleConnect = () => {
      authRetryRef.current = false;
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    // Server emits "error" {message: "Не авторизован"} and disconnect(true)
    // on handshake failure — retry once (the next connect attempt fetches
    // a fresh token via the auth callback).
    const retryOnce = () => {
      if (authRetryRef.current || disposedRef.current) return;
      authRetryRef.current = true;
      s.connect();
    };

    const handleServerError = (payload: unknown) => {
      const message =
        (payload as { message?: unknown } | null)?.message ?? "";
      if (message === AUTH_ERROR) {
        retryOnce();
      }
    };

    const handleConnectError = (err: Error) => {
      setConnected(false);
      if (err.message.includes(AUTH_ERROR)) {
        retryOnce();
      }
    };

    s.on("connect", handleConnect);
    s.on("disconnect", handleDisconnect);
    s.on("connect_error", handleConnectError);
    s.on("error", handleServerError);

    s.connect();

    return () => {
      disposedRef.current = true;
      s.removeAllListeners();
      s.disconnect();
    };
  }, [socket]);

  const ensureConnected = useCallback(async (): Promise<boolean> => {
    const s = socket;
    if (s.connected) return true;

    if (s.disconnected) s.connect();

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 8000);
      const onConnect = () => {
        cleanup();
        resolve(true);
      };
      const cleanup = () => {
        clearTimeout(timeout);
        s.off("connect", onConnect);
      };
      s.on("connect", onConnect);
    });
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected, ensureConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within <SocketProvider>");
  }
  return ctx;
}
