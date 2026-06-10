import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  sendPaymentConfirmationEmail,
  sendEscrowPaymentReceivedEmail,
} from "../lib/sendEmail";
import { getEscrowTotal } from "../lib/maintenanceFee";
import PaymentSpinner from "../components/PaymentSpinner";
import LoadingSpinner from "../components/LoadingSpinner";

export default function EscrowPay() {
  const { familyId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [family, setFamily] = useState(location.state?.family || null);
  const [memberId] = useState(location.state?.memberId || null);
  const [loadingFamily, setLoadingFamily] = useState(!location.state?.family);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const isValidMpesaCode = (value) =>
    /^[A-Z0-9]{10}$/.test(value.trim().toUpperCase());

  useEffect(() => {
    const verifyAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth", {
          state: { from: `/pay-escrow/${familyId}` },
          replace: true,
        });
        return;
      }

      if (!family) {
        const { data } = await supabase
          .from("families")
          .select("*")
          .eq("id", familyId)
          .single();
        setFamily(data || null);
      }

      setLoadingFamily(false);
    };

    verifyAccess();
  }, [familyId, family, navigate]);

  const handleSubmit = async () => {
    setError("");
    const trimmed = code.trim().toUpperCase();

    if (!trimmed) {
      setError("Please enter your M-Pesa confirmation code.");
      return;
    }

    if (!isValidMpesaCode(trimmed)) {
      setError(
        "Invalid M-Pesa code format. It should be 10 characters e.g. QHJ2345678",
      );
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/auth", {
        state: { from: `/pay-escrow/${familyId}` },
        replace: true,
      });
      return;
    }

    const { serviceAmount, maintenanceFee, total } = getEscrowTotal(
      family.price_per_slot,
    );

    const { error: dbError } = await supabase.from("escrow_payments").insert({
      family_id: family.id,
      member_id: memberId,
      user_id: user.id,
      service_amount: serviceAmount,
      maintenance_fee: maintenanceFee,
      total_amount: total,
      mpesa_code: trimmed,
      payment_confirmed: false,
    });

    setLoading(false);

    if (dbError) {
      setError("Something went wrong. Please try again.");
      return;
    }

    const userName =
      user.user_metadata?.full_name || user.email || "ShareIt member";
    if (user.email) {
      sendPaymentConfirmationEmail({
        email: user.email,
        memberName: userName,
        amount: total,
      }).catch((emailError) => {
        console.error("Payment confirmation email failed:", emailError);
      });
    }

    if (family.host_email) {
      sendEscrowPaymentReceivedEmail({
        email: family.host_email,
        hostName: family.host_name,
        memberName: userName,
        serviceName: family.service_name,
        amount: total,
        mpesaCode: trimmed,
      }).catch((emailError) => {
        console.error("Host payment notification email failed:", emailError);
      });
    }

    setDone(true);
  };

  if (loadingFamily) {
    return <LoadingSpinner message="Loading payment details…" />;
  }

  if (!family) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold text-slate-950">
            Family not found
          </h1>
          <p className="mt-4 text-slate-600">
            We could not find this family. Return to the homepage and try
            again.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 rounded-full bg-[#1A7A3C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Back to home
          </button>
        </div>
      </main>
    );
  }

  const { serviceAmount, maintenanceFee, total } = getEscrowTotal(
    family.price_per_slot,
  );

  if (done) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
          <h1 className="text-2xl font-semibold text-slate-950">
            Payment submitted
          </h1>
          <p className="text-sm text-slate-600">
            Thanks! We've recorded your KSh {total} payment for{" "}
            {family.service_name}. ShareIt will confirm your payment and
            activate your slot shortly.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex rounded-full bg-[#1A7A3C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Back to home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
      <div className="mx-auto w-full max-w-md space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">
            ShareIt Escrow
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Pay for {family.service_name}
          </h1>
          <p className="text-sm text-slate-600">
            ShareIt collects your subscription payment and forwards it to
            your host on your behalf.
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 space-y-3">
          <p className="text-sm font-semibold text-emerald-800">
            Amount breakdown:
          </p>
          <div className="text-sm text-emerald-700 space-y-1">
            <p>Service price: KSh {serviceAmount}</p>
            <p>ShareIt fee: KSh {maintenanceFee}</p>
            <p className="font-semibold text-emerald-900">
              Total: KSh {total}
            </p>
          </div>
          <ol className="text-sm text-emerald-700 space-y-2 list-decimal list-inside">
            <li>Open M-Pesa on your phone</li>
            <li>
              Go to <strong>Send Money</strong>
            </li>
            <li>
              Send <strong>KSh {total}</strong> to:
            </li>
          </ol>
          <div className="rounded-xl bg-white border border-emerald-200 p-4 text-center space-y-1">
            <p className="text-2xl font-bold text-slate-950">0741401230</p>
            <p className="text-sm text-slate-500">Lavender Echessa</p>
          </div>
          <p className="text-xs text-emerald-600">
            After paying, M-Pesa will send you a confirmation SMS with a code
            like <strong>QHJ2345678</strong>. Paste it below.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm text-slate-700">
            M-Pesa Confirmation Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              type="text"
              maxLength={10}
              placeholder="e.g. QHJ2345678"
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 tracking-widest font-mono"
            />
          </label>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-full bg-[#1A7A3C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Submit & Continue"}
          </button>
          {loading && <PaymentSpinner message="Verifying your M-Pesa code…" />}
        </div>
      </div>
    </main>
  );
}
