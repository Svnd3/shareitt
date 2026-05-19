import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// ── tiny SVG icons (inline, no extra dependency) ──────────────────────────
const IconLock = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);
const IconEye = ({ open }) =>
  open ? (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
const IconArrowLeft = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);
const IconMail = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);
const IconCheck = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── reusable field ─────────────────────────────────────────────────────────
function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  showToggle = false,
  showToggleValue = false,
  onToggle,
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-widest text-slate-500"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCorrect="off"
          spellCheck="false"
          className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-3 focus:ring-emerald-100 ${showToggle ? "pr-12" : ""}`}
        />
        {showToggle && onToggle && (
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-auto">
            <PasswordToggle showPassword={showToggleValue} toggle={onToggle} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── small presentational components moved to top-level to avoid remounts
const Divider = () => (
  <div className="flex items-center gap-3 text-xs text-slate-400">
    <span className="h-px flex-1 bg-slate-200" />
    <span>or continue with email</span>
    <span className="h-px flex-1 bg-slate-200" />
  </div>
);

function GoogleBtn({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
    >
      <IconGoogle />
      {loading ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}

function PrimaryBtn({ onClick, loading, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A7A3C] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

function Feedback({ error, successMessage }) {
  if (error)
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span className="mt-0.5 shrink-0">⚠</span>
        <span>{error}</span>
      </div>
    );
  if (successMessage)
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span className="mt-0.5 shrink-0 text-emerald-600">
          <IconCheck />
        </span>
        <span>{successMessage}</span>
      </div>
    );
  return null;
}

const TrustBar = () => (
  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
    <IconLock />
    <span>Secured with Supabase Auth · No spam, ever</span>
  </div>
);

function PasswordToggle({ showPassword, toggle }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
      onClick={toggle}
      className="pointer-events-auto text-slate-400 hover:text-slate-600"
    >
      <IconEye open={showPassword} />
    </button>
  );
}

function SignInView(props) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    toggleShowPassword,
    switchMode,
    handleSubmit,
    loading,
    googleLoading,
    handleGoogle,
    error,
    successMessage,
  } = props;

  return (
    <div className="space-y-5">
      <GoogleBtn onClick={handleGoogle} loading={googleLoading} />
      <Divider />
      <Field
        id="auth-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
      />
      <Field
        id="auth-password"
        label="Password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
        showToggle={true}
        showToggleValue={showPassword}
        onToggle={toggleShowPassword}
      />
      <div className="text-right">
        <button
          type="button"
          onClick={() => switchMode("reset")}
          className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-800"
        >
          Forgot password?
        </button>
      </div>
      <Feedback error={error} successMessage={successMessage} />
      <PrimaryBtn onClick={handleSubmit} loading={loading}>
        Sign in to ShareIt
      </PrimaryBtn>
      <p className="text-center text-sm text-slate-500">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={() => switchMode("signUp")}
          className="font-semibold text-slate-900 underline underline-offset-2"
        >
          Sign up free
        </button>
      </p>
    </div>
  );
}

function SignUpView(props) {
  const {
    fullName,
    setFullName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    toggleShowPassword,
    switchMode,
    handleSubmit,
    loading,
    googleLoading,
    handleGoogle,
    error,
    successMessage,
  } = props;

  return (
    <div className="space-y-5">
      <GoogleBtn onClick={handleGoogle} loading={googleLoading} />
      <Divider />
      <Field
        id="auth-full-name"
        label="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Jane Doe"
        autoComplete="name"
      />
      <Field
        id="auth-signup-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
      />
      <Field
        id="auth-signup-password"
        label="Password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 6 characters"
        autoComplete="new-password"
        showToggle={true}
        showToggleValue={showPassword}
        onToggle={toggleShowPassword}
      />
      <Field
        id="auth-confirm-password"
        label="Confirm password"
        type={showPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="new-password"
      />
      <Feedback error={error} successMessage={successMessage} />
      <PrimaryBtn onClick={handleSubmit} loading={loading}>
        Create account
      </PrimaryBtn>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => switchMode("signIn")}
          className="font-semibold text-slate-900 underline underline-offset-2"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

function ResetView(props) {
  const {
    email,
    setEmail,
    switchMode,
    handleSubmit,
    loading,
    error,
    successMessage,
  } = props;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Enter your email and we'll send a password reset link. It expires in 1
        hour.
      </div>
      <Field
        id="auth-reset-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
      />
      <Feedback error={error} successMessage={successMessage} />
      <PrimaryBtn onClick={handleSubmit} loading={loading}>
        <IconMail />
        Send reset link
      </PrimaryBtn>
      <button
        type="button"
        onClick={() => switchMode("signIn")}
        className="flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <IconArrowLeft />
        Back to sign in
      </button>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────
export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState("signIn"); // "signIn" | "signUp" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const appUrl = (
    import.meta.env.VITE_APP_URL || window.location.origin
  ).replace(/\/$/, "");
  const redirectTo = location.state?.from || "/pay";

  const clear = () => {
    setError("");
    setSuccessMessage("");
  };
  const switchMode = (next) => {
    setMode(next);
    clear();
    setPassword("");
    setConfirmPassword("");
  };

  // ── Google OAuth ──
  const handleGoogle = async () => {
    clear();
    setGoogleLoading(true);
    const dest = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${appUrl}${dest}` },
    });
    setGoogleLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data?.url) window.location.href = data.url;
  };

  // ── Email submit ──
  const handleSubmit = async () => {
    clear();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    // Password reset
    if (mode === "reset") {
      setLoading(true);
      const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/auth`,
      });
      setLoading(false);
      if (e) {
        setError(e.message);
        return;
      }
      setSuccessMessage(
        "Reset link sent — check your inbox (and spam folder).\n",
      );
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "signUp") {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    const result =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signUp") {
      setSuccessMessage(
        "Account created! Check your email to confirm before signing in.",
      );
      return;
    }
    // After email sign-in, let App.jsx handle post-auth redirects (payment gate)
    navigate("/");
  };

  // use top-level view components and pass current state/handlers as props

  // ──────────────────────────────────────────────────────────────────────────
  // Page titles per mode
  // ──────────────────────────────────────────────────────────────────────────
  const titles = {
    signIn: { label: "Welcome back", sub: "Sign in to your ShareIt account" },
    signUp: {
      label: "Create an account",
      sub: "Join ShareIt and start sharing subscriptions",
    },
    reset: { label: "Reset password", sub: "We'll email you a secure link" },
  };
  const { label, sub } = titles[mode];

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header strip */}
          <div className="border-b border-slate-100 px-8 py-7">
            {/* Logo / brand */}
            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A7A3C]">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900">
                ShareIt
              </span>
            </div>

            <h1 className="text-2xl font-semibold text-slate-950">{label}</h1>
            <p className="mt-1 text-sm text-slate-500">{sub}</p>
          </div>

          {/* Form area */}
          <div className="px-8 py-7">
            {mode === "signIn" && (
              <SignInView
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                toggleShowPassword={() => setShowPassword((v) => !v)}
                switchMode={switchMode}
                handleSubmit={handleSubmit}
                loading={loading}
                googleLoading={googleLoading}
                handleGoogle={handleGoogle}
                error={error}
                successMessage={successMessage}
              />
            )}
            {mode === "signUp" && (
              <SignUpView
                fullName={fullName}
                setFullName={setFullName}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                showPassword={showPassword}
                toggleShowPassword={() => setShowPassword((v) => !v)}
                switchMode={switchMode}
                handleSubmit={handleSubmit}
                loading={loading}
                googleLoading={googleLoading}
                handleGoogle={handleGoogle}
                error={error}
                successMessage={successMessage}
              />
            )}
            {mode === "reset" && (
              <ResetView
                email={email}
                setEmail={setEmail}
                switchMode={switchMode}
                handleSubmit={handleSubmit}
                loading={loading}
                error={error}
                successMessage={successMessage}
              />
            )}
          </div>

          {/* Footer strip */}
          <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50 px-8 py-4">
            <TrustBar />
          </div>
        </div>

        {/* Below-card links */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-800">
            ← Back to home
          </Link>
          <span className="text-slate-300">·</span>
          <Link to="/host" className="hover:text-slate-800">
            Host a family
          </Link>
        </div>
      </div>
    </main>
  );
}
