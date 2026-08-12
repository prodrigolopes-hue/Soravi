"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { apiBaseUrl } from "../../lib/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  roles: string[];
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  customerProfile: {
    id: string;
  } | null;
  professionalProfile: {
    id: string;
    displayName: string;
    verificationStatus: string;
    isAvailable: boolean;
  } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

interface ApiErrorPayload {
  message?: unknown;
}

interface RefreshResponsePayload {
  data?: {
    accessToken?: string;
  };
}

interface LoginResponsePayload {
  data?: {
    accessToken?: string;
    user?: AuthUser;
  };
}

interface CurrentUserResponsePayload {
  data?: AuthUser;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AuthUser>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    (typeof candidate.phone === "string" || candidate.phone === null) &&
    typeof candidate.status === "string" &&
    Array.isArray(candidate.roles) &&
    typeof candidate.emailVerified === "boolean" &&
    typeof candidate.phoneVerified === "boolean" &&
    typeof candidate.createdAt === "string"
  );
}

interface RefreshSessionResult {
  accessToken: string;
  user: AuthUser;
}

let refreshSessionInFlight:
  | Promise<RefreshSessionResult | null>
  | null = null;

function buildApiUrl(path: string): string {
  const normalizedBase = apiBaseUrl.replace(/\/+$/u, "");

  return `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as ApiErrorPayload;

  if (typeof candidate.message === "string") {
    const message = candidate.message.trim();

    return message.length > 0 ? message : null;
  }

  if (Array.isArray(candidate.message)) {
    for (const item of candidate.message) {
      if (typeof item === "string" && item.trim().length > 0) {
        return item.trim();
      }
    }
  }

  return null;
}

async function fetchCurrentUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch(buildApiUrl("/api/v1/users/me"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    cache: "no-store",
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(payload) ??
        "Não foi possível carregar seus dados de usuário.",
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta inválida do servidor.");
  }

  const data = payload as CurrentUserResponsePayload;

  if (isAuthUser(data.data)) {
    return data.data;
  }

  if (isAuthUser(payload)) {
    return payload;
  }

  throw new Error("Resposta inválida do servidor.");
}

async function requestRefreshSession(): Promise<RefreshSessionResult | null> {
  if (refreshSessionInFlight) {
    return refreshSessionInFlight;
  }

  refreshSessionInFlight = (async () => {
    const response = await fetch(buildApiUrl("/api/v1/auth/refresh"), {
      method: "POST",
      credentials: "include",
    });

    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      return null;
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Resposta inválida do servidor.");
    }

    const data = payload as RefreshResponsePayload;
    const nextAccessToken = data.data?.accessToken;

    if (
      typeof nextAccessToken !== "string" ||
      nextAccessToken.length === 0
    ) {
      throw new Error("Não foi possível renovar sua sessão.");
    }

    const nextUser = await fetchCurrentUser(nextAccessToken);

    return {
      accessToken: nextAccessToken,
      user: nextUser,
    };
  })();

  try {
    return await refreshSessionInFlight;
  } finally {
    refreshSessionInFlight = null;
  }
}

async function waitForRefreshSessionInFlight(): Promise<void> {
  const inFlightRefreshSession = refreshSessionInFlight;

  if (!inFlightRefreshSession) {
    return;
  }

  try {
    await inFlightRefreshSession;
  } catch {
    // O objetivo aqui é apenas serializar operações explícitas
    // após um refresh já iniciado.
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authOperationVersionRef = useRef(0);

  const clearSession = useCallback((): void => {
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    const operationVersion = authOperationVersionRef.current;

    setIsLoading(true);

    try {
      const refreshResult = await requestRefreshSession();

      if (operationVersion !== authOperationVersionRef.current) {
        return;
      }

      if (!refreshResult) {
        clearSession();
        return;
      }

      setAccessToken(refreshResult.accessToken);
      setUser(refreshResult.user);
    } catch {
      if (operationVersion === authOperationVersionRef.current) {
        clearSession();
      }
    } finally {
      if (operationVersion === authOperationVersionRef.current) {
        setIsLoading(false);
      }
    }
  }, [clearSession]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const operationVersion = ++authOperationVersionRef.current;

      setIsLoading(true);

      try {
        await waitForRefreshSessionInFlight();

        const response = await fetch(buildApiUrl("/api/v1/auth/login"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
          credentials: "include",
        });

        const payload = await parseJsonResponse(response);

        if (!response.ok) {
          throw new Error(
            extractErrorMessage(payload) ??
              "Não foi possível entrar. Verifique suas credenciais.",
          );
        }

        if (!payload || typeof payload !== "object") {
          throw new Error("Resposta inválida do servidor.");
        }

        const data = payload as LoginResponsePayload;
        const nextAccessToken = data.data?.accessToken;

        if (
          typeof nextAccessToken !== "string" ||
          nextAccessToken.length === 0
        ) {
          throw new Error("Não foi possível completar o login.");
        }

        const nextUser =
          data.data?.user ?? (await fetchCurrentUser(nextAccessToken));

        if (operationVersion !== authOperationVersionRef.current) {
          return;
        }

        setAccessToken(nextAccessToken);
        setUser(nextUser);
      } catch (error) {
        if (operationVersion === authOperationVersionRef.current) {
          clearSession();
        }

        throw error;
      } finally {
        if (operationVersion === authOperationVersionRef.current) {
          setIsLoading(false);
        }
      }
    },
    [clearSession],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const operationVersion = ++authOperationVersionRef.current;

    setIsLoading(true);

    try {
      await waitForRefreshSessionInFlight();

      await fetch(buildApiUrl("/api/v1/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Mesmo que o backend esteja indisponível, limpamos
      // o estado autenticado mantido em memória no frontend.
    } finally {
      if (operationVersion === authOperationVersionRef.current) {
        clearSession();
        setIsLoading(false);
      }
    }
  }, [clearSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(accessToken && user),
      isLoading,
      signIn,
      signOut,
      refreshSession,
    }),
    [
      accessToken,
      isLoading,
      refreshSession,
      signIn,
      signOut,
      user,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider",
    );
  }

  return context;
}