import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase, hasSupabaseConfig } from "../lib/supabaseClient";
import { useToast } from "../components/ToastProvider";
import ServiceCard from "../components/ServiceCard";
import FAQ from "../components/FAQ";
import QuickPairing from "../components/QuickPairing";
import LoadingSpinner from "../components/LoadingSpinner";
import ShareItLogo from "../assets/shareitlogo.png";
import SpotifyImg from "../assets/spotify.jpg";
import NetflixImg from "../assets/netflix.jpg";
import ChatGPTImg from "../assets/chatgpt.jpg";
import PrimeImg from "../assets/prime.jpg";
import { SkeletonGrid } from "../components/SkeletonCard";

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

const serviceSuggestions = filters.filter((item) => item !== "All");

const slides = [
  { title: "Spotify Premium" },
  { title: "Netflix Standard" },
  { title: "ChatGPT Plus" },
  { title: "Prime Video" },
];

export default function Home({ session, authLoading }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const initialService = (() => {
    const params = new URLSearchParams(location.search);
    const serviceParam = params.get("service");
    if (!serviceParam) return "All";
    const normalizedRequest = serviceParam.toLowerCase().replace(/\s+/g, "");
    const matched = filters.find(
      (item) =>
        item !== "All" &&
        item.toLowerCase().replace(/\s+/g, "").includes(normalizedRequest),
    );
    return matched || "All";
  })();

  const [families, setFamilies] = useState([]);
  const [activeService, setActiveService] = useState(initialService);
  const [priceFilter, setPriceFilter] = useState("All");
  const [slotFilter, setSlotFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [familyView, setFamilyView] = useState("available");
  const searchContainerRef = useRef(null);

  const activeFilterCount = [
    activeService !== "All",
    priceFilter !== "All",
    slotFilter !== "All",
  ].filter(Boolean).length;

  const notice = location.state?.notice;

  const handleSearch = (term = searchTerm.trim()) => {
    const query = term.trim();
    setSearchQuery(query);
    setSuggestionsVisible(false);
  };

  const filteredSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return serviceSuggestions.filter((service) =>
      service.toLowerCase().includes(query),
    );
  }, [searchTerm]);

  const handleShareApp = async () => {
    const serviceSlug =
      activeService !== "All"
        ? activeService.toLowerCase().replace(/\s+/g, "")
        : "";
    const shareUrl = `${window.location.origin}${
      serviceSlug ? `/?service=${encodeURIComponent(serviceSlug)}` : ""
    }`;
    const shareText =
      "Save on subscriptions with ShareIt Kenya. Browse live family listings, pay a KSh 90 reliability fee, and join WhatsApp groups to share services together. ";
    const sharePayload = {
      title: "ShareIt — Kenya subscription families",
      text: `${shareText}${shareUrl}`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        toast.showToast("Share dialog opened successfully.", "success");
      } else {
        await navigator.clipboard.writeText(`${shareText}${shareUrl}`);
        toast.showToast("Share message copied to clipboard.", "success");
      }
    } catch (error) {
      console.error("Share failed:", error);
      toast.showToast(
        "Unable to share automatically. Copy this website link manually.",
        "error",
      );
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((current) => (current + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setSuggestionsVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchFamilies = async () => {
      try {
        const { data, error } = await supabase
          .from("families")
          .select(
            "id,service_name,host_name,host_phone,price_per_slot,total_slots,filled_slots,is_verified,is_live,whatsapp_group_link,created_by,created_at",
          )
          .eq("is_live", true)
          .order("created_at", { ascending: false })
          .abortSignal(AbortSignal.timeout(15000));

        if (cancelled) return;

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
        if (cancelled) return;
        console.error("Home fetch families exception:", error);
        setFetchError(
          error?.name === "AbortError" || error?.name === "TimeoutError"
            ? "Loading families timed out. The database may be waking up — please refresh."
            : error?.message ||
                "Unable to load families from Supabase. Please check your environment and RLS policies.",
        );
        setFamilies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFamilies();
    return () => {
      cancelled = true;
    };
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
    const filteredByService =
      activeService === "All"
        ? families
        : families.filter((family) =>
            family.service_name
              .toLowerCase()
              .includes(activeService.toLowerCase()),
          );

    const filteredByPrice = filteredByService.filter((family) => {
      const price = Number(family.price_per_slot || 0);
      switch (priceFilter) {
        case "Under KSh 200":
          return price < 200;
        case "KSh 200–400":
          return price >= 200 && price <= 400;
        case "Above KSh 400":
          return price > 400;
        default:
          return true;
      }
    });

    const filteredBySlots = filteredByPrice.filter((family) => {
      const slotsLeft = family.total_slots - family.filled_slots;
      switch (slotFilter) {
        case "1 slot":
          return slotsLeft === 1;
        case "2-3 slots":
          return slotsLeft >= 2 && slotsLeft <= 3;
        case "4+ slots":
          return slotsLeft >= 4;
        default:
          return true;
      }
    });

    const filteredByView = filteredBySlots.filter((family) =>
      familyView === "full"
        ? family.filled_slots >= family.total_slots
        : family.filled_slots < family.total_slots,
    );

    if (!searchQuery) return filteredByView;

    const query = searchQuery.toLowerCase();
    return filteredByView.filter(
      (family) =>
        family.service_name.toLowerCase().includes(query) ||
        family.host_name.toLowerCase().includes(query),
    );
  }, [
    activeService,
    families,
    familyView,
    priceFilter,
    searchQuery,
    slotFilter,
  ]);

  const activeFamilies = families.length;
  const membersSaved = families.reduce(
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
    families.map((family) => family.service_name.split(" ")[0]),
  ).size;

  return (
    <main className="min-h-screen bg-[#F8F9FA]" style={{ touchAction: 'pan-y' }}>
      <div className="mx-auto max-w-screen-xl px-4 pb-32 pt-4 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
        <header className="sticky top-0 z-30 mb-4 bg-[#F8F9FA]">
          <nav className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={ShareItLogo} alt="ShareIt" className="h-16 w-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-950">ShareIt</p>
                <p className="text-xs text-slate-500">
                  Kenya subscription sharing made simple
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={handleShareApp}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
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
                  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                  <path d="M16 6l4 4-4 4" />
                  <path d="M20 10H8a4 4 0 0 0-4 4v2" />
                </svg>
                Share
              </button>
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
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-md">
            <div className="relative h-48 w-full overflow-hidden bg-slate-300">
              {[SpotifyImg, NetflixImg, ChatGPTImg, PrimeImg].map(
                (image, idx) => (
                  <div
                    key={idx}
                    className={`absolute inset-0 transition-all duration-500 ease-out transform-gpu ${
                      idx === currentSlide
                        ? "opacity-100 translate-y-0 scale-100"
                        : "opacity-0 translate-y-4 scale-105"
                    }`}
                    style={{ willChange: "opacity, transform" }}
                  >
                    <img
                      src={image}
                      alt={slides[idx].title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <p className="text-sm font-bold">{slides[idx].title}</p>
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentSlide === idx
                        ? "w-8 bg-emerald-600"
                        : "w-2 bg-slate-300 hover:w-4 hover:bg-slate-400"
                    }`}
                    aria-label={`Show slide ${idx + 1}`}
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

        <section className="space-y-4 mb-4">
          <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm">
            <span className="mr-2">🛡️</span>
            Your safety matters — pay a one-time KSh 90 reliability fee via
            M-Pesa to 0741401230 before joining. This protects hosts and keeps
            our community trusted.
          </div>
          <h1 className="text-2xl font-bold text-slate-950">
            Stop overpaying for subscriptions.
          </h1>
        </section>

        <QuickPairing />
        <section className="space-y-4 py-4">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div ref={searchContainerRef} className="relative w-full">
                <label className="block w-full">
                  <span className="sr-only">Search families</span>
                  <input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setSuggestionsVisible(true);
                    }}
                    onFocus={() => setSuggestionsVisible(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="Search families, services, or hosts"
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                {suggestionsVisible && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
                    <div className="divide-y divide-slate-200">
                      {filteredSuggestions.map((service) => (
                        <button
                          key={service}
                          type="button"
                          onClick={() => {
                            setSearchTerm(service);
                            setActiveService(service);
                            handleSearch(service);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          {service}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="rounded-3xl bg-[#1A7A3C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSearchQuery("");
                  setActiveService("All");
                  setPriceFilter("All");
                  setSlotFilter("All");
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

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFamilyView("available")}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                familyView === "available"
                  ? "bg-[#1A7A3C] text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Available Families
            </button>
            <button
              type="button"
              onClick={() => setFamilyView("full")}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                familyView === "full"
                  ? "bg-[#1A7A3C] text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Existing Families
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 md:hidden w-full"
          >
            <span className="inline-flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M4 4h16M7 12h10M10 20h4" />
              </svg>
              Filter
            </span>
            <span className="rounded-full bg-[#1A7A3C] px-2.5 py-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          </button>

          <div className="hidden gap-3 md:grid md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Filter by service
              </p>
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {filters.map((item) => (
                    <button
                      key={item}
                      onClick={() => setActiveService(item)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        activeService === item
                          ? "bg-[#1A7A3C] text-white"
                          : "border border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Filter by price
              </p>
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {["All", "Under KSh 200", "KSh 200–400", "Above KSh 400"].map(
                    (option) => (
                      <button
                        key={option}
                        onClick={() => setPriceFilter(option)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          priceFilter === option
                            ? "bg-[#1A7A3C] text-white"
                            : "border border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {option}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Filter by slots left
              </p>
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {["All", "1 slot", "2-3 slots", "4+ slots"].map((option) => (
                    <button
                      key={option}
                      onClick={() => setSlotFilter(option)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        slotFilter === option
                          ? "bg-[#1A7A3C] text-white"
                          : "border border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isFilterSheetOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end bg-slate-950/40 px-4 py-4 md:hidden"
              onClick={() => setIsFilterSheetOpen(false)}
            >
              <div
                className="w-full max-w-xl overflow-hidden rounded-t-3xl bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Filters
                    </p>
                    <p className="text-xs text-slate-500">
                      Select service, price, and slots.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFilterSheetOpen(false)}
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-4 px-4 py-4 overflow-y-auto" style={{ touchAction: 'pan-y', maxHeight: '70vh' }}>
                  <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Filter by service
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {filters.map((item) => (
                        <button
                          key={item}
                          onClick={() => setActiveService(item)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            activeService === item
                              ? "bg-[#1A7A3C] text-white"
                              : "border border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Filter by price
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "All",
                        "Under KSh 200",
                        "KSh 200–400",
                        "Above KSh 400",
                      ].map((option) => (
                        <button
                          key={option}
                          onClick={() => setPriceFilter(option)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            priceFilter === option
                              ? "bg-[#1A7A3C] text-white"
                              : "border border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Filter by slots left
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["All", "1 slot", "2-3 slots", "4+ slots"].map(
                        (option) => (
                          <button
                            key={option}
                            onClick={() => setSlotFilter(option)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              slotFilter === option
                                ? "bg-[#1A7A3C] text-white"
                                : "border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {option}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <div id="listings" className="w-full max-w-[92%] grid gap-3 md:grid-cols-2 md:max-w-full xl:grid-cols-3" style={{ touchAction: 'pan-y' }}>
              {loading ? (
                <SkeletonGrid count={6} />
              ) : collection.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  {familyView === "available" ? (
                    <>
                      No new families found. Click{" "}
                      <Link to="/host" className="font-semibold text-emerald-700 hover:underline">
                        Host
                      </Link>{" "}
                      to create your own.
                    </>
                  ) : (
                    "No families found."
                  )}
                </div>
              ) : (
                collection.map((family) => (
                  <ServiceCard key={family.id} family={family} />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 py-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  How it works
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Learn how ShareIt helps you save with trusted groups and what
                  you need to do before joining.
                </p>
              </div>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center rounded-full bg-[#1A7A3C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                View the process →
              </Link>
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
        <FAQ />
        <div className="h-8" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-slate-900">Ready to save?</p>
          <div className="flex gap-2">
            <Link
              to="/host"
              className="flex-1 min-w-0 rounded-full bg-[#1A7A3C] px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-emerald-600"
            >
              Host
            </Link>
            <a
              href="#listings"
              className="flex-1 min-w-0 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-xs font-bold text-slate-900 transition hover:bg-slate-50"
            >
              Join
            </a>
            <Link
              to="/report"
              className="flex-1 min-w-0 rounded-full border border-slate-300 bg-slate-100 px-4 py-2.5 text-center text-xs font-bold text-slate-900 transition hover:bg-slate-50"
            >
              Report
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
