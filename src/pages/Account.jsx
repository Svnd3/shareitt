import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { isAdminEmail } from "../lib/adminAccess";
import { getUserCapacity } from "../lib/payments";
import { fetchHostedFamilies, fetchJoinedFamilies } from "../lib/familyData";
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

  const userId = session?.user?.id;
  const email = session?.user?.email;

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

  const admin = isAdminEmail(email);

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
