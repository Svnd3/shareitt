import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { sendSignInEmail } from "./lib/sendEmail";
import Home from "./pages/Home";
import Join from "./pages/Join";
import Host from "./pages/Host";
import Report from "./pages/Report";
import Auth from "./pages/Auth";
import Pay from "./pages/Pay";
import EscrowPay from "./pages/EscrowPay";
import HowItWorksPage from "./pages/HowItWorks";
import Footer from "./components/Footer";
import { ToastProvider } from "./components/ToastProvider";

// Rejects after `ms` if `promise` hasn't settled — used so a hung Supabase
// auth request (e.g. a cold-starting project) can't freeze the app forever.
function withTimeout(promise, ms, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage || "Request timed out."));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function ProtectedRoute({ children, authLoading, session }) {
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  return children;
}

function PayRoute({ children, authLoading, paymentConfirmed, session }) {
  // While auth is resolving, render nothing — no flash screen
  if (authLoading) return null;

  if (!session) {
    return <Navigate to="/auth" state={{ from: "/pay" }} replace />;
  }

  if (paymentConfirmed) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AuthRoute({ children, authLoading, paymentConfirmed, session }) {
  // While auth is resolving, render nothing — no flash screen
  if (authLoading) return null;

  if (session) {
    if (paymentConfirmed) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/pay" replace />;
  }

  return children;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const paymentConfirmedRef = useRef(false);
  const initDone = useRef(false);

  const checkPaymentStatus = async (userId) => {
    if (!userId) {
      setPaymentConfirmed(false);
      paymentConfirmedRef.current = false;
      return false;
    }

    const { data, error } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", userId)
      .eq("payment_confirmed", true)
      .limit(1);

    const confirmed = !error && Array.isArray(data) && data.length > 0;
    setPaymentConfirmed(confirmed);
    paymentConfirmedRef.current = confirmed;
    return confirmed;
  };

  // Main auth + payment init — runs once on mount
  useEffect(() => {
    if (!supabase.auth?.getSession) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );

      const oauthErrorDescription =
        searchParams.get("error_description") ||
        hashParams.get("error_description") ||
        searchParams.get("error") ||
        hashParams.get("error");
      const code = searchParams.get("code");
      const hashAccessToken = hashParams.get("access_token");
      const hashRefreshToken = hashParams.get("refresh_token");

      const isCallback = Boolean(
        code || (hashAccessToken && hashRefreshToken) || oauthErrorDescription,
      );

      // detectSessionInUrl is off (see supabaseClient.js), so we exchange
      // the PKCE "code" / hash tokens ourselves with a hard timeout — a
      // hung exchange (e.g. a cold-starting Supabase project) would
      // otherwise block getSession() and every other Supabase call forever.
      let exchangeFailedMessage = "";
      let sessionFromExchange = null;
      if (code) {
        try {
          const { data: exchangeData, error: exchangeError } =
            await withTimeout(
              supabase.auth.exchangeCodeForSession(code),
              20000,
              "Sign-in timed out. Please try again.",
            );
          if (exchangeError) exchangeFailedMessage = exchangeError.message;
          else sessionFromExchange = exchangeData?.session ?? null;
        } catch (e) {
          exchangeFailedMessage =
            e?.message || "Sign-in timed out. Please try again.";
        }
      } else if (hashAccessToken && hashRefreshToken) {
        try {
          const { data: setData, error: setErr } = await withTimeout(
            supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken,
            }),
            20000,
            "Sign-in timed out. Please try again.",
          );
          if (setErr) exchangeFailedMessage = setErr.message;
          else sessionFromExchange = setData?.session ?? null;
        } catch (e) {
          exchangeFailedMessage =
            e?.message || "Sign-in timed out. Please try again.";
        }
      }

      if (!mounted) return;

      // getSession() awaits the same internal auth lock as the exchange
      // call above — if that exchange hung, getSession() would hang too.
      // Skip it when the exchange already gave us a session or failed.
      let currentSession = sessionFromExchange;
      if (!currentSession && !exchangeFailedMessage) {
        try {
          const { data } = await withTimeout(
            supabase.auth.getSession(),
            20000,
            "Sign-in timed out. Please try again.",
          );
          currentSession = data?.session ?? null;
        } catch (e) {
          // Outside an OAuth callback, a hung session check shouldn't
          // bounce a normal visitor to /auth — just treat it as signed out.
          if (isCallback) {
            exchangeFailedMessage =
              e?.message || "Sign-in timed out. Please try again.";
          }
        }
      }
      if (!mounted) return;

      const hasAuthParams =
        searchParams.has("access_token") ||
        searchParams.has("refresh_token") ||
        searchParams.has("code") ||
        searchParams.has("error") ||
        hashParams.has("access_token") ||
        hashParams.has("refresh_token") ||
        hashParams.has("error");

      if (hasAuthParams) {
        window.history.replaceState(null, "", window.location.pathname);
      }

      setSession(currentSession);

      if (currentSession?.user?.id) {
        const confirmed = await checkPaymentStatus(currentSession.user.id);
        if (!mounted) return;

        const currentPath = window.location.pathname;
        if (!confirmed && currentPath !== "/pay") {
          navigate("/pay", { replace: true });
        } else if (confirmed && currentPath === "/pay") {
          navigate("/", { replace: true });
        }
      } else if (oauthErrorDescription || exchangeFailedMessage) {
        // OAuth redirected back but no session resulted — either the
        // provider/Supabase reported an error, or the code/token exchange
        // failed or timed out. Surface this on /auth instead of silently
        // bouncing the user back.
        navigate("/auth", {
          replace: true,
          state: {
            authError:
              oauthErrorDescription ||
              exchangeFailedMessage ||
              "Sign-in didn't complete. Please try again.",
          },
        });
      }

      // Auth loading is done — this is the only place we set it false
      setAuthLoading(false);
      initDone.current = true;
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // Ignore events that fire before init() completes — init handles first load
        if (!initDone.current && event === "TOKEN_REFRESHED") return;

        setSession(newSession);

        if (!newSession?.user?.id) {
          setPaymentConfirmed(false);
          paymentConfirmedRef.current = false;
          return;
        }

        // If we already know payment is confirmed, skip the DB check
        if (paymentConfirmedRef.current) {
          if (window.location.pathname === "/pay") {
            navigate("/", { replace: true });
          }
          return;
        }

        // Only re-check payment on an actual new sign-in
        if (event === "SIGNED_IN") {
          if (newSession.user.email) {
            sendSignInEmail({
              email: newSession.user.email,
              name: newSession.user.user_metadata?.full_name,
            }).catch((error) => {
              console.error("Sign-in email failed:", error);
            });
          }

          const confirmed = await checkPaymentStatus(newSession.user.id);
          if (!mounted) return;

          const currentPath = window.location.pathname;
          if (!confirmed && currentPath !== "/pay") {
            navigate("/pay", { replace: true });
          } else if (confirmed && currentPath === "/pay") {
            navigate("/", { replace: true });
          }
        }
      },
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []); // Empty deps — runs once on mount only. navigate is stable.

  return (
    <Routes>
      <Route
        path="/"
        element={<Home session={session} authLoading={authLoading} />}
      />
      <Route path="/join/:familyId" element={<Join />} />
      <Route path="/pay-escrow/:familyId" element={<EscrowPay />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route
        path="/host"
        element={
          <ProtectedRoute authLoading={authLoading} session={session}>
            <Host />
          </ProtectedRoute>
        }
      />
      <Route path="/report" element={<Report />} />
      <Route
        path="/auth"
        element={
          <AuthRoute
            authLoading={authLoading}
            paymentConfirmed={paymentConfirmed}
            session={session}
          >
            <Auth />
          </AuthRoute>
        }
      />
      <Route
        path="/pay"
        element={
          <PayRoute
            authLoading={authLoading}
            paymentConfirmed={paymentConfirmed}
            session={session}
          >
            <Pay />
          </PayRoute>
        }
      />
      <Route
        path="*"
        element={<Home session={session} authLoading={authLoading} />}
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
        <Footer />
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
