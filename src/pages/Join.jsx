import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabaseClient";
import {
  sendMembershipRequestEmail,
  sendHostNewMemberEmail,
  sendAdminNewMemberEmail,
  sendAdminFamilyFullEmail,
  sendHostFamilyFullEmail,
  sendMemberLeftEmail,
} from "../lib/sendEmail";
import SeoHead from "../components/SeoHead";
import { defaultFamilies } from "../data/defaultFamilies";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/ToastProvider";
import Tooltip from "../components/Tooltip";
import SocialHandleInput from "../components/SocialHandleInput";
import HowItWorks from "../components/HowItWorks";
import TierPaywall from "../components/TierPaywall";
import { getUserCapacity, consumeCapacity, PAYMENTS_ENABLED } from "../lib/payments";
import { buildDefaultGroupDescription } from "../lib/groupDescription";

export default function Join() {
  const { familyId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [socialMedia1, setSocialMedia1] = useState("");
  const [socialMedia2, setSocialMedia2] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinedMemberName, setJoinedMemberName] = useState("");
  const [abandoning, setAbandoning] = useState(false);
  const [abandoned, setAbandoned] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [capacity, setCapacity] = useState({
    hostRemaining: 0,
    joinRemaining: 0,
    unlimitedActive: false,
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const toast = useToast();

  const refreshCapacity = async (userId, email) => {
    if (!userId) return;
    setCapacity(await getUserCapacity(userId, email));
  };

  useEffect(() => {
    let cancelled = false;

    const loadFamily = async () => {
      if (!familyId) {
        setFamilyLoading(false);
        return;
      }

      try {
        // Bypass the supabase-js client for this read, same as Home.jsx:
        // "families" is publicly readable under RLS, but the anon/authenticated
        // roles only have column-level SELECT grants on a subset of columns
        // (host_email and host_payment_mpesa_code are excluded). select("*")
        // requires privilege on every column, so it gets a blanket 401 and
        // silently turned every real family into "Family not found" here —
        // list only the columns this page actually needs.
        const params = new URLSearchParams({
          select:
            "id,service_name,host_name,host_phone,price_per_slot,total_slots,filled_slots,is_verified,is_live,whatsapp_group_link,hosting_method,logo_url,group_description,created_by,created_at",
          id: `eq.${familyId}`,
        });
        const response = await fetch(
          `${supabaseUrl}/rest/v1/families?${params.toString()}`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            signal: AbortSignal.timeout(15000),
          },
        );

        if (cancelled) return;

        if (!response.ok) throw new Error(`status ${response.status}`);

        const data = await response.json();
        if (data?.[0]) {
          setFamily(data[0]);
        } else {
          const fallback = defaultFamilies.find((item) => item.id === familyId);
          setFamily(fallback || null);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Join fetch family exception:", error);
        const fallback = defaultFamilies.find((item) => item.id === familyId);
        setFamily(fallback || null);
      } finally {
        if (!cancelled) setFamilyLoading(false);
      }
    };

    loadFamily();
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  // Keep the slot count on this page live so a group that fills up while
  // someone is filling out the form is reflected immediately, instead of
  // only after they submit and hit the "already full" check server-side.
  useEffect(() => {
    if (!familyId || !supabase.channel) return;

    const channel = supabase
      .channel(`family-${familyId}-changes`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "families",
          filter: `id=eq.${familyId}`,
        },
        (payload) => {
          setFamily((current) =>
            current ? { ...current, ...payload.new } : current,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId]);

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
      refreshCapacity(session.user.id, session.user.email);
    }
  }, [session]);

  const handleShareFamily = async () => {
    if (!family) {
      toast.showToast("Unable to share group details.", "error");
      return;
    }

    const shareText = `Join \"${family.service_name}\" group hosted by ${family.host_name}. Price: KSh ${family.price_per_slot}/slot. ${family.total_slots - family.filled_slots} slots available.`;
    const shareUrl = `${window.location.origin}/join/${family.id}`;
    const payload = `${shareText} ${shareUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `ShareIt — ${family.service_name}`,
          text: shareText,
          url: shareUrl,
        });
        toast.showToast("Group shared successfully!", "success");
      } else {
        await navigator.clipboard.writeText(payload);
        toast.showToast("Group link copied to clipboard!", "success");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Share failed:", error);
        toast.showToast(
          "Unable to share automatically. Copy the link manually.",
          "error",
        );
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedPhone = phone.trim();
    const validPhone = /^(\+254|254|0)[17]\d{8}$/.test(trimmedPhone);
    if (!validPhone) {
      toast.showToast(
        "Enter a valid Kenyan number e.g. 0712345678 or 0112345678.",
        "error",
      );
      setPhoneError("Enter a valid Kenyan number e.g. 0712345678 or 0112345678");
      return;
    }

    if (!name.trim() || !trimmedPhone) {
      toast.showToast("Please enter your full name and phone number.", "error");
      return;
    }

    if (!socialMedia1.trim() || !socialMedia2.trim()) {
      toast.showToast(
        "Please provide at least two social media contacts for confirmation.",
        "error",
      );
      return;
    }

    if (!family) {
      toast.showToast("Unable to load group details.", "error");
      return;
    }

    if (family.created_by === session?.user?.id) {
      toast.showToast("You cannot join your own group.", "warning");
      return;
    }

    if (family.filled_slots >= family.total_slots) {
      toast.showToast("This group is already full.", "warning");
      return;
    }

    if (!PAYMENTS_ENABLED || capacity.joinRemaining > 0 || capacity.unlimitedActive) {
      await joinFamilyNow();
      return;
    }

    setShowPaywall(true);
  };

  const handlePaywallSuccess = async () => {
    setShowPaywall(false);
    if (session?.user?.id) {
      await refreshCapacity(session.user.id, session.user.email);
    }
    await joinFamilyNow();
  };

  const joinFamilyNow = async () => {
    const trimmedPhone = phone.trim();
    setLoading(true);

    const { data: existingMember, error: existingError } = await supabase
      .from("members")
      .select("id")
      .eq("family_id", family.id)
      .eq("user_id", session?.user?.id)
      .maybeSingle();

    if (existingError) {
      toast.showToast(
        "Unable to verify membership. Please try again.",
        "error",
      );
      setLoading(false);
      return;
    }

    if (existingMember) {
      toast.showToast("You are already a member of this group.", "info");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("members").insert({
      family_id: family.id,
      user_id: session?.user?.id,
      name: name.trim(),
      phone: trimmedPhone,
      email: email.trim() || session?.user?.email || null,
      social_media_1: socialMedia1.trim(),
      social_media_2: socialMedia2.trim(),
    });

    if (insertError) {
      toast.showToast("Could not join this group. Please try again.", "error");
      setLoading(false);
      return;
    }

    // Joiners aren't the family owner, so RLS blocks a direct update to
    // families.filled_slots. This RPC atomically increments it (and only it)
    // within bounds — see supabase_rls_policies.sql.
    await supabase.rpc("increment_family_slot", { p_family_id: family.id });

    setFamily((current) =>
      current
        ? { ...current, filled_slots: current.filled_slots + 1 }
        : current,
    );

    const notificationEmail = email.trim() || session?.user?.email;
    if (notificationEmail) {
      sendMembershipRequestEmail({
        email: notificationEmail,
        memberName: name.trim(),
        family,
      }).catch((error) => {
        console.error("Membership request email failed:", error);
      });
    }

    sendHostNewMemberEmail({
      familyId: family.id,
      memberName: name.trim(),
    }).catch((error) => {
      console.error("Host new member email failed:", error);
    });

    sendAdminNewMemberEmail({
      memberName: name.trim(),
      family,
    }).catch((error) => {
      console.error("Admin new member email failed:", error);
    });

    if (family.filled_slots + 1 >= family.total_slots) {
      sendAdminFamilyFullEmail({ family }).catch((error) => {
        console.error("Admin family full email failed:", error);
      });

      sendHostFamilyFullEmail({ familyId: family.id }).catch((error) => {
        console.error("Host family full email failed:", error);
      });
    }

    if (PAYMENTS_ENABLED && !capacity.unlimitedActive) {
      try {
        await consumeCapacity("join");
      } catch (capacityError) {
        console.error("Consume join capacity failed:", capacityError);
      }
    }
    if (session?.user?.id) {
      await refreshCapacity(session.user.id, session.user.email);
    }

    toast.showToast(
      "Joined successfully! You are now a member of this group.",
      "success",
    );
    setJoined(true);
    setJoinedMemberName(name.trim());
    setLoading(false);
    setName("");
    setPhone("");
    setEmail("");
    setSocialMedia1("");
    setSocialMedia2("");
  };

  const handleAbandon = async () => {
    if (
      !window.confirm(
        "Leave this group? Your slot will open up for someone else to join.",
      )
    ) {
      return;
    }

    setAbandoning(true);
    const { error } = await supabase.rpc("leave_family", {
      p_family_id: family.id,
    });

    if (error) {
      console.error("Abandon group error:", error);
      toast.showToast("Unable to leave this group. Please try again.", "error");
      setAbandoning(false);
      return;
    }

    sendMemberLeftEmail({
      familyId: family.id,
      memberName: joinedMemberName || "A member",
    }).catch((emailError) => {
      console.error("Member left email failed:", emailError);
    });

    toast.showToast("You have left the group.", "success");
    setAbandoning(false);
    setAbandoned(true);
    setJoined(false);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <LoadingSpinner message="Checking your account…" />
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
        <SeoHead title="Join a Group" path={`/join/${familyId}`} noindex />
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold text-slate-950">
            Sign in to join
          </h1>
          <p className="mt-4 text-slate-600">
            You need to sign in or sign up before joining a group.
          </p>
          <div className="mt-8 flex justify-center">
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

  if (familyLoading) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <LoadingSpinner message="Loading group details…" />
        </div>
      </main>
    );
  }

  if (!family) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
        <SeoHead title="Join a Group" path={`/join/${familyId}`} noindex />
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold text-slate-950">
            Group not found
          </h1>
          <p className="mt-4 text-slate-600">
            We could not find that group. Return to the homepage and browse
            active groups.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/"
              className="rounded-full bg-[#1A7A3C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Browse groups
            </Link>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Go back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const slotsLeft = family.total_slots - family.filled_slots;

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
      <SeoHead title="Join a Group" path={`/join/${familyId}`} noindex />
      {showPaywall && (
        <TierPaywall
          action="join"
          userEmail={session?.user?.email}
          accessToken={session?.access_token}
          onSuccess={handlePaywallSuccess}
          onClose={() => setShowPaywall(false)}
        />
      )}
      <div className="mx-auto max-w-3xl space-y-8">
        <HowItWorks />

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-saddle-600">
                Join a group
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950">
                {family.service_name}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {family.group_description || buildDefaultGroupDescription(family)}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleShareFamily}
                className="inline-flex items-center gap-2 rounded-full bg-[#1A7A3C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-[#F1F8F4] p-5">
              <p className="text-sm text-slate-600">Host</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {family.host_name}
              </p>
            </div>
            <div className="rounded-3xl bg-[#F1F8F4] p-5">
              <p className="text-sm text-slate-600">Price per slot</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                KSh {family.price_per_slot}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-[#FEF3C7] p-5">
              <p className="text-sm text-slate-600">Verification</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {family.is_verified ? "✓ Verified" : "Pending"}
              </p>
              {!family.is_verified && (
                <p className="mt-1 text-xs text-slate-500">
                  Usually takes 2-15 minutes
                </p>
              )}
            </div>
            <div className="rounded-3xl bg-[#E8F5FF] p-5">
              <p className="text-sm text-slate-600">Total slots</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {family.total_slots}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">Direct payment to host</p>
            <p className="mt-2 text-slate-700">
              Payments go directly to the host via WhatsApp, outside ShareIt
              — ShareIt is not liable for payment disputes for this group.
              ShareIt's role is only to help you connect, so always verify
              the host's details before sending money.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">
            Join the group
          </h2>
          {family.created_by === session?.user?.id ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              You are the host of this group. You cannot join your own group.
              Manage it from the host dashboard instead.
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">
                Submit your details to join this group immediately.
              </p>
              <div className="mt-4 rounded-3xl border border-saddle-200 bg-saddle-50 p-5 text-sm text-saddle-900">
                <p className="font-semibold">Social confirmation required</p>
                <p className="mt-2 text-slate-700">
                  Add at least two social media contacts so the host can confirm
                  your profile. Use Instagram, Telegram, X, Facebook, TikTok,
                  Snapchat, or LinkedIn.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    Full Name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      type="text"
                      placeholder="Jane Doe"
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    Phone Number{" "}
                    <span className="text-saddle-600">(required)</span>
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      onBlur={() => {
                        const cleaned = phone.trim();
                        const valid = /^(\+254|254|0)[17]\d{8}$/.test(cleaned);
                        setPhoneError(
                          !cleaned
                            ? "Phone number is required"
                            : !valid
                              ? "Enter a valid Kenyan number e.g. 0712345678 or 0112345678"
                              : "",
                        );
                      }}
                      type="tel"
                      required
                      placeholder="0712345678 or 0112345678"
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                    {phoneError && (
                      <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                    )}
                  </label>
                </div>
                <label className="space-y-2 text-sm text-slate-700">
                  Email (optional)
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  Social media contact 1{" "}
                  <span className="text-saddle-600">(required)</span>
                  <Tooltip content="Instagram, Telegram, X, Facebook, TikTok, Snapchat, or LinkedIn for host verification" />
                  <SocialHandleInput
                    onChange={setSocialMedia1}
                    placeholder="@username"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  Social media contact 2{" "}
                  <span className="text-saddle-600">(required)</span>
                  <Tooltip content="A different platform for added verification" />
                  <SocialHandleInput
                    onChange={setSocialMedia2}
                    placeholder="@username"
                  />
                </label>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading || slotsLeft <= 0}
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#1A7A3C] px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? "Processing…" : "Join now"}
                  </button>
                </div>
              </form>
              {joined && (
                <div className="mt-6 rounded-3xl border border-saddle-200 bg-saddle-50 p-5 text-sm text-saddle-900">
                  <p className="font-semibold">Next step</p>
                  {family.whatsapp_group_link ? (
                    <>
                      <p className="mt-2">
                        You have been added to the group. Use the WhatsApp
                        group link below to connect with the host and other
                        members.
                      </p>
                      <a
                        href={family.whatsapp_group_link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex rounded-full bg-[#1A7A3C] px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                      >
                        Open WhatsApp group
                      </a>
                    </>
                  ) : (
                    <>
                      <p className="mt-2">
                        You're on the list! The host hasn't shared a WhatsApp
                        group link yet — message {family.host_name} directly to
                        get connected and arrange payment.
                      </p>
                      {family.host_phone && (
                        <a
                          href={`https://wa.me/${family.host_phone.replace(/\D/g, "").replace(/^0/, "254")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex rounded-full bg-[#1A7A3C] px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                        >
                          Message {family.host_name} on WhatsApp
                        </a>
                      )}
                      <p className="mt-4 text-xs text-saddle-800">
                        Host not responding?{" "}
                        <Link to="/report" className="font-semibold underline">
                          Report it to ShareIt
                        </Link>{" "}
                        and we'll help sort it out.
                      </p>
                    </>
                  )}

                  <div className="mt-5 border-t border-saddle-200 pt-4">
                    <p className="text-saddle-800">
                      Joined by mistake? Want to join a different service
                      instead?
                    </p>
                    <button
                      type="button"
                      onClick={handleAbandon}
                      disabled={abandoning}
                      className="mt-3 inline-flex rounded-full border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      {abandoning ? "Leaving…" : "Abandon group"}
                    </button>
                  </div>
                </div>
              )}
              {abandoned && (
                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">
                    You've left the group.
                  </p>
                  <p className="mt-2">
                    Your slot has been freed up. Browse other groups if you'd
                    like to join a different one.
                  </p>
                  <Link
                    to="/"
                    className="mt-4 inline-flex rounded-full bg-[#1A7A3C] px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Browse groups
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
