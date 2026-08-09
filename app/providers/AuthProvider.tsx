"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onIdTokenChanged, type User } from "firebase/auth";

import { auth } from "@/src/client/firebase-client";
import { syncSession } from "@/src/client/session-sync";
import { isManagedLogin } from "@/src/client/pending-role";

type Role = "customer" | "professional" | "admin" | null;

type AuthContextValue = {
  user: User | null;
  role: Role;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, role: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

async function readRole(user: User): Promise<Role> {
  const result = await user.getIdTokenResult();
  const role = result.claims.role;
  if (role === "customer" || role === "professional" || role === "admin") return role;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  // Sin credenciales de Firebase configuradas (ver README) no hay auth
  // disponible: se arranca directo en "no logueado" en vez de "cargando".
  const [loading, setLoading] = useState(() => !!auth);

  useEffect(() => {
    if (!auth) return;
    // onIdTokenChanged dispara al cargar la página (Firebase recuerda la
    // sesión entre visitas por defecto) y cada vez que el SDK renueva el
    // token en segundo plano: así la cookie __session queda siempre al
    // día sin pedirle al usuario que vuelva a loguearse.
    return onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (!nextUser) {
        setRole(null);
        return;
      }

      if (isManagedLogin()) {
        // El formulario de login/signup esta manejando el sync de sesion
        // explicitamente (eligio un rol para esta sesion). Si este listener
        // tambien llamara a /api/session en paralelo, podria mandar un
        // idToken viejo (cacheado antes del cambio de rol) y pisar el rol
        // recien elegido. Solo actualiza el estado local mientras tanto.
        setRole(await readRole(nextUser));
        return;
      }

      const token = await nextUser.getIdToken();
      const { needsRefresh } = await syncSession(token);
      if (needsRefresh) {
        const freshToken = await nextUser.getIdToken(true);
        await syncSession(freshToken);
      }
      setRole(await readRole(nextUser));
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>{children}</AuthContext.Provider>
  );
}

// El rol se elige en cada login (misma cuenta puede entrar como cliente o
// como profesional). Esta guarda evita que la sesión activa vea u opere
// las pantallas del otro modo navegando por URL directa. "admin" pasa
// cualquier guarda.
export function useRoleGuard(requiredRole: "customer" | "professional", redirectTo: string) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role && role !== requiredRole && role !== "admin") {
      router.replace(redirectTo);
    }
  }, [user, role, loading, router, requiredRole, redirectTo]);

  return { ready: !loading && !!user && (role === requiredRole || role === "admin") };
}
