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
  isFirstLogin: boolean;
  isLoading: boolean;
  login: (
    sessionToken: string,
    vendor: VendorProfile,
    options?: { needsPassword?: boolean; isFirstLogin?: boolean }
  ) => void;
  markWelcomeComplete: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const VendorAuthContext = createContext<VendorAuthState | null>(null);

const STORAGE_KEY = "vendor_session_token";
const WELCOME_KEY = "vendor_welcome_completed";

export function VendorAuthProvider({ children }: { children: ReactNode }) {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setVendor(null);
    setSessionToken(null);
    setNeedsPassword(false);
    setIsFirstLogin(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(
    (
      token: string,
      vendorData: VendorProfile,
      options?: { needsPassword?: boolean; isFirstLogin?: boolean }
    ) => {
      localStorage.setItem(STORAGE_KEY, token);
      // Clear welcome flag if this is a first login so welcome page shows
      if (options?.isFirstLogin) {
        localStorage.removeItem(WELCOME_KEY);
      }
      setSessionToken(token);
      setVendor(vendorData);
      setNeedsPassword(!!options?.needsPassword);
      setIsFirstLogin(!!options?.isFirstLogin);
    },
    []
  );

  const markWelcomeComplete = useCallback(() => {
    localStorage.setItem(WELCOME_KEY, "true");
    setIsFirstLogin(false);
  }, []);

  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await logoutSession(sessionToken);
      } catch {
        // Clear locally even if server call fails
      }
    }
    localStorage.removeItem(WELCOME_KEY);
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

        // On refresh, first login is determined by localStorage flag
        const welcomeCompleted = localStorage.getItem(WELCOME_KEY) === "true";
        setIsFirstLogin(!welcomeCompleted && !!result.is_first_login);
        setNeedsPassword(!!result.needs_password);

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
      value={{
        vendor,
        sessionToken,
        needsPassword,
        isFirstLogin,
        isLoading,
        login,
        markWelcomeComplete,
        logout,
        refreshSession,
      }}
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
