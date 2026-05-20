import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase, hasSupabaseConfig } from "../lib/supabaseClient";
import ServiceCard from "../components/ServiceCard";
import FAQ from "../components/FAQ";
import QuickPairing from "../components/QuickPairing";
import TrustBanner from "../components/TrustBanner";
import LoadingSpinner from "../components/LoadingSpinner";
import SpotifyImg from "../assets/spotify.jpg";
import NetflixImg from "../assets/netflix.jpg";
import ChatGPTImg from "../assets/chatgpt.jpg";
import PrimeImg from "../assets/prime.jpg";
import SkeletonCard, { SkeletonGrid } from "../components/SkeletonCard";

const filters = [
  "All",
  "Spotify",
  "Netflix",
  "ChatGPT",
  "Claude",
  "Canva",
  "YouTube",
  "Prime",
];

const slides = [
  { title: "Spotify Premium" },
  { title: "Netflix Standard" },
  { title: "ChatGPT Plus" },
  { title: "Prime Video" },
];

export default function Home({ session, authLoading }) {
  const [families, setFamilies] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const notice = location.state?.notice;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((current) => (current + 1) % slides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        const { data, error } = await supabase
          .from("families")
          .select(
            "id,service_name,host_name,host_phone,price_per_slot,total_slots,filled_slots,is_verified,is_live,whatsapp_group_link,created_by,created_at",
          )
          .eq("is_live", true)
          .order("created_at", { ascending: false });

        if (error || !data) {
          console.error("Home fetch families error:", error);
          setFetchError(
            error?.message ||
              "Unable to load families from Supabase. Please check your environment and RLS policies.",
          );
          setFamilies([]);
          setLoading(false);
          return;
        }

        setFamilies(data);
        setFetchError("");
      } catch (error) {
        console.error("Home fetch families exception:", error);
        setFetchError(
          error?.message ||
            "Unable to load families from Supabase. Please check your environment and RLS policies.",
        );
        setFamilies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFamilies();
  }, []);

  useEffect(() => {
    if (notice) {
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [notice, location.pathname]);

  const handleSignOut = async () => {
    if (!supabase.auth?.signOut) return;
    await supabase.auth.signOut();
    navigate("/");
  };

  const collection = useMemo(() => {
    const filtered =
      activeFilter === "All"
        ? families
        : families.filter((family) =>
            family.service_name
              .toLowerCase()
              .includes(activeFilter.toLowerCase()),
          );

    if (!searchQuery) return filtered;

    const query = searchQuery.toLowerCase();
    return filtered.filter(
      (family) =>
        family.service_name.toLowerCase().includes(query) ||
        family.host_name.toLowerCase().includes(query),
    );
  }, [activeFilter, families, searchQuery]);

  const activeFamilies = collection.length;
  const membersSaved = collection.reduce(
    (sum, family) => sum + family.filled_slots,
    0,
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F9FA]">
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <LoadingSpinner message="Loading families…" />
        </div>
      </main>
    );
  }
  const servicesAvailable = new Set(
    collection.map((family) => family.service_name.split(" ")[0]),
  ).size;

  return (
    <main className="min-h-screen bg-[#F8F9FA]">
      <div className="mx-auto max-w-screen-xl px-4 pb-32 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-30 mb-4 bg-[#F8F9FA]">
          <nav className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ShareIt" className="h-12 w-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-950">ShareIt</p>
                <p className="text-xs text-slate-500">
                  Kenya subscription sharing made simple
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
              <a href="#faq" className="hover:text-emerald-600">
                FAQ
              </a>
              <Link to="/host" className="hover:text-emerald-600">
                Host
              </Link>
              <Link to="/report" className="hover:text-emerald-600">
                Report
              </Link>
              {authLoading ? (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-500">
                  Checking…
                </span>
              ) : session ? (
                <button
                  onClick={handleSignOut}
                  className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  Sign out
                </button>
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

        {!hasSupabaseConfig && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm">
            Supabase environment variables are not configured. Please set
            VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local .env or
            Vercel environment settings.
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            {notice}
          </div>
        )}
        {fetchError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm">
            {fetchError}
          </div>
        )}

        <section className="space-y-4 mb-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            Pay a one-time KSh 90 reliability fee via WhatsApp to 0741401230
            before joining a family. This keeps hosts protected and listings
            trusted.
          </div>
          <h1 className="text-2xl font-bold text-slate-950">
            Stop overpaying for subscriptions.
          </h1>
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-md">
            <div className="relative h-48 w-full overflow-hidden bg-slate-300">
              <img
                src={
                  [SpotifyImg, NetflixImg, ChatGPTImg, PrimeImg][currentSlide]
                }
                alt="Service"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-sm font-bold">
                  {slides[currentSlide].title}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition ${
                      currentSlide === idx
                        ? "w-6 bg-emerald-600"
                        : "w-2 bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3 py-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-bold text-slate-600 uppercase">
              Families
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {activeFamilies}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-bold text-slate-600 uppercase">
              Members
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {membersSaved}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-bold text-slate-600 uppercase">
              Services
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {servicesAvailable}
            </p>
          </div>
        </section>

        <section className="space-y-4 py-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:items-center sm:justify-between sm:flex-row">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Recents
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Recent active groups
                </h2>
              </div>
              <Link
                to="/report"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Report an issue
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {collection.length > 0 ? (
                collection
                  .slice(0, 3)
                  .map((family) => (
                    <ServiceCard key={family.id} family={family} />
                  ))
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No active families found yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <QuickPairing />
        <section className="space-y-4 py-4">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <label className="relative block w-full">
                <span className="sr-only">Search families</span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search families, services, or hosts"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <button
                type="button"
                onClick={() => setSearchQuery(searchTerm.trim())}
                className="rounded-3xl bg-[#1A7A3C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSearchQuery("");
                  setActiveFilter("All");
                }}
                className="rounded-3xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Clear
              </button>
            </div>
            {searchQuery && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Showing results for <strong>{searchQuery}</strong>.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => setActiveFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeFilter === item
                    ? "bg-[#1A7A3C] text-white"
                    : "border border-slate-200 bg-slate-100 text-slate-700"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div
            id="listings"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {loading ? (
              <SkeletonGrid count={6} />
            ) : collection.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                No families found.
              </div>
            ) : (
              collection.map((family) => (
                <ServiceCard key={family.id} family={family} />
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 py-8">
          <h2 className="text-xl font-bold text-slate-950">How it works</h2>
          <div className="space-y-3">
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Browse families
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Find services, prices, and availability near you.
                </p>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Reliability fee — KSh 90
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Pay once after signing in on the payment page.
                </p>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Join the group
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Get added to WhatsApp and start saving.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 py-8">
          <h2 className="text-xl font-bold text-slate-950">
            Rules, risk, and protection
          </h2>
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">What ShareIt does</p>
              <p>
                ShareIt only connects hosts and members for shared
                subscriptions. We do not process payments, manage service
                accounts, or guarantee third-party services.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">
                What you should know
              </p>
              <ul className="list-disc space-y-2 pl-5 text-slate-600">
                <li>
                  You are responsible for confirming the host and verifying
                  payment details.
                </li>
                <li>
                  Reliability fees are paid by M-Pesa directly to the host.
                </li>
                <li>
                  ShareIt does not manage refunds, account bans, or disputes
                  between members and hosts. Please keep records of your
                  payments and agreements.
                </li>
                <li>
                  If something goes wrong, report it by email and keep your
                  payment proof.
                </li>
              </ul>
            </div>
            <div className="space-y-2 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <p className="font-semibold">Important</p>
              <p>
                ShareIt is a matching platform, not a payment processor. While
                we work to keep the community safe, we do not manage refunds,
                account suspensions, or disputes between members and hosts. We
                recommend keeping records of all agreements and payments.
              </p>
            </div>
          </div>
        </section>
        <TrustBanner />
        <FAQ />
        <div className="h-8" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-slate-900">Ready to save?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              to="/host"
              className="rounded-full bg-[#1A7A3C] px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-emerald-600"
            >
              Host
            </Link>
            <a
              href="#listings"
              className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-xs font-bold text-slate-900 transition hover:bg-slate-50"
            >
              Join
            </a>
            <Link
              to="/report"
              className="rounded-full border border-slate-300 bg-slate-100 px-4 py-2.5 text-center text-xs font-bold text-slate-900 transition hover:bg-slate-50"
            >
              Report
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
