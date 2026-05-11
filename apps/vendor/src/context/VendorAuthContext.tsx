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

interface Impersonator {
  email: string;
  full_name: string | null;
}

interface VendorAuthState {
  vendor: VendorProfile | null;
  sessionToken: string | null;
  isFirstLogin: boolean;
  isImpersonation: boolean;
  impersonator: Impersonator | null;
  isLoading: boolean;
  login: (
    sessionToken: string,
    vendor: VendorProfile,
    options?: { isFirstLogin?: boolean }
  ) => void;
  setVendor: (vendor: VendorProfile) => void;
  markWelcomeComplete: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const VendorAuthContext = createContext<VendorAuthState | null>(null);

const STORAGE_KEY = "vendor_session_token";
const WELCOME_KEY = "vendor_welcome_completed";
// When staff opens the vendor portal via "View as vendor", we replace the
// localStorage session with the impersonation token. This flag tells the
// rest of the app to render the impersonation banner and forces a fresh
// validateSession on every refresh.
const IMPERSONATION_KEY = "vendor_session_is_impersonation";

// Pull the impersonate_token URL param at boot. We do this *before* the
// Provider mounts so the URL is clean by the time the router runs.
function consumeImpersonateTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("impersonate_token");
    if (!token) return null;
    url.searchParams.delete("impersonate_token");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + (url.search ? url.search : "") + url.hash,
    );
    // Skip the welcome screen — staff is debugging, not onboarding.
    localStorage.setItem(WELCOME_KEY, "true");
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(IMPERSONATION_KEY, "true");
    return token;
  } catch {
    return null;
  }
}

export function VendorAuthProvider({ children }: { children: ReactNode }) {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isImpersonation, setIsImpersonation] = useState(false);
  const [impersonator, setImpersonator] = useState<Impersonator | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setVendor(null);
    setSessionToken(null);
    setIsFirstLogin(false);
    setIsImpersonation(false);
    setImpersonator(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(IMPERSONATION_KEY);
  }, []);

  const login = useCallback(
    (
      token: string,
      vendorData: VendorProfile,
      options?: { isFirstLogin?: boolean }
    ) => {
      localStorage.setItem(STORAGE_KEY, token);
      // A fresh interactive login is never impersonation. Clear the flag
      // so a subsequent real login doesn't inherit a stale banner.
      localStorage.removeItem(IMPERSONATION_KEY);
      // Clear welcome flag if this is a first login so welcome page shows
      if (options?.isFirstLogin) {
        localStorage.removeItem(WELCOME_KEY);
      }
      setSessionToken(token);
      setVendor(vendorData);
      setIsFirstLogin(!!options?.isFirstLogin);
      setIsImpersonation(false);
      setImpersonator(null);
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
    // Consume any impersonate_token in the URL first so the localStorage
    // is hydrated before we read it.
    consumeImpersonateTokenFromUrl();

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

        // Trust the server: if vendor-auth-session says the row has
        // is_impersonation=true, we render the banner. The localStorage
        // flag is just a fast-path for SSR-safe initial render.
        const impersonating =
          !!result.is_impersonation ||
          localStorage.getItem(IMPERSONATION_KEY) === "true";
        setIsImpersonation(impersonating);
        setImpersonator(result.impersonator ?? null);

        if (impersonating) {
          // Keep the flag in sync with the server's truth.
          if (result.is_impersonation) {
            localStorage.setItem(IMPERSONATION_KEY, "true");
          } else {
            localStorage.removeItem(IMPERSONATION_KEY);
          }
        }

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
        isFirstLogin,
        isImpersonation,
        impersonator,
        isLoading,
        login,
        setVendor,
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
