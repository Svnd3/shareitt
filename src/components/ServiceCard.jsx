import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SummertidesLogo from "../assets/summertideslogo.webp";
import DstvLogo from "../assets/dstvlogo.svg";

const CUSTOM_LOGOS = [
  ["summertides", SummertidesLogo],
  ["dstv", DstvLogo],
];

const getCustomLogo = (serviceName) => {
  const lowerName = serviceName?.toLowerCase() ?? "";
  const match = CUSTOM_LOGOS.find(([keyword]) => lowerName.includes(keyword));
  return match ? match[1] : null;
};

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

const getBrandDomain = (serviceName) => {
  const lowerName = serviceName?.toLowerCase() ?? "";
  const match = BRAND_KEYWORDS.find(([keyword]) =>
    lowerName.includes(keyword),
  );

  return match ? match[1] : null;
};

const getLogoUrl = (domain, stage) =>
  stage === 0
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : `https://icons.duckduckgo.com/ip3/${domain}.ico`;

export default function ServiceCard({
  family,
  userId,
  isMember = false,
  onLeave,
}) {
  const isHost = Boolean(userId) && userId === family.created_by;
  const [expanded, setExpanded] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [logoStage, setLogoStage] = useState(0);
  const [logoServiceName, setLogoServiceName] = useState(
    family.service_name,
  );
  const [uniqueName, setUniqueName] = useState(family.unique_name ?? "");
  const [editingUnique, setEditingUnique] = useState(false);
  const [savingUnique, setSavingUnique] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleLeave = async () => {
    if (
      !window.confirm(
        `Leave the ${family.service_name} group? You can rejoin later if a slot opens up.`,
      )
    ) {
      return;
    }

    setLeaving(true);
    const { error } = await supabase.rpc("leave_family", {
      p_family_id: family.id,
    });
    setLeaving(false);

    if (error) {
      console.error("Leave family error:", error);
      window.alert("Unable to leave this group. Please try again.");
      return;
    }

    onLeave?.(family.id);
  };

  const familyUniqueName = family.unique_name ?? "";
  const safeUniqueName = uniqueName ?? "";

  const flagOptions = [
    "Inactive or scam listing",
    "Wrong price or details",
    "Other issue",
  ];

  const handleFlag = (reason) => {
    const subject = `Flagging listing: ${family.service_name}`;
    const body = `Service: ${family.service_name}\nHost: ${family.host_name}\nReason: ${reason}`;
    window.open(
      `mailto:keninnofficial@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank",
    );
    setFlagOpen(false);
  };

  if (logoServiceName !== family.service_name) {
    setLogoServiceName(family.service_name);
    setLogoStage(0);
  }

  const slotsLeft = family.total_slots - family.filled_slots;
  const slotBadge =
    slotsLeft <= 1
      ? "bg-red-100 text-red-800"
      : "bg-saddle-100 text-saddle-700";
  const customLogo = getCustomLogo(family.service_name);
  const brandDomain = getBrandDomain(family.service_name);
  const shouldShowFallbackLogo = !customLogo && (!brandDomain || logoStage >= 2);
  const remainingFunding = slotsLeft * family.price_per_slot;
  const hasOpenSlot = slotsLeft > 0;

  const reportMailto = `mailto:keninnofficial@gmail.com?subject=${encodeURIComponent(
    `Report issue for ${family.service_name}`,
  )}&body=${encodeURIComponent(
    `Hello ShareIt team,%0D%0A%0D%0AI would like to report an issue with the full group for ${family.service_name} hosted by ${family.host_name}.%0D%0A%0D%0AIssue:%0D%0A%0D%0ABest regards,%0D%0A`,
  )}`;

  const logo = customLogo ? (
    <img
      src={customLogo}
      alt={`${family.service_name} logo`}
      className="h-full w-full rounded-2xl bg-white object-contain p-2"
    />
  ) : shouldShowFallbackLogo ? (
    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-100 font-bold text-slate-600">
      {family.service_name?.[0]?.toUpperCase() || "S"}
    </div>
  ) : (
    <img
      src={getLogoUrl(brandDomain, logoStage)}
      alt={`${family.service_name} logo`}
      onError={() => setLogoStage((stage) => Math.min(stage + 1, 2))}
      className="h-full w-full rounded-2xl bg-white object-contain p-2"
    />
  );

  return (
    <>
      {/* Squircle */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`View ${family.service_name} group details`}
          className="group relative flex aspect-square w-full items-center justify-center rounded-3xl border border-slate-200 bg-white p-3 text-2xl shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-4"
        >
          {logo}
          {hasOpenSlot && (
            <span
              title="Slot available"
              className="absolute right-1.5 top-1.5 h-3.5 w-3.5 animate-pulse rounded-full bg-emerald-400 ring-2 ring-white shadow-[0_0_8px_2px_rgba(52,211,153,0.8)]"
            />
          )}
        </button>
        <p className="w-full truncate text-center text-xs font-medium text-slate-600">
          {family.service_name}
        </p>
        <p className="text-center text-xs font-bold text-saddle-600">
          KSh {family.price_per_slot}
        </p>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          style={{ touchAction: "pan-y" }}
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"
            style={{ touchAction: "pan-y" }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close details"
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            >
              ✕
            </button>

            {/* Flag button */}
            <div className="absolute left-4 top-4 z-10">
              <button
                onClick={() => setFlagOpen((v) => !v)}
                title="Flag this listing"
                className="text-slate-300 hover:text-rose-400 transition text-base leading-none"
              >
                🚩
              </button>
              {flagOpen && (
                <div className="absolute left-0 top-7 w-52 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden z-20">
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
            <div className="mt-8 flex items-center justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                {logo}
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
                  <span className="font-medium text-slate-800">
                    {uniqueName}
                  </span>
                ) : (
                  <span className="text-slate-500">No group name set</span>
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
                          if (
                            safeUniqueName.trim() === familyUniqueName.trim()
                          )
                            return;
                          setSavingUnique(true);
                          try {
                            const { error } = await supabase
                              .from("families")
                              .update({
                                unique_name: uniqueName.trim() || null,
                              })
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
                        placeholder="Enter unique group name (optional)"
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
                        <span className="text-sm text-slate-500">
                          Saving…
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingUnique(true)}
                      className="text-sm text-slate-600 underline"
                    >
                      {uniqueName ? "Edit group name" : "Set group name"}
                    </button>
                  )}
                </div>
              )}

              <p className="text-sm text-slate-600">
                Hosted by{" "}
                <span className="font-medium text-slate-900">
                  {family.host_name}
                </span>
              </p>
            </div>

            {/* Badges */}
            <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex flex-col gap-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
                    family.is_verified
                      ? "bg-sky-100 text-sky-800 border-sky-200"
                      : "bg-slate-50 text-slate-600 border-slate-300"
                  }`}
                >
                  {family.is_verified ? "✓ Verified" : "Pending Review"}
                </span>
                {!family.is_verified && (
                  <span className="text-xs text-slate-500">
                    Usually takes 2-15 minutes
                  </span>
                )}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${slotBadge}`}
              >
                {slotsLeft <= 0
                  ? "Full"
                  : `${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left`}
              </span>
            </div>

            {/* Funding info */}
            <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
              {slotsLeft > 0 ? (
                <p>
                  Remaining funding to fill the group:{" "}
                  <strong>KSh {remainingFunding}</strong>
                </p>
              ) : (
                <p className="text-slate-600 font-medium">
                  🔔 This group is full — join the waitlist and we'll notify
                  you when a slot opens.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              {slotsLeft <= 0 ? (
                <>
                  <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
                    Group full
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
                <>
                  <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                    Joined
                  </span>
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={leaving}
                    className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    {leaving ? "Leaving…" : "Leave group"}
                  </button>
                </>
              ) : (
                <Link
                  to={`/join/${family.id}`}
                  className="inline-flex items-center justify-center rounded-full bg-[#1A7A3C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Join Group
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
          </div>
        </div>
      )}
    </>
  );
}
