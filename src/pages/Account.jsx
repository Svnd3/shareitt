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

function AdminGroupRow({ family, members, expanded, onToggle }) {
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
            {!family.whatsapp_group_link && " — No WhatsApp link set"}
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

  const handleSignOut = async () => {
    if (!supabase.auth?.signOut) return;
    await supabase.auth.signOut();
    navigate("/");
  };

  if (authLoading) {
    return <LoadingSpinner message="Checking your sign-in status…" />;
  }

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
              {allGroupsLoading ? (
                <p className="mt-4 text-sm text-slate-500">Loading…</p>
              ) : allGroups.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">No groups found.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {allGroups.map((family) => (
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
