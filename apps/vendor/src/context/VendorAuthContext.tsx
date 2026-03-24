import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  validateSession,
  logoutSession,
  type VendorProfile,
} from "../api/vendorAuth";

interface VendorAuthState {
  vendor: VendorProfile | null;
  sessionToken: string | null;
  needsPassword: boolean;
  isLoading: boolean;
  login: (sessionToken: string, vendor: VendorProfile, needsPassword?: boolean) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const VendorAuthContext = createContext<VendorAuthState | null>(null);

const STORAGE_KEY = "vendor_session_token";

export function VendorAuthProvider({ children }: { children: ReactNode }) {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setVendor(null);
    setSessionToken(null);
    setNeedsPassword(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(
    (token: string, vendorData: VendorProfile, needsPw?: boolean) => {
      localStorage.setItem(STORAGE_KEY, token);
      setSessionToken(token);
      setVendor(vendorData);
      setNeedsPassword(!!needsPw);
    },
    []
  );

  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await logoutSession(sessionToken);
      } catch {
        // Clear locally even if server call fails
      }
    }
    clearAuth();
  }, [sessionToken, clearAuth]);

  const refreshSession = useCallback(async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      clearAuth();
      setIsLoading(false);
      return;
    }

    try {
      const result = await validateSession(stored);
      if (result.vendor && result.session) {
        setSessionToken(stored);
        setVendor(result.vendor);

        // Check if session is expired
        const expiresAt = new Date(result.session.expires_at);
        if (expiresAt <= new Date()) {
          clearAuth();
        }
      } else {
        clearAuth();
      }
    } catch {
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return (
    <VendorAuthContext.Provider
      value={{ vendor, sessionToken, needsPassword, isLoading, login, logout, refreshSession }}
    >
      {children}
    </VendorAuthContext.Provider>
  );
}

export function useVendorAuth(): VendorAuthState {
  const ctx = useContext(VendorAuthContext);
  if (!ctx) {
    throw new Error("useVendorAuth must be used within VendorAuthProvider");
  }
  return ctx;
}
