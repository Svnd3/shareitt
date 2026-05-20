import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { sendMembershipRequestEmail } from "../lib/sendEmail";
import { defaultFamilies } from "../data/defaultFamilies";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Join() {
  const { familyId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [socialMedia1, setSocialMedia1] = useState("");
  const [socialMedia2, setSocialMedia2] = useState("");
  const [status, setStatus] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const loadFamily = async () => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("id", familyId)
        .single();

      if (error || !data) {
        const fallback = defaultFamilies.find((item) => item.id === familyId);
        setFamily(fallback || null);
        return;
      }

      setFamily(data);
    };

    loadFamily();
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (phoneError) {
      setStatus("Enter a valid Kenyan number e.g. 0712345678.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setStatus("Please enter your full name and phone number.");
      return;
    }
    if (!socialMedia1.trim() || !socialMedia2.trim()) {
      setStatus(
        "Please provide at least two social media contacts for confirmation.",
      );
      return;
    }
    if (!family) {
      setStatus("Unable to load family details.");
      return;
    }
    if (family.created_by === session?.user?.id) {
      setStatus("You cannot join your own family.");
      return;
    }
    if (family.filled_slots >= family.total_slots) {
      setStatus("This family is already full.");
      return;
    }

    setLoading(true);
    setStatus("Joining the family...");

    const { data: existingMember, error: existingError } = await supabase
      .from("members")
      .select("id")
      .eq("family_id", family.id)
      .eq("user_id", session?.user?.id)
      .maybeSingle();

    if (existingError) {
      setStatus("Unable to verify membership. Please try again.");
      setLoading(false);
      return;
    }

    if (existingMember) {
      setStatus("You are already a member of this family.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("members").insert({
      family_id: family.id,
      user_id: session?.user?.id,
      name,
      phone,
      email: email.trim() || session?.user?.email || null,
      social_media_1: socialMedia1.trim(),
      social_media_2: socialMedia2.trim(),
    });

    if (insertError) {
      setStatus("Could not join this family. Please try again.");
      setLoading(false);
      return;
    }

    await supabase
      .from("families")
      .update({ filled_slots: family.filled_slots + 1 })
      .eq("id", family.id);

    setFamily((prev) =>
      prev
        ? {
            ...prev,
            filled_slots: prev.filled_slots + 1,
          }
        : prev,
    );

    const notificationEmail = email.trim() || session?.user?.email;
    if (notificationEmail) {
      sendMembershipRequestEmail({
        email: notificationEmail,
        memberName: name,
        family,
      }).catch((error) => {
        console.error("Membership request email failed:", error);
      });
    }

    setStatus("Joined successfully! You are now a member of this family.");
    setJoined(true);
    setLoading(false);
    setName("");
    setPhone("");
    setEmail("");
    setSocialMedia1("");
    setSocialMedia2("");
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <LoadingSpinner message="Checking your account…" />
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold text-slate-950">
            Sign in to join
          </h1>
          <p className="mt-4 text-slate-600">
            You need to sign in or sign up before joining a family.
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

  if (!family) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">
            Family not found
          </h1>
          <p className="mt-4 text-slate-600">
            Please return to the homepage and choose an active family.
          </p>
        </div>
      </main>
    );
  }

  const slotsLeft = family.total_slots - family.filled_slots;

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">
                Join a family
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950">
                {family.service_name}
              </h1>
            </div>
            <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {slotsLeft <= 0
                ? "Full family"
                : `${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left`}
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
                {family.is_verified ? "Verified" : "Pending"}
              </p>
            </div>
            <div className="rounded-3xl bg-[#E8F5FF] p-5">
              <p className="text-sm text-slate-600">Total slots</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {family.total_slots}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">
            Join the family
          </h2>
          {family.created_by === session?.user?.id ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              You are the host of this family. You cannot join your own family.
              Manage it from the host dashboard instead.
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">
                Submit your details to join this family immediately.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    Full Name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      type="text"
                      placeholder="Jane Doe"
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    Phone Number
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      onBlur={() => {
                        const cleaned = phone.trim();
                        const valid = /^(\+2547|07|2547)\d{8}$/.test(cleaned);
                        setPhoneError(
                          cleaned && !valid
                            ? "Enter a valid Kenyan number e.g. 0712345678"
                            : "",
                        );
                      }}
                      type="tel"
                      placeholder="+2547..."
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
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
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <p className="text-xs text-slate-500">
                  Add at least two social media contacts for confirmation.
                </p>
                <label className="space-y-2 text-sm text-slate-700">
                  Social media contact 1
                  <input
                    value={socialMedia1}
                    onChange={(event) => setSocialMedia1(event.target.value)}
                    type="text"
                    placeholder="WhatsApp / Instagram / Telegram"
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  Social media contact 2
                  <input
                    value={socialMedia2}
                    onChange={(event) => setSocialMedia2(event.target.value)}
                    type="text"
                    placeholder="Instagram / Telegram / Twitter"
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
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
                  {status && <p className="text-sm text-slate-700">{status}</p>}
                </div>
              </form>
              {joined && family.whatsapp_group_link && (
                <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900">
                  <p className="font-semibold">Next step</p>
                  <p className="mt-2">
                    You have been added to the family. Use the WhatsApp group
                    link below to connect with the host and other members.
                  </p>
                  <a
                    href={family.whatsapp_group_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-full bg-[#1A7A3C] px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Open WhatsApp group
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
