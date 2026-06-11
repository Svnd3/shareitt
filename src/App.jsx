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

function AuthRoute({
  children,
  authLoading,
  paymentConfirmed,
  session,
  passwordRecovery,
}) {
  // While auth is resolving, render nothing — no flash screen
  if (authLoading) return null;

  // A password-recovery link signs the user in via a one-time token, but
  // they still need to land on the "set new password" form instead of being
  // bounced straight into the app.
  if (session && !passwordRecovery) {
    if (paymentConfirmed) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/pay" replace />;
  }

  return children;
}

// Browsers restore the previous scroll position on reload by default, which
// can land the user mid-page (e.g. on the footer). Take manual control so a
// reload — and every route change — starts at the top of the page instead.
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const paymentConfirmedRef = useRef(false);
  const initDone = useRef(false);
  // Set when the user arrives via a password-reset email link — keeps them
  // on /auth (showing the "set new password" form) instead of the normal
  // signed-in redirects.
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const passwordRecoveryRef = useRef(false);

  const checkPaymentStatus = async (userId) => {
    if (!userId) {
      setPaymentConfirmed(false);
      paymentConfirmedRef.current = false;
      return false;
    }

    let confirmed = false;
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("id")
        .eq("user_id", userId)
        .eq("payment_confirmed", true)
        .limit(1);
      confirmed = !error && Array.isArray(data) && data.length > 0;
    } catch (err) {
      console.error("Payment status check failed:", err);
    }

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

      // Password reset links point straight at /auth with token_hash +
      // type=recovery (see the "Reset Password" email template) — verified
      // directly via verifyOtp, which works even if the link is opened in a
      // different browser/device than the one that requested it (unlike the
      // PKCE "code" flow, which needs a code_verifier from the requesting
      // browser's storage).
      const tokenHash =
        searchParams.get("token_hash") || hashParams.get("token_hash");
      const otpType = searchParams.get("type") || hashParams.get("type");
      const isRecovery = otpType === "recovery";
      passwordRecoveryRef.current = isRecovery;

      const isCallback = Boolean(
        code ||
          tokenHash ||
          (hashAccessToken && hashRefreshToken) ||
          oauthErrorDescription,
      );

      const hasAuthParams =
        searchParams.has("access_token") ||
        searchParams.has("refresh_token") ||
        searchParams.has("code") ||
        searchParams.has("token_hash") ||
        searchParams.has("error") ||
        hashParams.has("access_token") ||
        hashParams.has("refresh_token") ||
        hashParams.has("token_hash") ||
        hashParams.has("error");

      // Codes/tokens are single-use. Strip them from the URL up front so
      // that even if something below throws or hangs, a refresh starts
      // clean (re-running getSession against the persisted session) instead
      // of resending an already-consumed code and getting stuck forever.
      if (hasAuthParams) {
        window.history.replaceState(null, "", window.location.pathname);
      }

      let exchangeFailedMessage = "";
      let sessionFromExchange = null;

      try {
        // detectSessionInUrl is off (see supabaseClient.js), so we exchange
        // the PKCE "code" / hash tokens ourselves with a hard timeout — a
        // hung exchange (e.g. a cold-starting Supabase project) would
        // otherwise block getSession() and every other Supabase call forever.
        if (tokenHash && otpType) {
          try {
            const { data: verifyData, error: verifyError } = await withTimeout(
              supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType }),
              20000,
              "Sign-in timed out. Please try again.",
            );
            if (verifyError) {
              console.error("verifyOtp error:", verifyError);
              exchangeFailedMessage = verifyError.message;
            } else {
              sessionFromExchange = verifyData?.session ?? null;
            }
          } catch (e) {
            console.error("verifyOtp failed:", e);
            exchangeFailedMessage =
              e?.message || "Sign-in timed out. Please try again.";
          }
        } else if (code) {
          try {
            const { data: exchangeData, error: exchangeError } =
              await withTimeout(
                supabase.auth.exchangeCodeForSession(code),
                20000,
                "Sign-in timed out. Please try again.",
              );
            if (exchangeError) {
              console.error("exchangeCodeForSession error:", exchangeError);
              exchangeFailedMessage = exchangeError.message;
            } else {
              sessionFromExchange = exchangeData?.session ?? null;
            }
          } catch (e) {
            console.error("exchangeCodeForSession failed:", e);
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
            if (setErr) {
              console.error("setSession error:", setErr);
              exchangeFailedMessage = setErr.message;
            } else {
              sessionFromExchange = setData?.session ?? null;
            }
          } catch (e) {
            console.error("setSession failed:", e);
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
            console.error("getSession failed:", e);
            // Outside an OAuth callback, a hung session check shouldn't
            // bounce a normal visitor to /auth — just treat it as signed out.
            if (isCallback) {
              exchangeFailedMessage =
                e?.message || "Sign-in timed out. Please try again.";
            }
          }
        }
        if (!mounted) return;

        setSession(currentSession);

        if (currentSession?.user?.id) {
          if (isRecovery) {
            // Keep the user on /auth so they can set a new password instead
            // of being redirected into the app like a normal sign-in.
            setPasswordRecovery(true);
            if (window.location.pathname !== "/auth") {
              navigate("/auth", { replace: true });
            }
          } else {
            const confirmed = await checkPaymentStatus(
              currentSession.user.id,
            );
            if (!mounted) return;

            const currentPath = window.location.pathname;
            if (!confirmed && currentPath !== "/pay") {
              navigate("/pay", { replace: true });
            } else if (confirmed && currentPath === "/pay") {
              navigate("/", { replace: true });
            }
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
      } catch (err) {
        // Catch-all: nothing above should throw, but if something
        // unexpected does, never leave the page stuck on a blank loading
        // state — surface it on /auth instead.
        console.error("Auth init failed:", err);
        if (mounted) {
          navigate("/auth", {
            replace: true,
            state: {
              authError:
                err?.message || "Sign-in didn't complete. Please try again.",
            },
          });
        }
      } finally {
        // Auth loading is done — this is the only place we set it false
        if (mounted) {
          setAuthLoading(false);
          initDone.current = true;
        }
      }
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

        // Only re-check payment on an actual new sign-in. Skip entirely
        // during password recovery — the user needs to land on the
        // "set new password" form, not get bounced into the app.
        if (event === "SIGNED_IN" && !passwordRecoveryRef.current) {
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

  // Called once the user has set a new password on the recovery form —
  // resume the normal post-sign-in flow (payment gate or home).
  const handleRecoveryComplete = async () => {
    setPasswordRecovery(false);
    passwordRecoveryRef.current = false;
    if (session?.user?.id) {
      const confirmed = await checkPaymentStatus(session.user.id);
      navigate(confirmed ? "/" : "/pay", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <>
      <ScrollToTop />
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
            passwordRecovery={passwordRecovery}
          >
            <Auth
              recoveryMode={passwordRecovery}
              onRecoveryComplete={handleRecoveryComplete}
            />
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
    </>
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
