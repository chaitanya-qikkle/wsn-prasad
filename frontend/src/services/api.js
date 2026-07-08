import axios from 'axios';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.detail || error.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export const wsnApi = {
  // Network
  getNodes:        ()       => api.get('/api/nodes'),
  getTopology:     ()       => api.get('/api/nodes/topology'),

  // Trust
  getTrust:        ()       => api.get('/api/attacks/trust'),

  // Attacks / detection
  getAttacks:      (params) => api.get('/api/attacks', { params }),
  isolateNode:     (uid)    => api.post(`/api/nodes/${uid}/isolate`),
  restoreNode:     (uid)    => api.post(`/api/nodes/${uid}/restore`),

  // Blockchain ledger
  getLedger:       ()       => api.get('/api/ledger'),
  verifyChain:     ()       => api.get('/api/ledger/verify'),

  // Routing
  getRoutes:       ()       => api.get('/api/routes'),
  reroute:         (data)   => api.post('/api/routes/reconfigure', data),

  // Simulation
  startSim:        (data)   => api.post('/api/sim/start', data),
  injectAttack:    (data)   => api.post('/api/sim/attack', data),
  getSnapshot:     ()       => api.get('/api/sim/snapshot'),
  getMetrics:      ()       => api.get('/api/metrics'),

  // Dashboard
  getDashboard:    ()       => api.get('/api/sim/dashboard'),
};

export default api;
