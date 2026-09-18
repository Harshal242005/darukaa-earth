import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('darukaa_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('darukaa_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem('darukaa_token', data.access_token);
    const me = await authApi.me();
    setUser(me.data);
  };

  const register = async (payload) => {
    const { data } = await authApi.register(payload);
    localStorage.setItem('darukaa_token', data.access_token);
    const me = await authApi.me();
    setUser(me.data);
  };

  const logout = () => {
    localStorage.removeItem('darukaa_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
