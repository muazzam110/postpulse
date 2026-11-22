import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, setUnauthenticatedHandler } from "@/api/client";
import { disconnectKey } from "@/api/keyStore";
import { browserTz } from "@/lib/tz";

const Auth = createContext(null);
export const useAuth = () => useContext(Auth);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined until the first /auth/me answer
  const [expired, setExpired] = useState(false);
  const current = useRef();
  current.current = user;

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      if (!current.current) return; // a failed first check is not an expiry
      disconnectKey();
      setExpired(true);
      setUser(null);
    });
    api("/auth/me").then(setUser, () => setUser(null));
    return () => setUnauthenticatedHandler(null);
  }, []);

  const enter = (path, extra) => async (email, password) => {
    const next = await api(path, { method: "POST", body: { email, password, ...extra?.() } });
    setExpired(false);
    setUser(next);
  };
  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    disconnectKey(); // the key must not outlive the session
    setUser(null);
  };

  return <Auth.Provider value={{ user, expired, login: enter("/auth/login"), register: enter("/auth/register", () => ({ timezone: browserTz() })), logout, setTimezone: async (timezone) => setUser(await api("/auth/me", { method: "PATCH", body: { timezone } })) }}>{children}</Auth.Provider>;
}
