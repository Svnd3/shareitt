import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { sendWelcomeEmail } from "../lib/sendEmail";

// Feature flags — flip these on once the corresponding provider is configured
// in the Supabase dashboard (Authentication > Providers). Until then these
// sign-in options stay hidden so users don't hit "provider not enabled" errors.
const ENABLE_GOOGLE_AUTH = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true";
const ENABLE_APPLE_AUTH = import.meta.env.VITE_ENABLE_APPLE_AUTH === "true";
const ENABLE_FACEBOOK_AUTH =
  import.meta.env.VITE_ENABLE_FACEBOOK_AUTH === "true";
const ENABLE_PHONE_AUTH = import.meta.env.VITE_ENABLE_PHONE_AUTH === "true";
const HAS_SOCIAL_OPTIONS =
  ENABLE_GOOGLE_AUTH ||
  ENABLE_APPLE_AUTH ||
  ENABLE_FACEBOOK_AUTH ||
  ENABLE_PHONE_AUTH;

// hCaptcha site key — Supabase Attack Protection requires a captchaToken on
// signInWithPassword/signUp/signInWithOtp/OAuth calls. Switched from
// Cloudflare Turnstile because challenges.cloudflare.com is unreachable in
// our region.
const HCAPTCHA_SITE_KEY = "6e2cd186-3970-468e-9502-0a58b80ea3ee";
const HCAPTCHA_SCRIPT_SRC = "https://js.hcaptcha.com/1/api.js";

// Password-reset emails always link back to the production site, regardless
// of which origin (preview deploy, localhost, etc.) the request was sent
// from — this must match an allow-listed Redirect URL in the Supabase
// dashboard (Authentication > URL Configuration).
const PASSWORD_RESET_REDIRECT = "https://shareitt.xyz/auth";

// ── tiny SVG icons (inline, no extra dependency) ──────────────────────────
const Spinner = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
);

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
const IconFacebook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#1877F2"
      d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
    />
  </svg>
);
const IconApple = ({ light = false }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={light ? "#fff" : "#000"}>
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.014-.1-.04-.4-.04-.7 0-1.13.55-2.27 1.22-3 .79-.85 2.13-1.5 3.13-1.55.01.13.03.4.03.63zM20.7 17.07c-.4.93-.59 1.34-1.1 2.16-.71 1.14-1.71 2.56-2.95 2.57-1.1.01-1.39-.71-2.88-.7-1.49.01-1.81.72-2.91.71-1.24-.01-2.18-1.29-2.89-2.43-1.98-3.16-2.19-6.87-.97-8.85.87-1.41 2.24-2.24 3.53-2.24 1.31 0 2.13.72 3.21.72 1.05 0 1.69-.72 3.21-.72 1.15 0 2.36.62 3.23 1.7-2.84 1.56-2.38 5.62.52 6.98z" />
  </svg>
);
const IconPhone = () => (
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
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
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

// ── security helpers ────────────────────────────────────────────────────────
// Client-side brute-force friction. This is a UX deterrent only — the real
// protection is Supabase's server-side auth rate limiting. We never store
// emails or passwords here, just a generic attempt counter.
const ATTEMPTS_KEY = "shareit_signin_attempts";
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 5 * 60 * 1000;

function getAttemptState() {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return { count: 0, first: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, first: 0, lockedUntil: 0 };
  }
}
function recordFailedAttempt() {
  const now = Date.now();
  let state = getAttemptState();
  if (now - state.first > ATTEMPT_WINDOW_MS) {
    state = { count: 0, first: now, lockedUntil: 0 };
  }
  state.count += 1;
  if (state.count >= MAX_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_MS;
  }
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors (private browsing, quota, etc.)
  }
  return state;
}
function clearAttempts() {
  try {
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // ignore
  }
}
function formatRemaining(untilTs, fromTs = Date.now()) {
  const secs = Math.max(0, Math.ceil((untilTs - fromTs) / 1000));
  return formatSeconds(secs);
}
function formatSeconds(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// A short blocklist of the most common breached passwords.
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "11111111",
  "abc12345",
  "123123123",
  "letmein123",
  "admin1234",
  "iloveyou1",
  "welcome123",
  "monkey123",
  "football1",
  "passw0rd",
  "sunshine1",
  "princess1",
]);

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "bg-slate-200" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: "Too weak", color: "bg-red-400" },
    { label: "Weak", color: "bg-red-400" },
    { label: "Fair", color: "bg-amber-400" },
    { label: "Good", color: "bg-emerald-400" },
    { label: "Strong", color: "bg-emerald-500" },
    { label: "Very strong", color: "bg-emerald-600" },
  ];
  return { score, ...levels[Math.min(score, levels.length - 1)] };
}

// Normalize common Kenyan phone formats to E.164 (+2547XXXXXXXX).
function toE164Kenya(input) {
  const digits = input.replace(/\D/g, "");
  if (/^254\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `+254${digits}`;
  return null;
}

// ── reusable field ─────────────────────────────────────────────────────────
function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
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
          inputMode={inputMode}
          maxLength={maxLength}
          autoCorrect="off"
          spellCheck="false"
          className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-3 focus:ring-slate-100 ${showToggle ? "pr-12" : ""}`}
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
const Divider = ({ text = "or continue with email" }) => (
  <div className="flex items-center gap-3 text-xs text-slate-400">
    <span className="h-px flex-1 bg-slate-200" />
    <span>{text}</span>
    <span className="h-px flex-1 bg-slate-200" />
  </div>
);

function OAuthButton({ icon, label, onClick, loading, disabled, dark = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex w-full items-center justify-center gap-3 rounded-xl border px-5 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-60 ${
        dark
          ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-md"
      }`}
    >
      {loading ? <Spinner /> : icon}
      {loading ? "Redirecting…" : label}
    </button>
  );
}

function PrimaryBtn({ onClick, loading, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A7A3C] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Feedback({ error, successMessage }) {
  if (error)
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        <span className="mt-0.5 shrink-0">⚠</span>
        <span className="whitespace-pre-line">{error}</span>
      </div>
    );
  if (successMessage)
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      >
        <span className="mt-0.5 shrink-0 text-emerald-600">
          <IconCheck />
        </span>
        <span className="whitespace-pre-line">{successMessage}</span>
      </div>
    );
  return null;
}

const TrustBar = () => (
  <div className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
    <IconLock />
    <span>Encrypted &amp; rate-limited · Secured with Supabase Auth</span>
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

function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const { score, label, color } = getPasswordStrength(password);
  const pct = Math.min(100, (score / 5) * 100);
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function HCaptchaWidget({ containerRef }) {
  return (
    <div className="flex justify-center">
      <div ref={containerRef} />
    </div>
  );
}

// ── shared OAuth + phone block ──────────────────────────────────────────────
function SocialOptions({ oauthLoading, handleOAuth, switchMode }) {
  const extraProviders = [];
  if (ENABLE_APPLE_AUTH) {
    extraProviders.push(
      <OAuthButton
        key="apple"
        icon={<IconApple light />}
        label="Apple"
        dark
        onClick={() => handleOAuth("apple")}
        loading={oauthLoading === "apple"}
        disabled={Boolean(oauthLoading)}
      />,
    );
  }
  if (ENABLE_FACEBOOK_AUTH) {
    extraProviders.push(
      <OAuthButton
        key="facebook"
        icon={<IconFacebook />}
        label="Facebook"
        onClick={() => handleOAuth("facebook")}
        loading={oauthLoading === "facebook"}
        disabled={Boolean(oauthLoading)}
      />,
    );
  }

  if (!HAS_SOCIAL_OPTIONS) return null;

  return (
    <div className="space-y-3">
      {ENABLE_GOOGLE_AUTH && (
        <OAuthButton
          icon={<IconGoogle />}
          label="Continue with Google"
          onClick={() => handleOAuth("google")}
          loading={oauthLoading === "google"}
          disabled={Boolean(oauthLoading)}
        />
      )}
      {extraProviders.length > 0 && (
        <div
          className={
            extraProviders.length > 1 ? "grid grid-cols-2 gap-3" : ""
          }
        >
          {extraProviders}
        </div>
      )}
      {ENABLE_PHONE_AUTH && (
        <button
          type="button"
          onClick={() => switchMode("phone")}
          disabled={Boolean(oauthLoading)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
        >
          <IconPhone />
          Continue with phone
        </button>
      )}
    </div>
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
    oauthLoading,
    handleOAuth,
    error,
    successMessage,
    lockoutRemaining,
  } = props;

  return (
    <div className="space-y-5">
      {HAS_SOCIAL_OPTIONS && (
        <>
          <SocialOptions
            oauthLoading={oauthLoading}
            handleOAuth={handleOAuth}
            switchMode={switchMode}
          />
          <Divider />
        </>
      )}
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
      <PrimaryBtn
        onClick={handleSubmit}
        loading={loading}
        disabled={lockoutRemaining > 0}
      >
        {lockoutRemaining > 0
          ? `Try again in ${formatSeconds(lockoutRemaining)}`
          : "Sign in to ShareIt"}
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
    oauthLoading,
    handleOAuth,
    error,
    successMessage,
  } = props;

  return (
    <div className="space-y-5">
      {HAS_SOCIAL_OPTIONS && (
        <>
          <SocialOptions
            oauthLoading={oauthLoading}
            handleOAuth={handleOAuth}
            switchMode={switchMode}
          />
          <Divider />
        </>
      )}
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
      <div className="space-y-2">
        <Field
          id="auth-signup-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          showToggle={true}
          showToggleValue={showPassword}
          onToggle={toggleShowPassword}
        />
        <PasswordStrengthMeter password={password} />
      </div>
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

function UpdatePasswordView(props) {
  const {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    toggleShowPassword,
    handleSubmit,
    loading,
    error,
    successMessage,
  } = props;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Choose a new password for your ShareIt account.
      </div>
      <div className="space-y-2">
        <Field
          id="auth-new-password"
          label="New password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          showToggle={true}
          showToggleValue={showPassword}
          onToggle={toggleShowPassword}
        />
        <PasswordStrengthMeter password={password} />
      </div>
      <Field
        id="auth-confirm-new-password"
        label="Confirm new password"
        type={showPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="new-password"
      />
      <Feedback error={error} successMessage={successMessage} />
      <PrimaryBtn onClick={handleSubmit} loading={loading}>
        Update password
      </PrimaryBtn>
    </div>
  );
}

function PhoneView(props) {
  const {
    phone,
    setPhone,
    otp,
    setOtp,
    phoneStep,
    handlePhoneRequest,
    handlePhoneVerify,
    handlePhoneResend,
    resendRemaining,
    switchMode,
    loading,
    error,
    successMessage,
  } = props;

  return (
    <div className="space-y-5">
      {phoneStep === "request" ? (
        <>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            We'll text a 6-digit one-time code to verify your number. No
            password needed.
          </div>
          <Field
            id="auth-phone"
            label="Phone number"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0712345678"
            autoComplete="tel"
          />
          <Feedback error={error} successMessage={successMessage} />
          <PrimaryBtn onClick={handlePhoneRequest} loading={loading}>
            Send code
          </PrimaryBtn>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Enter the 6-digit code sent to <strong>{phone}</strong>.
          </div>
          <Field
            id="auth-otp"
            label="Verification code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            autoComplete="one-time-code"
          />
          <Feedback error={error} successMessage={successMessage} />
          <PrimaryBtn onClick={handlePhoneVerify} loading={loading}>
            Verify &amp; sign in
          </PrimaryBtn>
          <button
            type="button"
            onClick={handlePhoneResend}
            disabled={resendRemaining > 0 || loading}
            className="w-full text-center text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
          >
            {resendRemaining > 0
              ? `Resend code in ${resendRemaining}s`
              : "Resend code"}
          </button>
        </>
      )}
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
export default function Auth({ recoveryMode = false, onRecoveryComplete }) {
  const location = useLocation();
  const navigate = useNavigate();

  // "signIn" | "signUp" | "reset" | "phone" | "updatePassword"
  const [mode, setMode] = useState(() =>
    recoveryMode ? "updatePassword" : "signIn",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState("");
  // OAuth failures bounced back from App.jsx (e.g. provider error, or a
  // failed PKCE code exchange) arrive via navigation state.
  const [error, setError] = useState(() => location.state?.authError || "");
  const [successMessage, setSuccessMessage] = useState("");

  // Phone / OTP sign-in state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState("request"); // "request" | "verify"
  const [resendAvailableAt, setResendAvailableAt] = useState(0);

  // Brute-force lockout countdown
  const [lockoutUntil, setLockoutUntil] = useState(
    () => getAttemptState().lockedUntil || 0,
  );
  const [now, setNow] = useState(() => Date.now());

  // hCaptcha CAPTCHA
  const [captchaToken, setCaptchaToken] = useState("");
  const [hcaptchaReady, setHcaptchaReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.hcaptcha),
  );
  // If the hCaptcha script can't load (e.g. blocked in this region), don't
  // permanently block sign-in/sign-up behind a challenge that can never
  // render — let the submit go through without a token.
  const [hcaptchaLoadFailed, setHcaptchaLoadFailed] = useState(false);
  const hcaptchaContainerRef = useRef(null);
  const hcaptchaWidgetIdRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load the hCaptcha script once (shared across mounts via script id).
  // If window.hcaptcha already exists, the lazy initial state above
  // already accounts for it.
  useEffect(() => {
    if (window.hcaptcha) return;
    const existing = document.getElementById("hcaptcha-script");
    if (existing) {
      existing.addEventListener("load", () => setHcaptchaReady(true));
      existing.addEventListener("error", () => setHcaptchaLoadFailed(true));
      return;
    }
    const script = document.createElement("script");
    script.id = "hcaptcha-script";
    script.src = HCAPTCHA_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setHcaptchaReady(true);
    script.onerror = () => setHcaptchaLoadFailed(true);
    document.head.appendChild(script);
  }, []);

  // Render the widget once the script is ready and the container exists.
  useEffect(() => {
    if (!hcaptchaReady || !hcaptchaContainerRef.current) return;
    if (hcaptchaWidgetIdRef.current) return;

    hcaptchaWidgetIdRef.current = window.hcaptcha.render(
      hcaptchaContainerRef.current,
      {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      },
    );

    return () => {
      if (window.hcaptcha && hcaptchaWidgetIdRef.current) {
        window.hcaptcha.remove(hcaptchaWidgetIdRef.current);
        hcaptchaWidgetIdRef.current = null;
      }
    };
  }, [hcaptchaReady]);

  const resetCaptcha = () => {
    setCaptchaToken("");
    if (window.hcaptcha && hcaptchaWidgetIdRef.current) {
      window.hcaptcha.reset(hcaptchaWidgetIdRef.current);
    }
  };

  // Clear the OAuth-error nav state so it doesn't reappear on back/forward
  // navigation, while preserving the original "from" redirect target.
  useEffect(() => {
    if (location.state?.authError) {
      navigate(location.pathname, {
        replace: true,
        state: { from: location.state.from },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lockoutRemaining = Math.max(0, Math.ceil((lockoutUntil - now) / 1000));
  const resendRemaining = Math.max(
    0,
    Math.ceil((resendAvailableAt - now) / 1000),
  );

  const appUrl = (
    import.meta.env.VITE_APP_URL || window.location.origin
  ).replace(/\/$/, "");
  const redirectTo = location.state?.from || "/";

  const clear = () => {
    setError("");
    setSuccessMessage("");
  };
  const switchMode = (next) => {
    setMode(next);
    clear();
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setPhoneStep("request");
  };

  // ── OAuth (Google / Apple / Facebook) ──
  const handleOAuth = async (provider) => {
    clear();
    if (!captchaToken && !hcaptchaLoadFailed) {
      setError("Please complete the verification challenge.");
      return;
    }
    setOauthLoading(provider);
    const dest = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${appUrl}${dest}`, captchaToken },
    });
    setOauthLoading("");
    resetCaptcha();
    if (error) {
      setError(error.message);
      return;
    }
    if (data?.url) window.location.href = data.url;
  };

  // ── Email / password submit ──
  const handleSubmit = async () => {
    clear();

    // Set a new password (after following the email reset link)
    if (mode === "updatePassword") {
      if (!password) {
        setError("Please enter a new password.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        setError(
          "That password is too common and easy to guess. Please choose a stronger one.",
        );
        return;
      }
      if (getPasswordStrength(password).score < 3) {
        setError(
          "Please choose a stronger password — mix uppercase, lowercase, numbers and symbols.",
        );
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setLoading(true);
      const { error: e } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (e) {
        setError(e.message);
        return;
      }
      setSuccessMessage("Password updated! Redirecting…");
      setTimeout(() => {
        if (onRecoveryComplete) onRecoveryComplete();
        else navigate("/");
      }, 1200);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!captchaToken && !hcaptchaLoadFailed) {
      setError("Please complete the verification challenge.");
      return;
    }

    // Password reset
    if (mode === "reset") {
      setLoading(true);
      const { error: e } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: PASSWORD_RESET_REDIRECT, captchaToken },
      );
      setLoading(false);
      resetCaptcha();
      if (e) {
        setError(e.message);
        return;
      }
      setSuccessMessage(
        "If an account exists for that email, a reset link has been sent — check your inbox (and spam folder).",
      );
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "signUp") {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        setError(
          "That password is too common and easy to guess. Please choose a stronger one.",
        );
        return;
      }
      if (getPasswordStrength(password).score < 3) {
        setError(
          "Please choose a stronger password — mix uppercase, lowercase, numbers and symbols.",
        );
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    if (mode === "signIn") {
      const attempts = getAttemptState();
      if (attempts.lockedUntil > Date.now()) {
        setLockoutUntil(attempts.lockedUntil);
        setError(
          `Too many failed attempts. Try again in ${formatRemaining(attempts.lockedUntil)}.`,
        );
        return;
      }
    }

    setLoading(true);
    const result =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
            options: { captchaToken },
          })
        : await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: { data: { full_name: fullName.trim() }, captchaToken },
          });
    setLoading(false);
    resetCaptcha();

    if (result.error) {
      if (mode === "signIn") {
        const state = recordFailedAttempt();
        setLockoutUntil(state.lockedUntil);
        if (state.lockedUntil > Date.now()) {
          setError(
            `Too many failed attempts. Try again in ${formatRemaining(state.lockedUntil)}.`,
          );
          return;
        }
      }
      setError(result.error.message);
      return;
    }

    if (mode === "signIn") clearAttempts();

    if (mode === "signUp") {
      setSuccessMessage(
        "Account created! Check your email to confirm before signing in.",
      );
      sendWelcomeEmail({ email, name: fullName }).catch((error) => {
        console.error("Welcome email failed:", error);
      });
      return;
    }
    navigate("/");
  };

  // ── Phone / OTP ──
  const handlePhoneRequest = async () => {
    clear();
    const e164 = toE164Kenya(phone);
    if (!e164) {
      setError("Enter a valid Kenyan phone number, e.g. 0712345678.");
      return;
    }
    if (!captchaToken && !hcaptchaLoadFailed) {
      setError("Please complete the verification challenge.");
      return;
    }
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: { captchaToken },
    });
    setLoading(false);
    resetCaptcha();
    if (e) {
      setError(e.message);
      return;
    }
    setPhone(e164);
    setPhoneStep("verify");
    setResendAvailableAt(Date.now() + 60_000);
    setSuccessMessage(`Code sent to ${e164}.`);
  };

  const handlePhoneVerify = async () => {
    clear();
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit code sent to your phone.");
      return;
    }
    setLoading(true);
    const { error: e } = await supabase.auth.verifyOtp({
      phone,
      token: otp.trim(),
      type: "sms",
    });
    setLoading(false);
    if (e) {
      setError(e.message);
      return;
    }
    navigate("/");
  };

  const handlePhoneResend = async () => {
    if (resendRemaining > 0) return;
    clear();
    if (!captchaToken && !hcaptchaLoadFailed) {
      setError("Please complete the verification challenge.");
      return;
    }
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithOtp({
      phone,
      options: { captchaToken },
    });
    setLoading(false);
    resetCaptcha();
    if (e) {
      setError(e.message);
      return;
    }
    setResendAvailableAt(Date.now() + 60_000);
    setSuccessMessage("Code resent.");
  };

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
    updatePassword: {
      label: "Set new password",
      sub: "Choose a new password to finish resetting your account",
    },
    phone: {
      label: "Sign in with phone",
      sub: "Verify with a one-time SMS code",
    },
  };
  const { label, sub } = titles[mode];

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
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
                oauthLoading={oauthLoading}
                handleOAuth={handleOAuth}
                error={error}
                successMessage={successMessage}
                lockoutRemaining={lockoutRemaining}
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
                oauthLoading={oauthLoading}
                handleOAuth={handleOAuth}
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
            {mode === "phone" && (
              <PhoneView
                phone={phone}
                setPhone={setPhone}
                otp={otp}
                setOtp={setOtp}
                phoneStep={phoneStep}
                handlePhoneRequest={handlePhoneRequest}
                handlePhoneVerify={handlePhoneVerify}
                handlePhoneResend={handlePhoneResend}
                resendRemaining={resendRemaining}
                switchMode={switchMode}
                loading={loading}
                error={error}
                successMessage={successMessage}
              />
            )}
            {mode === "updatePassword" && (
              <UpdatePasswordView
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                showPassword={showPassword}
                toggleShowPassword={() => setShowPassword((v) => !v)}
                handleSubmit={handleSubmit}
                loading={loading}
                error={error}
                successMessage={successMessage}
              />
            )}

            {mode !== "updatePassword" && (
              <div className="mt-5">
                <HCaptchaWidget containerRef={hcaptchaContainerRef} />
              </div>
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
