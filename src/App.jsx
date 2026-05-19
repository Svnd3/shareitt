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
import Home from "./pages/Home";
import Join from "./pages/Join";
import Host from "./pages/Host";
import Report from "./pages/Report";
import Auth from "./pages/Auth";
import Pay from "./pages/Pay";

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
  const location = useLocation();
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

  // Handle OAuth redirect params — runs only when URL has auth tokens
  useEffect(() => {
    const hasAuthParams =
      location.search.includes("access_token") ||
      location.search.includes("refresh_token") ||
      location.search.includes("code") ||
      location.search.includes("error") ||
      location.hash.includes("access_token") ||
      location.hash.includes("refresh_token");

    if (!hasAuthParams) return;

    supabase.auth
      .getSessionFromUrl({ storeSession: true })
      .catch((err) => console.error("Supabase auth redirect error:", err.message))
      .finally(() => navigate(location.pathname, { replace: true }));
  }, [location.hash, location.pathname, location.search, navigate]);

  // Main auth + payment init — runs once on mount
  useEffect(() => {
    if (!supabase.auth?.getSession) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const currentSession = data?.session ?? null;
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
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;