import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import LoadingSpinner from "../components/LoadingSpinner";

function calculateMaintenanceFee(pricePerSlot, totalSlots) {
  const totalValue = pricePerSlot * totalSlots;
  if (totalValue > 1500) return 50;
  if (totalValue >= 601) return 40;
  return 30;
}

function LoadingOverlay({ message }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-white p-8 shadow-2xl ring-1 ring-slate-200">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-semibold text-slate-950">
          {message || "Loading..."}
        </p>
      </div>
    </div>
  );
}

export default function Host() {
  const location = useLocation();
  const navigate = useNavigate();
  const [serviceName, setServiceName] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostPhone, setHostPhone] = useState("");
  const [pricePerSlot, setPricePerSlot] = useState("");
  const [totalSlots, setTotalSlots] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [myFamilies, setMyFamilies] = useState([]);
  const [joinedFamilies, setJoinedFamilies] = useState([]);
  const [familyMembers, setFamilyMembers] = useState({});
  const [managementLoading, setManagementLoading] = useState(false);

  const loadHostData = async (userId) => {
    setManagementLoading(true);
    const { data: families, error: familiesError } = await supabase
      .from("families")
      .select(
        "id,service_name,host_name,host_phone,price_per_slot,total_slots,filled_slots,is_verified,is_live,whatsapp_group_link,created_by,created_at",
      )
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (familiesError || !families) {
      setMyFamilies([]);
      setFamilyMembers({});
      setJoinedFamilies([]);
      setManagementLoading(false);
      return;
    }

    setMyFamilies(families);
    const familyIds = families.map((family) => family.id);

    if (familyIds.length > 0) {
      const { data: membersData } = await supabase
        .from("members")
        .select("*")
        .in("family_id", familyIds);

      const map = (membersData || []).reduce((acc, member) => {
        acc[member.family_id] = [...(acc[member.family_id] || []), member];
        return acc;
      }, {});
      setFamilyMembers(map);
    } else {
      setFamilyMembers({});
    }

    const { data: joinedData, error: joinedError } = await supabase
      .from("members")
      .select(
        "family_id, families(id,service_name,host_name,host_phone,price_per_slot,total_slots,filled_slots,is_verified,is_live,whatsapp_group_link,created_by,created_at)",
      )
      .eq("user_id", userId);

    if (!joinedError && joinedData) {
      setJoinedFamilies(
        joinedData
          .map((row) => row.families)
          .filter((family) => family != null),
      );
    } else {
      setJoinedFamilies([]);
    }

    setManagementLoading(false);
  };

  useEffect(() => {
    const loadSession = async () => {
      if (!supabase.auth?.getSession) {
        setAuthLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setAuthLoading(false);
        return;
      }

      setSession(data?.session ?? null);
      setAuthLoading(false);
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      },
    );

    return () => authListener?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadHostData(session.user.id);
    } else {
      setMyFamilies([]);
      setFamilyMembers({});
    }
  }, [session]);

  const refreshHostData = async (userId) => {
    if (!userId) return;
    await loadHostData(userId);
  };

  const handleDeleteFamily = async (familyId) => {
    if (
      !window.confirm(
        "Delete this family and all its members? This cannot be undone.",
      )
    ) {
      return;
    }

    setStatus("Removing family listing...");
    setLoading(true);

    const { error: membersError } = await supabase
      .from("members")
      .delete()
      .eq("family_id", familyId);

    if (membersError) {
      console.error("Members deletion error:", membersError);
      setStatus("Unable to delete family members. Please try again.");
      setLoading(false);
      return;
    }

    const { error, data } = await supabase
      .from("families")
      .delete()
      .eq("id", familyId)
      .eq("created_by", session?.user?.id);

    if (error) {
      console.error("Family deletion error:", error);
      setStatus("Unable to delete the family right now. Please try again.");
      setLoading(false);
      return;
    }

    console.log("Family deletion response:", data);

    if (session?.user?.id) {
      await refreshHostData(session.user.id);
    }

    setStatus("Family removed successfully.");
    setLoading(false);
  };

  const handleRemoveMember = async (familyId, memberId) => {
    setStatus("Removing member...");
    setLoading(true);

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", memberId);
    if (error) {
      setStatus("Unable to remove this member. Please try again.");
      setLoading(false);
      return;
    }

    const updatedFamily = myFamilies.find((family) => family.id === familyId);
    if (updatedFamily) {
      await supabase
        .from("families")
        .update({ filled_slots: Math.max(0, updatedFamily.filled_slots - 1) })
        .eq("id", familyId);
      setMyFamilies((current) =>
        current.map((family) =>
          family.id === familyId
            ? { ...family, filled_slots: Math.max(0, family.filled_slots - 1) }
            : family,
        ),
      );
    }

    setFamilyMembers((current) => {
      const next = { ...current };
      next[familyId] = (next[familyId] || []).filter(
        (member) => member.id !== memberId,
      );
      return next;
    });

    setStatus("Member removed from the family.");
    setLoading(false);
  };

  const handleToggleLiveStatus = async (familyId, currentStatus) => {
    setStatus(
      currentStatus
        ? "Removing from live families..."
        : "Making family live...",
    );
    setLoading(true);

    const { error } = await supabase
      .from("families")
      .update({ is_live: !currentStatus })
      .eq("id", familyId)
      .eq("created_by", session?.user?.id);

    if (error) {
      console.error("Live status toggle error:", error);
      setStatus("Unable to update family status. Please try again.");
      setLoading(false);
      return;
    }

    if (session?.user?.id) {
      await refreshHostData(session.user.id);
    }

    setStatus(
      currentStatus
        ? "Family removed from live listings."
        : "Family is now live!",
    );
    setLoading(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (
      !serviceName.trim() ||
      !hostName.trim() ||
      !hostPhone.trim() ||
      !pricePerSlot ||
      !totalSlots
    ) {
      setStatus("Please complete all required fields.");
      return;
    }

    setLoading(true);
    setStatus("Saving your family listing...");

    const { error } = await supabase.from("families").insert([
      {
        service_name: serviceName,
        host_name: hostName,
        host_phone: hostPhone,
        price_per_slot: Number(pricePerSlot),
        total_slots: Number(totalSlots),
        filled_slots: 0,
        is_verified: false,
        is_live: true,
        whatsapp_group_link: whatsappLink,
        created_by: session?.user?.id,
      },
    ]);

    if (error) {
      console.error("Supabase error:", error);
      setStatus(
        `Error: ${error.message || "Unable to create family listing. Please try again."}`,
      );
      setLoading(false);
      return;
    }

    setStatus("Family created.");
    setLoading(false);
    setServiceName("");
    setHostName("");
    setHostPhone("");
    setPricePerSlot("");
    setTotalSlots("");
    setWhatsappLink("");

    if (session?.user?.id) {
      await refreshHostData(session.user.id);
    }

    setTimeout(() => navigate("/"), 2000);
  };

  if (authLoading) {
    return <LoadingSpinner message="Checking your sign-in status…" />;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-3xl font-semibold text-slate-950">
            Sign in to host
          </h1>
          <p className="mt-4 text-slate-600">
            You need to sign in or sign up before creating a family.
          </p>
          <div className="mt-8">
            <Link
              to="/auth"
              state={{ from: location.pathname }}
              className="rounded-full bg-[#1A7A3C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Sign in / Sign up
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (
    managementLoading &&
    myFamilies.length === 0 &&
    joinedFamilies.length === 0
  ) {
    return <LoadingSpinner message="Loading your host dashboard…" />;
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
      {loading && <LoadingOverlay message={status || "Processing…"} />}
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
          >
            ← Back
          </button>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">
            Host a family
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Create your family listing
          </h1>
          <p className="mt-4 text-slate-600">
            Share a service, set your price, and start receiving join requests
            through WhatsApp.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <label className="space-y-2 text-sm text-slate-700">
              Service Name
              <input
                value={serviceName}
                onChange={(event) => setServiceName(event.target.value)}
                type="text"
                placeholder="Netflix Standard"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              Your Name
              <input
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                type="text"
                placeholder="Amina K."
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              Phone Number
              <input
                value={hostPhone}
                onChange={(event) => setHostPhone(event.target.value)}
                type="tel"
                placeholder="+2547..."
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                Price per Slot
                <input
                  value={pricePerSlot}
                  onChange={(event) => setPricePerSlot(event.target.value)}
                  type="number"
                  min="1"
                  placeholder="250"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                Total Slots
                <input
                  value={totalSlots}
                  onChange={(event) => setTotalSlots(event.target.value)}
                  type="number"
                  min="1"
                  placeholder="5"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>
            {Number(pricePerSlot) > 0 && Number(totalSlots) > 0 ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">
                  Estimated monthly maintenance fee
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  KSh{" "}
                  {calculateMaintenanceFee(
                    Number(pricePerSlot),
                    Number(totalSlots),
                  )}
                  /month
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  First month is free. Fee applies from month 2 onwards.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Active hosts get a Verified badge that increases join
                  requests.
                </p>
              </div>
            ) : null}
            <label className="space-y-2 text-sm text-slate-700">
              WhatsApp Group Link (optional)
              <input
                value={whatsappLink}
                onChange={(event) => setWhatsappLink(event.target.value)}
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#1A7A3C] px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? "Saving…" : "Create family"}
              </button>
              {status && <p className="text-sm text-slate-700">{status}</p>}
            </div>
          </form>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-700">
                My listings
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Manage your families and members
              </h2>
            </div>
          </div>

          {managementLoading ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              Loading your hosted families…
            </div>
          ) : myFamilies.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              You don't have any hosted families yet. Create one above to manage
              members and remove listings.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {myFamilies.map((family) => (
                <div
                  key={family.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold text-slate-950">
                          {family.service_name}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            family.is_live
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {family.is_live ? "Live" : "Offline"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {family.total_slots - family.filled_slots} slots
                        available — {family.filled_slots}/{family.total_slots}{" "}
                        joined
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleLiveStatus(family.id, family.is_live)
                        }
                        disabled={loading}
                        className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition ${
                          family.is_live
                            ? "bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                            : "bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        }`}
                      >
                        {family.is_live ? "Remove from Live" : "Make Live"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFamily(family.id)}
                        disabled={loading}
                        className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-3xl bg-white p-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">
                        WhatsApp link
                      </p>
                      <p className="mt-2 text-sm break-all">
                        {family.whatsapp_group_link || "Not provided yet."}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-white p-4 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">Members</p>
                        <span className="text-xs text-slate-500">
                          {familyMembers[family.id]?.length || 0} total
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {(familyMembers[family.id] || []).length === 0 ? (
                          <p className="text-slate-500">
                            No joined members yet.
                          </p>
                        ) : (
                          familyMembers[family.id].map((member) => (
                            <div
                              key={member.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {member.name}
                                </p>
                                <p className="text-sm text-slate-600">
                                  {member.phone}
                                </p>
                                {member.email && (
                                  <p className="text-sm text-slate-500">
                                    {member.email}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMember(family.id, member.id)
                                }
                                disabled={loading}
                                className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-700">
                Joined families
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Families you have joined
              </h2>
            </div>
          </div>

          {managementLoading ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              Loading joined families…
            </div>
          ) : joinedFamilies.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              You haven't joined any families yet. Browse available families to
              join.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {joinedFamilies.map((family) => (
                <div
                  key={family.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">
                        {family.service_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Hosted by {family.host_name} — {family.filled_slots}/
                        {family.total_slots} joined
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        family.is_live
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {family.is_live ? "Live" : "Offline"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm text-slate-700">
                    <div className="rounded-3xl bg-white p-4">
                      <p className="font-semibold text-slate-900">
                        Price per slot
                      </p>
                      <p className="mt-2">KSh {family.price_per_slot}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-4">
                      <p className="font-semibold text-slate-900">Slots</p>
                      <p className="mt-2">{family.total_slots} total</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
