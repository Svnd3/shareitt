import { Link, useLocation } from "react-router-dom";
import ShareItLogo from "../assets/shareitlogo.webp";

// Shared top nav for the pages that need it (Home, Host). Report/Join stay
// deliberately minimal (back-links only) rather than getting this bar too.
export default function Header({ session, authLoading, children }) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className="sticky top-0 z-30 mb-4 bg-[#F8F9FA]">
      <nav className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={ShareItLogo} alt="ShareIt" className="h-16 w-auto" />
          <div>
            <p className="text-sm font-semibold text-slate-950">ShareIt</p>
            <p className="text-xs text-slate-500">
              Kenya subscription sharing made simple
            </p>
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
          {children}
          <a
            href={isHome ? "#faq" : "/#faq"}
            className="hover:text-slate-900"
          >
            FAQ
          </a>
          <Link to="/host" className="hover:text-slate-900">
            Host
          </Link>
          <Link to="/report" className="hover:text-slate-900">
            Report
          </Link>
          {authLoading ? (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-500">
              Checking…
            </span>
          ) : session ? (
            <Link
              to="/account"
              aria-label="Your account"
              title="Your account"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
              </svg>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
