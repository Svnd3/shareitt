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
import { initGA, trackPageView } from "./lib/analytics";
import { friendlyAuthError } from "./lib/authErrors";
import {
  sendAdminLoginReportEmail,
  sendAdminNewSignupEmail,
} from "./lib/sendEmail";
import Home from "./pages/Home";
import Join from "./pages/Join";
import Host from "./pages/Host";
import Account from "./pages/Account";
import Report from "./pages/Report";
import Auth from "./pages/Auth";
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

function AuthRoute({ children, authLoading, session, passwordRecovery }) {
  // While auth is resolving, render nothing — no flash screen
  if (authLoading) return null;

  // A password-recovery link signs the user in via a one-time token, but
  // they still need to land on the "set new password" form instead of being
  // bounced straight into the app.
  if (session && !passwordRecovery) {
    return <Navigate to="/" replace />;
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

// Sends a GA4 page_view on every route change — gtag's own automatic
// page_view only fires once on initial script load, which would miss every
// subsequent in-app navigation in this single-page app.
function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const initDone = useRef(false);
  // Set when the user arrives via a password-reset email link — keeps them
  // on /auth (showing the "set new password" form) instead of the normal
  // signed-in redirects.
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const passwordRecoveryRef = useRef(false);
  // supabase-js re-fires SIGNED_IN (not just TOKEN_REFRESHED) when a tab
  // regains focus and silently refreshes its token — without this guard
  // every tab-switch would trigger another login-report email. Tracks the
  // last user id we've already reported on, cleared on SIGNED_OUT so the
  // next real sign-in (same or different user) reports again.
  const lastReportedUserId = useRef(null);

  // Main auth init — runs once on mount
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
        lastReportedUserId.current = currentSession?.user?.id ?? null;

        if (currentSession?.user?.id) {
          if (isRecovery) {
            // Keep the user on /auth so they can set a new password instead
            // of being redirected into the app like a normal sign-in.
            setPasswordRecovery(true);
            if (window.location.pathname !== "/auth") {
              navigate("/auth", { replace: true });
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
              authError: friendlyAuthError(
                oauthErrorDescription || exchangeFailedMessage,
                { fallback: "Sign-in didn't complete. Please try again." },
              ),
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
              authError: friendlyAuthError(err?.message, {
                fallback: "Sign-in didn't complete. Please try again.",
              }),
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

        // Ignore events that fire before init() completes — init handles
        // first load itself (including setting lastReportedUserId). Without
        // this, supabase-js's own session-recovery SIGNED_IN event — fired
        // on every page refresh, before init() has set lastReportedUserId —
        // looks like a brand-new login and sends a login-report email on
        // every refresh.
        if (
          !initDone.current &&
          (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")
        )
          return;

        setSession(newSession);

        if (event === "SIGNED_OUT") {
          lastReportedUserId.current = null;
          return;
        }

        // supabase-js fires this dedicated event whenever a session comes
        // from a recovery link, regardless of whether the redirect carried
        // hash tokens, a PKCE code, or a bare type=recovery param — unlike
        // parsing the URL ourselves (see init() above), this doesn't depend
        // on GoTrue preserving "type=recovery" through the redirect.
        if (event === "PASSWORD_RECOVERY") {
          passwordRecoveryRef.current = true;
          setPasswordRecovery(true);
          if (window.location.pathname !== "/auth") {
            navigate("/auth", { replace: true });
          }
          return;
        }

        if (!newSession?.user?.id) return;

        // Skip entirely during password recovery — the user needs to land
        // on the "set new password" form, not get bounced into the app.
        // Also skip if we've already reported this user's session — tab
        // focus silently refreshes the token and re-fires SIGNED_IN, which
        // would otherwise send a duplicate report on every tab switch.
        if (
          event === "SIGNED_IN" &&
          !passwordRecoveryRef.current &&
          lastReportedUserId.current !== newSession.user.id
        ) {
          lastReportedUserId.current = newSession.user.id;

          // created_at and last_sign_in_at land within milliseconds of each
          // other only on a brand-new account's very first session — every
          // later sign-in moves last_sign_in_at forward while created_at
          // stays fixed. Used instead of a "just signed up" flag so this
          // catches every entry point (email/password, phone OTP, OAuth)
          // from one place.
          const createdAt = newSession.user.created_at
            ? new Date(newSession.user.created_at).getTime()
            : null;
          const lastSignInAt = newSession.user.last_sign_in_at
            ? new Date(newSession.user.last_sign_in_at).getTime()
            : null;
          const isNewSignup =
            createdAt &&
            lastSignInAt &&
            Math.abs(lastSignInAt - createdAt) < 5000;

          // Resend's free tier is quota-limited, so only one notification
          // goes out per sign-in — the admin report, not a "you signed in"
          // email to the user. New signups still get their own admin email;
          // returning logins get the login report instead.
          if (isNewSignup) {
            sendAdminNewSignupEmail({
              userEmail: newSession.user.email,
              userName: newSession.user.user_metadata?.full_name,
              userPhone: newSession.user.phone,
              method: newSession.user.app_metadata?.provider,
              signedUpAt: newSession.user.created_at,
            }).catch((error) => {
              console.error("Admin new-signup email failed:", error);
            });
          } else {
            sendAdminLoginReportEmail({
              userEmail: newSession.user.email,
              userName: newSession.user.user_metadata?.full_name,
              method: newSession.user.app_metadata?.provider,
              signedInAt: newSession.user.last_sign_in_at,
            }).catch((error) => {
              console.error("Admin login-report email failed:", error);
            });
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
  // resume the normal post-sign-in flow.
  const handleRecoveryComplete = () => {
    setPasswordRecovery(false);
    passwordRecoveryRef.current = false;
    navigate("/", { replace: true });
  };

  return (
    <>
      <ScrollToTop />
      <AnalyticsTracker />
      <Routes>
      <Route
        path="/"
        element={<Home session={session} authLoading={authLoading} />}
      />
      <Route path="/join/:familyId" element={<Join />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route
        path="/host"
        element={
          <ProtectedRoute authLoading={authLoading} session={session}>
            <Host />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute authLoading={authLoading} session={session}>
            <Account session={session} authLoading={authLoading} />
          </ProtectedRoute>
        }
      />
      <Route path="/report" element={<Report />} />
      <Route
        path="/auth"
        element={
          <AuthRoute
            authLoading={authLoading}
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
