import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('darukaa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('darukaa_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login: (email, password) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    return api.post('/api/auth/login', form);
  },
  me: () => api.get('/api/auth/me'),
};

export const projectApi = {
  list: () => api.get('/api/projects'),
  create: (data) => api.post('/api/projects', data),
  get: (id) => api.get(`/api/projects/${id}`),
  remove: (id) => api.delete(`/api/projects/${id}`),
};

export const siteApi = {
  listAll: () => api.get('/api/sites'),
  listForProject: (pid) => api.get(`/api/projects/${pid}/sites`),
  create: (pid, data) => api.post(`/api/projects/${pid}/sites`, data),
  analytics: (sid) => api.get(`/api/sites/${sid}/analytics`),
};

export default api;
