import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import PaymentSpinner from "../components/PaymentSpinner";

export default function Pay() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const navigate = useNavigate();

  const isValidMpesaCode = (code) =>
    /^[A-Z0-9]{10}$/.test(code.trim().toUpperCase());

  useEffect(() => {
    const verifyAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth", { state: { from: "/pay" }, replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("payments")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (error) {
        setError("Unable to verify your payment status. Please refresh.");
        setCheckingPayment(false);
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        navigate("/", {
          state: { notice: "Payment already recorded." },
          replace: true,
        });
        return;
      }

      setCheckingPayment(false);
    };

    verifyAccess();
  }, [navigate]);

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
      navigate("/auth", { state: { from: "/pay" }, replace: true });
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (existingError) {
      setLoading(false);
      setError("Unable to verify your payment status. Please try again.");
      return;
    }

    if (Array.isArray(existing) && existing.length > 0) {
      setLoading(false);
      navigate("/", {
        state: { notice: "Payment already recorded." },
        replace: true,
      });
      return;
    }

    const { error: dbError } = await supabase.from("payments").insert({
      user_id: user.id,
      mpesa_code: trimmed,
      amount: 90,
      payment_confirmed: false,
    });

    setLoading(false);

    if (dbError) {
      setError("Something went wrong. Please try again.");
      return;
    }

    navigate("/");
  };

  if (checkingPayment) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-center text-sm text-slate-600">
            Checking payment status…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">
            One-time fee
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Reliability Fee
          </h1>
          <p className="text-sm text-slate-600">
            Pay a one-time KSh 90 fee to verify you're a serious member. This
            protects hosts and keeps ShareIt trusted.
          </p>
        </div>

        {/* Payment instructions */}
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 space-y-3">
          <p className="text-sm font-semibold text-emerald-800">How to pay:</p>
          <ol className="text-sm text-emerald-700 space-y-2 list-decimal list-inside">
            <li>Open M-Pesa on your phone</li>
            <li>
              Go to <strong>Send Money</strong>
            </li>
            <li>
              Send <strong>KSh 90</strong> to:
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

        {/* Code input */}
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
          <p className="text-xs text-slate-500 text-center">
            Need help with your confirmation code? Message us on WhatsApp at
            <span className="font-semibold"> 0741401230</span>.
          </p>
          <p className="text-xs text-slate-500 text-center">
            <a
              href="https://wa.me/254741401230?text=Hi%20ShareIt%2C%20I%20need%20help%20with%20my%20M-Pesa%20payment."
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 underline"
            >
              Chat with us on WhatsApp
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
