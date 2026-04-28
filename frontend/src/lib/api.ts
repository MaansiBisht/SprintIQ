// All requests proxy through Next.js rewrite (/api/backend/* → backend:4000/api/*)
// so httpOnly cookies are same-origin and travel automatically with credentials:'include'.
const API_BASE = '/api/backend';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/';
  }

  return response;
}

export const api = {
  get: (url: string) => fetchWithAuth(url),
  post: (url: string, data: unknown) =>
    fetchWithAuth(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url: string, data: unknown) =>
    fetchWithAuth(url, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (url: string, data: unknown) =>
    fetchWithAuth(url, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (url: string) => fetchWithAuth(url, { method: 'DELETE' }),
};

export async function getOverview() {
  const res = await api.get('/analytics/overview');
  return res.json();
}

export async function getWorkload() {
  const res = await api.get('/analytics/workload');
  return res.json();
}

export async function getTickets(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await api.get(`/tickets${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function getTicket(id: string) {
  const res = await api.get(`/tickets/${id}`);
  return res.json();
}

export async function autoAssignTicket(id: string) {
  const res = await api.post(`/tickets/${id}/auto-assign`, {});
  return res.json();
}

export async function manualAssignTicket(id: string, developerId: string, reason?: string) {
  const res = await api.patch(`/tickets/${id}/assign`, { developerId, reason });
  return res.json();
}

export async function getDevelopers() {
  const res = await api.get('/developers');
  return res.json();
}

export async function getDeveloperAnalytics(id: string) {
  const res = await api.get(`/developers/${id}/analytics`);
  return res.json();
}

export async function getAssignments(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await api.get(`/assignments${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function getSettings() {
  const res = await api.get('/settings');
  return res.json();
}

export async function updateSettings(settings: Record<string, unknown>) {
  const res = await api.put('/settings', settings);
  return res.json();
}

export async function getJiraStatus() {
  const res = await api.get('/jira/status');
  return res.json();
}

export async function connectJira(baseUrl: string, apiToken: string, userEmail: string) {
  const res = await api.post('/jira/connect', { baseUrl, apiToken, userEmail });
  return res.json();
}

export async function syncJira() {
  const res = await api.post('/jira/sync', {});
  return res.json();
}

export async function logout() {
  await api.post('/auth/logout', {});
}
