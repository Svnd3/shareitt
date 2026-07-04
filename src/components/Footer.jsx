import { Link } from "react-router-dom";
import ShareItLogo from "../assets/shareitlogo.webp";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto max-w-screen-xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={ShareItLogo} alt="ShareIt" className="h-10 w-auto" />
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-200">
                ShareIt
              </p>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-300">
              ShareIt helps Kenyans lower subscription costs by connecting hosts
              and members for group service sharing.
            </p>
            <div className="space-y-2 text-sm text-slate-400">
              <p>Contact</p>
              <p>
                <a
                  href="mailto:keninnofficial@gmail.com"
                  className="transition hover:text-white"
                >
                  keninnofficial@gmail.com
                </a>
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Product
            </h3>
            <ul className="mt-6 space-y-3 text-sm">
              <li>
                <Link
                  to="/"
                  className="text-slate-300 transition hover:text-white"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/how-it-works"
                  className="text-slate-300 transition hover:text-white"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  to="/host"
                  className="text-slate-300 transition hover:text-white"
                >
                  Host
                </Link>
              </li>
              <li>
                <Link
                  to="/report"
                  className="text-slate-300 transition hover:text-white"
                >
                  Report
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Stay connected
            </h3>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li>Built for trusted group sharing</li>
              <li>Customer support available daily</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-6 text-sm text-slate-500">
          © {new Date().getFullYear()} ShareIt Kenya. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
