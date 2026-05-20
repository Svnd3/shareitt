import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { serviceEmojiMap } from "../data/defaultFamilies";

const getBrandLogo = (serviceName) => {
  const brandMap = {
    "Netflix Standard": "netflix.com",
    "Netflix Basic": "netflix.com",
    "Spotify Premium": "spotify.com",
    "ChatGPT Plus": "openai.com",
    "Claude Pro": "anthropic.com",
    "Canva Pro": "canva.com",
    "YouTube Premium": "youtube.com",
    "Prime Video": "amazon.com",
    "Disney+": "disneyplus.com",
    "Apple TV+": "apple.com",
    "Microsoft 365": "microsoft.com",
    "Google One": "google.com",
    Notion: "notion.so",
    Figma: "figma.com",
    Dropbox: "dropbox.com",
    Showmax: "showmax.com",
    Deezer: "deezer.com",
    "Xbox Game Pass": "xbox.com",
    "PlayStation Plus": "playstation.com",
    "LinkedIn Premium": "linkedin.com",
    "Duolingo Plus": "duolingo.com",
  };

  const lowerName = serviceName?.toLowerCase() ?? "";
  const key = Object.keys(brandMap).find(
    (k) =>
      lowerName.includes(k.toLowerCase()) ||
      k.toLowerCase().includes(lowerName),
  );

  if (key) {
    return `https://www.google.com/s2/favicons?domain=${brandMap[key]}&sz=128`;
  }

  return null;
};

export default function ServiceCard({ family }) {
  const [isHost, setIsHost] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const checkUser = async () => {
      try {
        if (!supabase.auth?.getSession) {
          setChecking(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        const userId = data?.session?.user?.id;
        if (!userId) {
          setChecking(false);
          return;
        }

        if (mounted) {
          setIsHost(userId === family.created_by);
        }

        const { data: memberData, error } = await supabase
          .from("members")
          .select("id")
          .eq("family_id", family.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (mounted) {
          setIsMember(Boolean(memberData && !error));
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setChecking(false);
      }
    };

    checkUser();
    return () => {
      mounted = false;
    };
  }, [family.id, family.created_by]);

  const slotsLeft = family.total_slots - family.filled_slots;
  const slotBadge =
    slotsLeft <= 1
      ? "bg-red-100 text-red-800"
      : "bg-emerald-100 text-emerald-900";
  const primaryLogo = getBrandLogo(family.service_name);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [family.service_name]);

  const shouldShowFallbackLogo = logoLoadFailed || !primaryLogo;
  const logoUrl = primaryLogo;
  const logoAlt = primaryLogo ? `${family.service_name} logo` : "ShareIt logo";
  const remainingFunding = slotsLeft * family.price_per_slot;
  const [uniqueName, setUniqueName] = useState(family.unique_name ?? "");
  const safeUniqueName = uniqueName ?? "";
  const familyUniqueName = family.unique_name ?? "";
  const [editingUnique, setEditingUnique] = useState(false);
  const [savingUnique, setSavingUnique] = useState(false);
  const reportMailto = `mailto:keninnofficial@gmail.com?subject=${encodeURIComponent(
    `Report issue for ${family.service_name}`,
  )}&body=${encodeURIComponent(
    `Hello ShareIt team,%0D%0A%0D%0AI would like to report an issue with the full group for ${family.service_name} hosted by ${family.host_name}.%0D%0A%0D%0AIssue:%0D%0A%0D%0ABest regards,%0D%0A`,
  )}`;
  const showReport = family.filled_slots >= family.total_slots;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100">
            {shouldShowFallbackLogo ? (
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl">
                {family.service_name?.[0]?.toUpperCase() || "S"}
              </div>
            ) : (
              <img
                src={logoUrl}
                alt={logoAlt}
                onError={() => setLogoLoadFailed(true)}
                className="h-full w-full rounded-full bg-white object-contain p-2"
              />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-right text-sm text-slate-500">
          <span className="font-semibold text-slate-900">
            KSh {family.price_per_slot}
          </span>
          <span>{family.total_slots} slots</span>
        </div>
      </div>

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
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
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
              <div>
                <button
                  onClick={() => setEditingUnique(true)}
                  className="text-sm text-slate-600 underline"
                >
                  {uniqueName ? "Edit family name" : "Set family name"}
                </button>
              </div>
            )}
          </div>
        )}
        <p className="text-sm text-slate-600">
          Hosted by{" "}
          <span className="font-medium text-slate-900">{family.host_name}</span>
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
            family.is_active_host
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {family.is_active_host ? "✓ Active Host" : "⚠ Unverified"}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${slotBadge}`}
        >
          {slotsLeft <= 0
            ? "Full"
            : `${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left`}
        </span>
      </div>
      {family.payment_due === true && (
        <p className="text-xs text-amber-600 mt-1">
          ⚠ Host payment due — listing may become inactive soon
        </p>
      )}

      <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
        {slotsLeft > 0 ? (
          <p>
            Remaining funding to fill the group:{" "}
            <strong>KSh {remainingFunding}</strong>
          </p>
        ) : (
          <p className="text-emerald-700 font-semibold">
            Fully funded. If you're in this group, report an issue by email.
          </p>
        )}
      </div>

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
        ) : !checking && isHost ? (
          <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
            You are the host
          </span>
        ) : !checking && isMember ? (
          <span className="inline-flex items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            Joined
          </span>
        ) : (
          <Link
            to={`/join/${family.id}`}
            className="inline-flex items-center justify-center rounded-full bg-[#1A7A3C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
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
    </article>
  );
}
