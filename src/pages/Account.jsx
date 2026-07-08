import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { isAdminEmail } from "../lib/adminAccess";
import { getUserCapacity } from "../lib/payments";
import {
  fetchHostedFamilies,
  fetchJoinedFamilies,
  fetchAllFamilies,
  fetchMembersByFamilyIds,
} from "../lib/familyData";
import {
  sendHostNewMemberEmail,
  sendAdminNewMemberEmail,
  sendAdminAddedMemberEmail,
} from "../lib/sendEmail";
import { useToast } from "../components/ToastProvider";
import Header from "../components/Header";
import SeoHead from "../components/SeoHead";
import LoadingSpinner from "../components/LoadingSpinner";

function PlanRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function GroupRow({ family, action }) {
  const slotsLeft = family.total_slots - family.filled_slots;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-slate-950">{family.service_name}</p>
        <p className="text-sm text-slate-600">
          {family.filled_slots}/{family.total_slots} slots filled
          {slotsLeft > 0 ? ` — ${slotsLeft} left` : " — full"}
          {!family.is_verified && " — Pending review"}
        </p>
      </div>
      {action}
    </div>
  );
}

function FilterChips({ label, options, value, onChange }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              value === option
                ? "bg-[#1A7A3C] text-white"
                : "border border-slate-200 bg-slate-100 text-slate-700"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddMemberForm({ family, onAdd }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [social1, setSocial1] = useState("");
  const [social2, setSocial2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slotsLeft = family.total_slots - family.filled_slots;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    if (slotsLeft <= 0) {
      setError("This group is already full.");
      return;
    }

    setSubmitting(true);
    const result = await onAdd({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      social1: social1.trim(),
      social2: social2.trim(),
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || "Unable to add this member. Please try again.");
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setSocial1("");
    setSocial2("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Add a member directly
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Full name"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone number"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email (optional)"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <input
          value={social1}
          onChange={(event) => setSocial1(event.target.value)}
          placeholder="Social media 1 (optional)"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <input
          value={social2}
          onChange={(event) => setSocial2(event.target.value)}
          placeholder="Social media 2 (optional)"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting || slotsLeft <= 0}
        className="rounded-full bg-[#1A7A3C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting
          ? "Adding…"
          : slotsLeft <= 0
            ? "Group is full"
            : "Add member"}
      </button>
    </form>
  );
}

function AdminGroupRow({ family, members, expanded, onToggle, onAddMember }) {
  const slotsLeft = family.total_slots - family.filled_slots;
  const isSeed = !family.created_by;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">
            {family.service_name}
            {isSeed && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Seed listing
              </span>
            )}
          </p>
          <p className="text-sm text-slate-600">
            Hosted by {family.host_name || "Unknown"} · {family.host_phone || "no phone on file"}
          </p>
          <p className="text-sm text-slate-600">
            {family.filled_slots}/{family.total_slots} slots filled
            {slotsLeft > 0 ? ` — ${slotsLeft} left` : " — full"}
            {!family.is_live && " — Offline"}
            {!family.is_verified && " — Pending review"}
          </p>
          <p className="text-sm text-slate-600">
            WhatsApp group:{" "}
            {family.whatsapp_group_link ? (
              <a
                href={family.whatsapp_group_link}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-saddle-600 underline"
              >
                {family.whatsapp_group_link}
              </a>
            ) : (
              <span className="font-semibold text-rose-600">Not made yet</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-100"
        >
          {expanded ? "Hide members" : `View members (${members.length})`}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          {members.length === 0 ? (
            <p className="text-sm text-slate-500">No members have joined yet.</p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <p className="font-semibold text-slate-950">{member.name}</p>
                <p>{member.phone}{member.email ? ` · ${member.email}` : ""}</p>
                {(member.social_media_1 || member.social_media_2) && (
                  <p className="text-slate-500">
                    {[member.social_media_1, member.social_media_2]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))
          )}
          <AddMemberForm
            family={family}
            onAdd={(details) => onAddMember(family, details)}
          />
        </div>
      )}
    </div>
  );
}

export default function Account({ session, authLoading }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [hostedFamilies, setHostedFamilies] = useState([]);
  const [joinedFamilies, setJoinedFamilies] = useState([]);
  const [capacity, setCapacity] = useState({
    hostRemaining: 0,
    joinRemaining: 0,
    unlimitedActive: false,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [leavingId, setLeavingId] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [allGroupsMembers, setAllGroupsMembers] = useState({});
  const [allGroupsLoading, setAllGroupsLoading] = useState(true);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [liveFilter, setLiveFilter] = useState("All");
  const [verifiedFilter, setVerifiedFilter] = useState("All");
  const [linkFilter, setLinkFilter] = useState("All");
  const [slotsFilter, setSlotsFilter] = useState("All");
  // Defaults to "Real" — the launch-time seed listings (no created_by) are
  // noise for day-to-day admin work; "All"/"Seed" stay one click away.
  const [originFilter, setOriginFilter] = useState("Real");
  const [groupSort, setGroupSort] = useState("Newest");

  const userId = session?.user?.id;
  const email = session?.user?.email;
  const admin = isAdminEmail(email);

  useEffect(() => {
    if (!userId) {
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setDataLoading(true);
      const [hosted, joined, cap] = await Promise.all([
        fetchHostedFamilies(userId),
        fetchJoinedFamilies(userId),
        getUserCapacity(userId, email),
      ]);
      if (cancelled) return;
      setHostedFamilies(hosted);
      setJoinedFamilies(joined);
      setCapacity(cap);
      setDataLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, email]);

  // Every group ever formed on ShareIt — admin-only, relies on the RLS
  // carve-out in supabase_rls_policies.sql (families_update_own /
  // members_select_own_or_host), not just a client-side check.
  useEffect(() => {
    if (!admin) {
      setAllGroupsLoading(false);
      return;
    }

    let cancelled = false;
    const loadAll = async () => {
      setAllGroupsLoading(true);
      const families = await fetchAllFamilies();
      if (cancelled) return;
      setAllGroups(families);
      const membersMap = await fetchMembersByFamilyIds(
        families.map((family) => family.id),
      );
      if (cancelled) return;
      setAllGroupsMembers(membersMap);
      setAllGroupsLoading(false);
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [admin]);

  // Keeps every group/member list on this page live — a new listing, a
  // slot filling up, or someone joining/leaving shows up immediately
  // without a refresh, same as the live slot-count subscription on
  // Join.jsx. Realtime only ever delivers rows the session's own RLS
  // policies allow it to see, so non-admins naturally only get updates
  // for their own hosted/joined groups, not the whole marketplace.
  useEffect(() => {
    if (!supabase.channel) return;

    const patchFamily = (list, family) =>
      list.map((f) => (f.id === family.id ? { ...f, ...family } : f));
    const removeFamily = (list, id) => list.filter((f) => f.id !== id);

    const familiesChannel = supabase
      .channel("account-families-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "families" },
        (payload) => {
          const family = payload.new;
          if (admin) setAllGroups((current) => [family, ...current]);
          if (family.created_by === userId) {
            setHostedFamilies((current) => [family, ...current]);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "families" },
        (payload) => {
          const family = payload.new;
          setAllGroups((current) =>
            admin ? patchFamily(current, family) : current,
          );
          setHostedFamilies((current) => patchFamily(current, family));
          setJoinedFamilies((current) => patchFamily(current, family));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "families" },
        (payload) => {
          const id = payload.old.id;
          setAllGroups((current) => removeFamily(current, id));
          setHostedFamilies((current) => removeFamily(current, id));
          setJoinedFamilies((current) => removeFamily(current, id));
        },
      )
      .subscribe();

    const membersChannel = supabase
      .channel("account-members-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "members" },
        (payload) => {
          const member = payload.new;
          if (admin) {
            setAllGroupsMembers((current) => ({
              ...current,
              [member.family_id]: [
                ...(current[member.family_id] || []),
                member,
              ],
            }));
          }
          if (member.user_id && member.user_id === userId) {
            fetchJoinedFamilies(userId).then(setJoinedFamilies);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "members" },
        (payload) => {
          const member = payload.old;
          if (admin) {
            setAllGroupsMembers((current) => ({
              ...current,
              [member.family_id]: (current[member.family_id] || []).filter(
                (m) => m.id !== member.id,
              ),
            }));
          }
          if (member.user_id && member.user_id === userId) {
            setJoinedFamilies((current) =>
              current.filter((f) => f.id !== member.family_id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(familiesChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [admin, userId]);

  const handleLeave = async (family) => {
    if (
      !window.confirm(
        `Leave the ${family.service_name} group? You can rejoin later if a slot opens up.`,
      )
    ) {
      return;
    }

    setLeavingId(family.id);
    const { error } = await supabase.rpc("leave_family", {
      p_family_id: family.id,
    });
    setLeavingId(null);

    if (error) {
      console.error("Leave family error:", error);
      toast.showToast("Unable to leave this group. Please try again.", "error");
      return;
    }

    setJoinedFamilies((current) => current.filter((f) => f.id !== family.id));
    toast.showToast("You have left the group.", "success");
  };

  const handleAdminAddMember = async (family, details) => {
    const { data: inserted, error: insertError } = await supabase
      .from("members")
      .insert({
        family_id: family.id,
        user_id: null,
        name: details.name,
        phone: details.phone,
        email: details.email || null,
        social_media_1: details.social1 || null,
        social_media_2: details.social2 || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Admin add member error:", insertError);
      return { ok: false, error: insertError.message };
    }

    const { error: incrementError } = await supabase.rpc(
      "increment_family_slot",
      { p_family_id: family.id },
    );
    if (incrementError) {
      console.error("Increment family slot error:", incrementError);
    }

    setAllGroups((current) =>
      current.map((f) =>
        f.id === family.id ? { ...f, filled_slots: f.filled_slots + 1 } : f,
      ),
    );
    setAllGroupsMembers((current) => ({
      ...current,
      [family.id]: [...(current[family.id] || []), inserted],
    }));

    sendHostNewMemberEmail({
      familyId: family.id,
      memberName: details.name,
    }).catch((error) => {
      console.error("Host new member email failed:", error);
    });
    sendAdminNewMemberEmail({
      memberName: details.name,
      family,
    }).catch((error) => {
      console.error("Admin new member email failed:", error);
    });
    if (details.email) {
      sendAdminAddedMemberEmail({
        email: details.email,
        memberName: details.name,
        family,
      }).catch((error) => {
        console.error("Admin-added member email failed:", error);
      });
    }

    toast.showToast(
      details.email
        ? `${details.name} added — they, the host, and admin were all notified by email.`
        : `${details.name} added — host and admin notified by email.`,
      "success",
    );
    return { ok: true };
  };

  const handleSignOut = async () => {
    if (!supabase.auth?.signOut) return;
    await supabase.auth.signOut();
    navigate("/");
  };

  if (authLoading) {
    return <LoadingSpinner message="Checking your sign-in status…" />;
  }

  const serviceOptions = [
    "All",
    ...Array.from(new Set(allGroups.map((f) => f.service_name))).sort(),
  ];

  const search = groupSearch.trim().toLowerCase();
  const filteredGroups = allGroups
    .filter((f) => {
      if (
        search &&
        !`${f.service_name} ${f.host_name} ${f.host_phone}`
          .toLowerCase()
          .includes(search)
      )
        return false;
      if (serviceFilter !== "All" && f.service_name !== serviceFilter)
        return false;
      if (liveFilter === "Live" && !f.is_live) return false;
      if (liveFilter === "Offline" && f.is_live) return false;
      if (verifiedFilter === "Verified" && !f.is_verified) return false;
      if (verifiedFilter === "Pending" && f.is_verified) return false;
      if (linkFilter === "Has link" && !f.whatsapp_group_link) return false;
      if (linkFilter === "Not made yet" && f.whatsapp_group_link) return false;
      if (slotsFilter === "Full" && f.filled_slots < f.total_slots)
        return false;
      if (slotsFilter === "Open slots" && f.filled_slots >= f.total_slots)
        return false;
      if (originFilter === "Real" && !f.created_by) return false;
      if (originFilter === "Seed" && f.created_by) return false;
      return true;
    })
    .sort((a, b) => {
      switch (groupSort) {
        case "Oldest":
          return new Date(a.created_at) - new Date(b.created_at);
        case "Most slots left":
          return (
            b.total_slots - b.filled_slots - (a.total_slots - a.filled_slots)
          );
        case "Most filled":
          return b.filled_slots - a.filled_slots;
        case "Newest":
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

  const memberSince = session?.user?.created_at
    ? new Date(session.user.created_at).toLocaleDateString("en-KE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-4 sm:px-6 lg:px-8" style={{ touchAction: "pan-y" }}>
      <SeoHead title="Your Account" path="/account" noindex />
      <div className="mx-auto max-w-3xl">
        <Header session={session} authLoading={authLoading} />

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
        >
          ← Back
        </button>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm uppercase tracking-[0.3em] text-saddle-600">
              Your account
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              {session?.user?.user_metadata?.full_name || "Welcome"}
            </h1>
            <p className="mt-1 text-slate-600">{email}</p>
            {memberSince && (
              <p className="mt-1 text-sm text-slate-500">
                Member since {memberSince}
              </p>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Your plan</h2>
            <div className="mt-4 space-y-2">
              {admin ? (
                <PlanRow label="Access" value="Unlimited (admin)" />
              ) : capacity.unlimitedActive ? (
                <PlanRow label="Access" value="Unlimited plan active" />
              ) : (
                <>
                  <PlanRow
                    label="Host passes remaining"
                    value={capacity.hostRemaining}
                  />
                  <PlanRow
                    label="Join passes remaining"
                    value={capacity.joinRemaining}
                  />
                </>
              )}
            </div>
            <Link
              to="/host"
              className="mt-4 inline-flex rounded-full bg-[#1A7A3C] px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Host a group
            </Link>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">
              Groups you host
            </h2>
            {dataLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading…</p>
            ) : hostedFamilies.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                You haven't hosted any groups yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {hostedFamilies.map((family) => (
                  <GroupRow
                    key={family.id}
                    family={family}
                    action={
                      <Link
                        to="/host"
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-100"
                      >
                        Manage
                      </Link>
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">
              Groups you've joined
            </h2>
            {dataLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading…</p>
            ) : joinedFamilies.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                You haven't joined any groups yet.{" "}
                <Link to="/" className="font-semibold text-saddle-600 underline">
                  Browse groups
                </Link>
                .
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {joinedFamilies.map((family) => (
                  <GroupRow
                    key={family.id}
                    family={family}
                    action={
                      <button
                        type="button"
                        onClick={() => handleLeave(family)}
                        disabled={leavingId === family.id}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      >
                        {leavingId === family.id ? "Leaving…" : "Leave group"}
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {admin && (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">
                All groups (admin)
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Every group ever formed on ShareIt, not just yours.
              </p>

              {!allGroupsLoading && allGroups.length > 0 && (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(event) => setGroupSearch(event.target.value)}
                    placeholder="Search by service, host name, or phone…"
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <FilterChips
                      label="Service"
                      options={serviceOptions}
                      value={serviceFilter}
                      onChange={setServiceFilter}
                    />
                    <FilterChips
                      label="Status"
                      options={["All", "Live", "Offline"]}
                      value={liveFilter}
                      onChange={setLiveFilter}
                    />
                    <FilterChips
                      label="Verification"
                      options={["All", "Verified", "Pending"]}
                      value={verifiedFilter}
                      onChange={setVerifiedFilter}
                    />
                    <FilterChips
                      label="WhatsApp link"
                      options={["All", "Has link", "Not made yet"]}
                      value={linkFilter}
                      onChange={setLinkFilter}
                    />
                    <FilterChips
                      label="Slots"
                      options={["All", "Full", "Open slots"]}
                      value={slotsFilter}
                      onChange={setSlotsFilter}
                    />
                    <FilterChips
                      label="Listing type"
                      options={["All", "Real", "Seed"]}
                      value={originFilter}
                      onChange={setOriginFilter}
                    />
                    <FilterChips
                      label="Sort by"
                      options={[
                        "Newest",
                        "Oldest",
                        "Most slots left",
                        "Most filled",
                      ]}
                      value={groupSort}
                      onChange={setGroupSort}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Showing {filteredGroups.length} of {allGroups.length}{" "}
                    groups
                  </p>
                </div>
              )}

              {allGroupsLoading ? (
                <p className="mt-4 text-sm text-slate-500">Loading…</p>
              ) : allGroups.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">No groups found.</p>
              ) : filteredGroups.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  No groups match these filters.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {filteredGroups.map((family) => (
                    <AdminGroupRow
                      key={family.id}
                      family={family}
                      members={allGroupsMembers[family.id] || []}
                      expanded={expandedGroupId === family.id}
                      onToggle={() =>
                        setExpandedGroupId((current) =>
                          current === family.id ? null : family.id,
                        )
                      }
                      onAddMember={handleAdminAddMember}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
