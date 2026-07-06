import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import SeoHead from "../components/SeoHead";
import {
  sendHostRegistrationEmail,
  sendMemberRemovedEmail,
} from "../lib/sendEmail";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/ToastProvider";
import Tooltip from "../components/Tooltip";
import SocialHandleInput from "../components/SocialHandleInput";
import { SERVICE_NAME_OPTIONS } from "../lib/services";
import TierPaywall from "../components/TierPaywall";
import { getUserCapacity, consumeCapacity, PAYMENTS_ENABLED } from "../lib/payments";

function LoadingOverlay({ message }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-white p-8 shadow-2xl ring-1 ring-slate-200">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-400 border-t-transparent" />
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
  const [hostSocial1, setHostSocial1] = useState("");
  const [socialFieldKey, setSocialFieldKey] = useState(0);
  const [groupNameCopied, setGroupNameCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [myFamilies, setMyFamilies] = useState([]);
  const [joinedFamilies, setJoinedFamilies] = useState([]);
  const [familyMembers, setFamilyMembers] = useState({});
  const [managementLoading, setManagementLoading] = useState(false);
  const [capacity, setCapacity] = useState({
    hostRemaining: 0,
    joinRemaining: 0,
    unlimitedActive: false,
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const toast = useToast();

  const refreshCapacity = async (userId) => {
    if (!userId) return;
    setCapacity(await getUserCapacity(userId));
  };

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
      refreshCapacity(session.user.id);
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
        "Delete this group and all its members? This cannot be undone.",
      )
    ) {
      return;
    }

    setStatus("Removing group listing...");
    setLoading(true);

    const { error: membersError } = await supabase
      .from("members")
      .delete()
      .eq("family_id", familyId);

    if (membersError) {
      console.error("Members deletion error:", membersError);
      setStatus("Unable to delete group members. Please try again.");
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
      setStatus("Unable to delete the group right now. Please try again.");
      setLoading(false);
      return;
    }

    console.log("Family deletion response:", data);

    if (session?.user?.id) {
      await refreshHostData(session.user.id);
    }

    setStatus("Group removed successfully.");
    setLoading(false);
  };

  const handleShareHostPage = async () => {
    setStatus("Preparing share message...");
    setLoading(true);

    const shareText =
      "I’m hosting group subscription listings on ShareIt Kenya. Join live groups for free and connect through WhatsApp to save on services together. ";
    const shareUrl = window.location.origin + "/host";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Host groups on ShareIt",
          text: `${shareText}${shareUrl}`,
          url: shareUrl,
        });
        setStatus("Share dialog opened successfully.");
      } else {
        await navigator.clipboard.writeText(`${shareText}${shareUrl}`);
        setStatus("Message copied to clipboard.");
      }
    } catch (error) {
      console.error("Share failed:", error);
      setStatus("Unable to share automatically. Copy the link manually.");
    }

    setLoading(false);
  };

  const handleRemoveMember = async (familyId, memberId) => {
    setStatus("Removing member...");
    setLoading(true);

    const memberToRemove = (familyMembers[familyId] || []).find(
      (member) => member.id === memberId,
    );

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

    if (memberToRemove?.email) {
      sendMemberRemovedEmail({
        email: memberToRemove.email,
        memberName: memberToRemove.name,
        serviceName: updatedFamily?.service_name || "your group",
        hostName: updatedFamily?.host_name || "your host",
      }).catch((error) => {
        console.error("Member removed email failed:", error);
      });
    }

    setStatus("Member removed from the group.");
    setLoading(false);
  };

  const handleLeaveFamily = async (family) => {
    if (!family) return;
    if (
      !window.confirm(
        "Leave this group? You can rejoin later if slots are available.",
      )
    ) {
      return;
    }

    setStatus("Leaving group...");
    setLoading(true);

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("family_id", family.id)
      .eq("user_id", session?.user?.id)
      .limit(1);

    if (error) {
      console.error("Leave family error:", error);
      setStatus("Unable to leave this group. Please try again.");
      setLoading(false);
      return;
    }

    if (family.id) {
      await supabase
        .from("families")
        .update({ filled_slots: Math.max(0, family.filled_slots - 1) })
        .eq("id", family.id);
    }

    setJoinedFamilies((current) =>
      current.filter((joined) => joined.id !== family.id),
    );

    setStatus("You have left the group.");
    setLoading(false);
  };

  const handleToggleLiveStatus = async (familyId, currentStatus) => {
    setStatus(
      currentStatus
        ? "Removing from live groups..."
        : "Making group live...",
    );
    setLoading(true);

    const { error } = await supabase
      .from("families")
      .update({ is_live: !currentStatus })
      .eq("id", familyId)
      .eq("created_by", session?.user?.id);

    if (error) {
      console.error("Live status toggle error:", error);
      setStatus("Unable to update group status. Please try again.");
      setLoading(false);
      return;
    }

    if (session?.user?.id) {
      await refreshHostData(session.user.id);
    }

    setStatus(
      currentStatus
        ? "Group removed from live listings."
        : "Group is now live!",
    );
    setLoading(false);
  };

  const suggestedGroupName = serviceName.trim()
    ? `${serviceName.trim()} – ShareIt Group`
    : "";

  const handleCopyGroupName = async () => {
    try {
      await navigator.clipboard.writeText(suggestedGroupName);
      setGroupNameCopied(true);
      setTimeout(() => setGroupNameCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      setStatus("Unable to copy. Long-press the name to copy it manually.");
    }
  };

  const createFamilyListing = async () => {
    setLoading(true);
    setStatus("Saving your group listing...");

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
        hosting_method: "whatsapp",
        host_social_1: hostSocial1.trim(),
        host_email: session?.user?.email || null,
        created_by: session?.user?.id,
      },
    ]);

    if (error) {
      console.error("Supabase error:", error);
      setStatus(
        `Error: ${error.message || "Unable to create group listing. Please try again."}`,
      );
      setLoading(false);
      return;
    }

    setStatus("Group created.");
    setLoading(false);
    setServiceName("");
    setHostName("");
    setHostPhone("");
    setPricePerSlot("");
    setTotalSlots("");
    setWhatsappLink("");
    setHostSocial1("");
    setSocialFieldKey((key) => key + 1);

    if (session?.user?.email) {
      sendHostRegistrationEmail({
        email: session.user.email,
        family: {
          host_name: hostName,
          service_name: serviceName,
          total_slots: Number(totalSlots),
          price_per_slot: Number(pricePerSlot),
          whatsapp_group_link: whatsappLink,
        },
      }).catch((error) => {
        console.error("Host registration email failed:", error);
      });
    }

    if (PAYMENTS_ENABLED) {
      try {
        await consumeCapacity("host");
      } catch (capacityError) {
        console.error("Consume host capacity failed:", capacityError);
      }
    }

    if (session?.user?.id) {
      await refreshHostData(session.user.id);
      await refreshCapacity(session.user.id);
    }

    setTimeout(() => navigate("/"), 2000);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (
      !serviceName.trim() ||
      !hostName.trim() ||
      !hostPhone.trim() ||
      !pricePerSlot ||
      !totalSlots ||
      !hostSocial1.trim()
    ) {
      setStatus("Please complete all required fields.");
      return;
    }

    if (!PAYMENTS_ENABLED || capacity.hostRemaining > 0 || capacity.unlimitedActive) {
      await createFamilyListing();
      return;
    }

    setShowPaywall(true);
  };

  const handlePaywallSuccess = async () => {
    setShowPaywall(false);
    if (session?.user?.id) {
      await refreshCapacity(session.user.id);
    }
    await createFamilyListing();
  };

  if (authLoading) {
    return <LoadingSpinner message="Checking your sign-in status…" />;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
        <SeoHead title="Host a Group" path="/host" noindex />
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-3xl font-semibold text-slate-950">
            Sign in to host
          </h1>
          <p className="mt-4 text-slate-600">
            You need to sign in or sign up before creating a group.
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
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
      <SeoHead title="Host a Group" path="/host" noindex />
      {loading && <LoadingOverlay message={status || "Processing…"} />}
      {showPaywall && (
        <TierPaywall
          action="host"
          userEmail={session?.user?.email}
          accessToken={session?.access_token}
          onSuccess={handlePaywallSuccess}
          onClose={() => setShowPaywall(false)}
        />
      )}
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleShareHostPage}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
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
            Share host page
          </button>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-saddle-600">
            Host a group
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Create your group listing
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
                list="service-name-options"
                placeholder="Select or type a service"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
              <datalist id="service-name-options">
                {SERVICE_NAME_OPTIONS.filter((option) => option !== "Other").map(
                  (option) => (
                    <option key={option} value={option} />
                  ),
                )}
              </datalist>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              Your Name
              <input
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                type="text"
                placeholder="Amina K."
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              Phone Number{" "}
              <span className="text-saddle-600">(required)</span>
              <input
                value={hostPhone}
                onChange={(event) => setHostPhone(event.target.value)}
                type="tel"
                required
                placeholder="+2547..."
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              Your Social Media{" "}
              <span className="text-saddle-600">(required)</span>
              <Tooltip content="Instagram, Telegram, X, Facebook, TikTok, Snapchat, or LinkedIn — helps members verify you" />
              <SocialHandleInput
                key={socialFieldKey}
                onChange={setHostSocial1}
                placeholder="@username"
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
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                Total Slots{" "}
                <Tooltip content="Slots for other members to join — this is on top of your own seat in the subscription. E.g. for a 5-screen plan where you keep 1 screen, enter 4." />
                <input
                  value={totalSlots}
                  onChange={(event) => setTotalSlots(event.target.value)}
                  type="number"
                  min="1"
                  placeholder="4"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
                <span className="block text-xs text-slate-500">
                  Number of slots available to members joining you — not
                  including your own seat.
                </span>
              </label>
            </div>
            <div className="space-y-3 rounded-3xl border border-saddle-200 bg-saddle-50 p-5 text-sm text-saddle-900">
              <p className="font-semibold">Set up your WhatsApp group</p>
              <p className="text-slate-700">
                We've generated a name for your group below. Copy it, open
                WhatsApp, create a new group and paste it in as the group
                name. Once you've added members, copy the group's invite link
                and paste it into the field below — anyone who opens it will
                land in a group that's already named and ready to go.
              </p>
              {suggestedGroupName ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1 break-words rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900">
                    {suggestedGroupName}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyGroupName}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      {groupNameCopied ? "Copied!" : "Copy name"}
                    </button>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(suggestedGroupName)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-[#1A7A3C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                    >
                      Open WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-saddle-700">
                  Select a service above to generate a group name.
                </p>
              )}
            </div>

            <label className="space-y-2 text-sm text-slate-700">
              WhatsApp Group Link (optional)
              <input
                value={whatsappLink}
                onChange={(event) => setWhatsappLink(event.target.value)}
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
              <p className="font-semibold">
                ⚠ You are fully responsible for this group's money
              </p>
              <p className="mt-2 text-red-800">
                Every M-Pesa payment goes straight between you and your
                members — ShareIt is not involved and cannot see, hold,
                refund, or recover any of it. If a member pays the wrong
                amount, doesn't pay at all, or vanishes after joining,{" "}
                <strong>that loss is yours</strong> and ShareIt accepts no
                responsibility or liability for it. Only host if you trust
                your own ability to collect payments and resolve issues
                directly.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#1A7A3C] px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? "Saving…" : "Create group"}
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
                Manage your groups and members
              </h2>
            </div>
          </div>

          {managementLoading ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              Loading your hosted groups…
            </div>
          ) : myFamilies.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              You don't have any hosted groups yet. Create one above to manage
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
                              <div className="flex flex-wrap gap-2">
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
                Joined groups
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Groups you have joined
              </h2>
            </div>
          </div>

          {managementLoading ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              Loading joined groups…
            </div>
          ) : joinedFamilies.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              You haven't joined any groups yet. Browse available groups to
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
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleLeaveFamily(family)}
                      disabled={loading}
                      className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      Leave group
                    </button>
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
