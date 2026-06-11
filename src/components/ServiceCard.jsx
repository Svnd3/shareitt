import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const BRAND_KEYWORDS = [
  ["spotify", "spotify.com"],
  ["netflix", "netflix.com"],
  ["youtube", "youtube.com"],
  ["prime video", "amazon.com"],
  ["amazon", "amazon.com"],
  ["disney", "disneyplus.com"],
  ["showmax", "showmax.com"],
  ["apple", "apple.com"],
  ["chatgpt", "openai.com"],
  ["openai", "openai.com"],
  ["claude", "claude.ai"],
  ["canva", "canva.com"],
  ["microsoft", "microsoft.com"],
  ["google", "google.com"],
  ["notion", "notion.so"],
  ["figma", "figma.com"],
  ["dropbox", "dropbox.com"],
  ["adobe", "adobe.com"],
  ["grammarly", "grammarly.com"],
  ["duolingo", "duolingo.com"],
  ["playstation", "playstation.com"],
  ["xbox", "xbox.com"],
  ["nordvpn", "nordvpn.com"],
  ["expressvpn", "expressvpn.com"],
  ["audible", "audible.com"],
  ["telegram", "telegram.org"],
  ["discord", "discord.com"],
  ["deezer", "deezer.com"],
  ["tidal", "tidal.com"],
  ["soundcloud", "soundcloud.com"],
  ["hulu", "hulu.com"],
  ["crunchyroll", "crunchyroll.com"],
  ["hbo", "max.com"],
  ["linkedin", "linkedin.com"],
];

const getBrandLogo = (serviceName) => {
  const lowerName = serviceName?.toLowerCase() ?? "";
  const match = BRAND_KEYWORDS.find(([keyword]) =>
    lowerName.includes(keyword),
  );

  if (match) {
    return `https://www.google.com/s2/favicons?domain=${match[1]}&sz=128`;
  }

  return null;
};

export default function ServiceCard({ family, userId, isMember = false }) {
  const isHost = Boolean(userId) && userId === family.created_by;
  const [flagOpen, setFlagOpen] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [uniqueName, setUniqueName] = useState(family.unique_name ?? "");
  const [editingUnique, setEditingUnique] = useState(false);
  const [savingUnique, setSavingUnique] = useState(false);

  const familyUniqueName = family.unique_name ?? "";
  const safeUniqueName = uniqueName ?? "";

  const flagOptions = [
    "Inactive or scam listing",
    "Wrong price or details",
    "Other issue",
  ];

  const handleFlag = (reason) => {
    const waMsg = `Hi ShareIt, I'd like to flag this listing:\n\nService: ${family.service_name}\nHost: ${family.host_name}\nReason: ${reason}`;
    window.open(
      `https://wa.me/254741401230?text=${encodeURIComponent(waMsg)}`,
      "_blank",
    );
    setFlagOpen(false);
  };

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [family.service_name]);

  const slotsLeft = family.total_slots - family.filled_slots;
  const slotBadge =
    slotsLeft <= 1
      ? "bg-red-100 text-red-800"
      : "bg-emerald-100 text-emerald-900";
  const primaryLogo = getBrandLogo(family.service_name);
  const shouldShowFallbackLogo = logoLoadFailed || !primaryLogo;
  const remainingFunding = slotsLeft * family.price_per_slot;

  const reportMailto = `mailto:keninnofficial@gmail.com?subject=${encodeURIComponent(
    `Report issue for ${family.service_name}`,
  )}&body=${encodeURIComponent(
    `Hello ShareIt team,%0D%0A%0D%0AI would like to report an issue with the full group for ${family.service_name} hosted by ${family.host_name}.%0D%0A%0D%0AIssue:%0D%0A%0D%0ABest regards,%0D%0A`,
  )}`;

  return (
    <article className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg flex flex-col">
      {/* Flag button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setFlagOpen((v) => !v)}
          title="Flag this listing"
          className="text-slate-300 hover:text-rose-400 transition text-base leading-none"
        >
          🚩
        </button>
        {flagOpen && (
          <div className="absolute right-0 top-7 w-52 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden z-20">
            {flagOptions.map((reason) => (
              <button
                key={reason}
                onClick={() => handleFlag(reason)}
                className="w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition"
              >
                {reason}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Logo + slots */}
      <div className="flex items-center justify-between gap-4 pr-6">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100">
          {shouldShowFallbackLogo ? (
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl">
              {family.service_name?.[0]?.toUpperCase() || "S"}
            </div>
          ) : (
            <img
              src={primaryLogo}
              alt={`${family.service_name} logo`}
              onError={() => setLogoLoadFailed(true)}
              className="h-full w-full rounded-full bg-white object-contain p-2"
            />
          )}
        </div>
        <div className="text-right text-sm text-slate-500">
          <span>{family.total_slots} slots</span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-5 space-y-2">
        <h3 className="text-xl font-semibold text-slate-950">
          {family.service_name}
        </h3>
        <div className="text-sm text-slate-600">
          {uniqueName ? (
            <span className="font-medium text-slate-800">{uniqueName}</span>
          ) : (
            <span className="text-slate-500">No family name set</span>
          )}
        </div>

        {isHost && (
          <div className="mt-2">
            {editingUnique ? (
              <div className="flex items-center gap-2">
                <input
                  value={uniqueName}
                  onChange={(e) => setUniqueName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setUniqueName(familyUniqueName);
                      setEditingUnique(false);
                    }
                  }}
                  onBlur={async () => {
                    setEditingUnique(false);
                    if (safeUniqueName.trim() === familyUniqueName.trim())
                      return;
                    setSavingUnique(true);
                    try {
                      const { error } = await supabase
                        .from("families")
                        .update({ unique_name: uniqueName.trim() || null })
                        .eq("id", family.id);
                      if (error) throw error;
                    } catch (err) {
                      console.error("Failed to save unique name", err);
                      setUniqueName(familyUniqueName);
                    } finally {
                      setSavingUnique(false);
                    }
                  }}
                  className="rounded-md border border-slate-200 px-3 py-1 text-sm"
                  placeholder="Enter unique family name (optional)"
                />
                <button
                  onClick={() => {
                    setUniqueName(familyUniqueName);
                    setEditingUnique(false);
                  }}
                  className="text-sm text-slate-500"
                >
                  Cancel
                </button>
                {savingUnique && (
                  <span className="text-sm text-slate-500">Saving…</span>
                )}
              </div>
            ) : (
              <button
                onClick={() => setEditingUnique(true)}
                className="text-sm text-slate-600 underline"
              >
                {uniqueName ? "Edit family name" : "Set family name"}
              </button>
            )}
          </div>
        )}

        <p className="text-sm text-slate-600">
          Hosted by{" "}
          <span className="font-medium text-slate-900">{family.host_name}</span>
        </p>
      </div>

      {/* Badges */}
      <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
            family.is_active_host
              ? "bg-sky-100 text-sky-800 border-sky-200"
              : "bg-slate-50 text-slate-600 border-slate-300"
          }`}
        >
          {family.is_active_host ? "✓ Verified" : "Pending Review"}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${slotBadge}`}
        >
          {slotsLeft <= 0
            ? "Full"
            : `${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left`}
        </span>
      </div>

      {/* Payment method */}
      <div className="mt-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
            family.hosting_method === "escrow"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-slate-50 text-slate-600 border-slate-300"
          }`}
        >
          {family.hosting_method === "escrow"
            ? "🔒 ShareIt Escrow"
            : "💬 WhatsApp group"}
        </span>
      </div>

      {family.payment_due === true && (
        <p className="text-xs text-amber-600 mt-1">
          ⚠ Host payment due — listing may become inactive soon
        </p>
      )}

      {/* Funding info */}
      <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
        {slotsLeft > 0 ? (
          <p>
            Remaining funding to fill the group:{" "}
            <strong>KSh {remainingFunding}</strong>
          </p>
        ) : (
          <p className="text-slate-600 font-medium">
            🔔 This family is full — join the waitlist and we'll notify you when
            a slot opens.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {slotsLeft <= 0 ? (
          <>
            <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
              Family full
            </span>
            <Link
              to="/host"
              className="inline-flex items-center justify-center rounded-full bg-[#1A7A3C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Host another
            </Link>
          </>
        ) : isHost ? (
          <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
            You are the host
          </span>
        ) : isMember ? (
          <span className="inline-flex items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            Joined
          </span>
        ) : (
          <Link
            to={`/join/${family.id}`}
            className="inline-flex items-center justify-center rounded-full bg-[#1A7A3C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Join Family
          </Link>
        )}
        {isMember && (
          <a
            href={reportMailto}
            className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            Report (members only)
          </a>
        )}
      </div>

      {/* Price — bottom right */}
      <div className="mt-4 flex justify-end">
        <span className="text-sm font-semibold text-slate-900">
          KSh {family.price_per_slot}
        </span>
      </div>
    </article>
  );
}
