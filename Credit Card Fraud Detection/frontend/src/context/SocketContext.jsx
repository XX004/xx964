import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { api } from "../utils/api";

const SocketContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const BACKFILL_LIMIT = 20;

function dismissedStorageKey(uid) {
  return `dismissed_alerts_${uid}`;
}

function loadDismissedIds(uid) {
  try {
    const raw = localStorage.getItem(dismissedStorageKey(uid));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedIds(uid, idsSet) {
  try {
    // Cap stored ids so this doesn't grow forever
    const arr = Array.from(idsSet).slice(-500);
    localStorage.setItem(dismissedStorageKey(uid), JSON.stringify(arr));
  } catch {
    // localStorage unavailable/full — non-fatal, just skip persisting
  }
}

export function SocketProvider({ children }) {
  const { user, isAdmin, getToken } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [ticketUpdateSignal, setTicketUpdateSignal] = useState(0);
  const dismissedRef = useRef(new Set());
  
  const addAlert = useCallback((alert) => {
    // Never re-show something the user already dismissed
    if (alert.id != null && dismissedRef.current.has(alert.id)) return;
    setAlerts((prev) => {
      // Same transaction can arrive twice (personal room + admins room broadcast
      // when an admin generates their own transaction) — merge instead of duplicating.
      if (alert.id != null && prev.some((a) => a.id === alert.id)) {
        return prev.map((a) => (a.id === alert.id ? { ...a, ...alert } : a));
      }
      return [
        { ...alert, _key: `${Date.now()}-${Math.random()}`, seenAt: new Date() },
        ...prev,
      ].slice(0, 50);
    });
  }, []);

  // Backfill any not-yet-dismissed BLOCK transactions this account can see.
  // api.transactions() is already scoped server-side (own txns for users, all for admins).
  const backfillAlerts = useCallback(async () => {
    try {
      const res = await api.transactions();
      const recent = (res.transactions || [])
        .filter((t) => t.decision === "BLOCK")
        .filter((t) => !dismissedRef.current.has(t.id))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, BACKFILL_LIMIT);

      setAlerts((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const seeded = recent
          .filter((t) => !existingIds.has(t.id))
          .map((t) => ({ ...t, _key: `seed-${t.id}`, seenAt: new Date() }));
        return [...seeded, ...prev].slice(0, 50);
      });
    } catch (e) {
      console.error("Failed to backfill alerts", e);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      setConnected(false);
      setAlerts([]);
      dismissedRef.current = new Set();
      setDismissedIds(new Set());
      return;
    }

    dismissedRef.current = loadDismissedIds(user.uid);
    setDismissedIds(new Set(dismissedRef.current));

    const socket = io(API_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join", { room: user.uid });
      if (isAdmin) socket.emit("join", { room: "admins" });
      backfillAlerts();
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("fraud_alert", (data) => {
      addAlert(data);
      if (Notification.permission === "granted") {
        new Notification("⚠️ Fraud Alert", {
          body: `Transaction ${data.decision} — Stage ${data.triggered_stage ?? "?"} (${(data.stage1_prob * 100).toFixed(1)}%)`,
          icon: "/logo.svg",
        });
      }
    });

    socket.on("ticket_resolved", (data) => {
      // A pending dispute for this user just got approved/rejected — bump
      // the signal so any mounted page (History, Notifications) can re-fetch
      // instead of showing stale decision/status data.
      setTicketUpdateSignal((n) => n + 1);
      
      if (data.status === "APPROVED" && data.transaction_id != null) {
        setAlerts((prev) => prev.filter((a) => a.id !== data.transaction_id));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user, isAdmin, addAlert, backfillAlerts]);

  function markSeen(id) {
    if (id == null || !user) return;
    dismissedRef.current.add(id);
    saveDismissedIds(user.uid, dismissedRef.current);
    setDismissedIds(new Set(dismissedRef.current));
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function markAllSeen(ids) {
    if (!user || !ids?.length) return;
    ids.forEach((id) => dismissedRef.current.add(id));
    saveDismissedIds(user.uid, dismissedRef.current);
    setDismissedIds(new Set(dismissedRef.current));
    setAlerts((prev) => prev.filter((a) => !ids.includes(a.id)));
  }

  // Used by the live-alert dismiss (X) button, which only has the alert's _key on hand
  function dismissAlert(key) {
    const target = alerts.find((a) => a._key === key);
    if (target?.id != null) {
      markSeen(target.id); // also filters it out of `alerts`
    } else {
      setAlerts((prev) => prev.filter((a) => a._key !== key));
    }
  }

  return (
    <SocketContext.Provider value={{ connected, alerts, dismissAlert, markSeen, markAllSeen, dismissedIds, ticketUpdateSignal }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}