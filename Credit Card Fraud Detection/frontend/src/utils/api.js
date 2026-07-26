import { auth } from "../firebase";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function authFetch(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function authFetchBlob(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.blob();
}

export const api = {
    predict:        (payload) => authFetch("/predict", { method: "POST", body: JSON.stringify(payload) }),
    updateProfile: (payload) => authFetch("/profile", { method: "POST", body: JSON.stringify(payload) }),
    getProfile: () => authFetch("/profile"),
    transactions:   ()        => authFetch("/transactions"),
    adminStats:     ()        => authFetch("/admin/stats"),
    setAdmin:       (uid)     => authFetch("/admin/set-admin", { method: "POST", body: JSON.stringify({ uid }) }),
    clearTransactions: (uid) => authFetch(`/admin/clear-transactions?uid=${uid}`, { method: "DELETE" }),
    registeredUsers: () => authFetch("/admin/users"),
    setUserDisabled: (uid, disabled) => authFetch(`/admin/users/${uid}/disable`, { method: "POST", body: JSON.stringify({ disabled }) }),
    scenarios:      ()        => fetch(`${BASE}/scenarios`).then((r) => r.json()),
    districts:      ()        => fetch(`${BASE}/districts`).then((r) => r.json()),
    health:         ()        => fetch(`${BASE}/health`).then((r) => r.json()),
    cards:          ()        => authFetch("/cards"),
    createCard:     (payload) => authFetch("/cards", { method: "POST", body: JSON.stringify(payload) }),
    deleteCard:     (cardId)  => authFetch(`/cards/${cardId}`, { method: "DELETE" }),
    tickets:        ()        => authFetch("/tickets"),
    createTicket:   (payload) => authFetch("/tickets", { method: "POST", body: JSON.stringify(payload) }),
    resolveTicket:  (ticketId, status) => authFetch(`/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    clearTickets: (ticketIds = null) => {
      const options = { method: "DELETE" };
      if (ticketIds) {
        options.body = JSON.stringify({ ticket_ids: ticketIds });
      }
      return authFetch("/admin/clear-tickets", options);
    },
    modelMetrics:   ()        => authFetch("/admin/model-metrics"),
    modelInfo:      ()        => authFetch("/admin/model-info"),
    driftCheck:     (n = 200) => authFetch(`/admin/drift-check?n=${n}`),
    exportReviewedTransactions: () => authFetchBlob("/admin/export-reviewed"),
};