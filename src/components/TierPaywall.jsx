import { useRef, useState } from "react";
import { PRICING_TIERS, generatePaymentReference, verifyPayment } from "../lib/payments";

const ORDER_BY_ACTION = {
  host: ["host", "combo", "power", "unlimited", "join"],
  join: ["join", "combo", "power", "unlimited", "host"],
};

// Mounted by the parent only while the paywall should be visible (e.g.
// `{showPaywall && <TierPaywall ... />}`) — that way each appearance starts
// from fresh state instead of needing an effect to reset it on reopen.
export default function TierPaywall({ action, userEmail, accessToken, onSuccess, onClose }) {
  const [selectedTierId, setSelectedTierId] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | confirming | error
  const [errorMessage, setErrorMessage] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const confirmingRef = useRef(false);

  const order = ORDER_BY_ACTION[action] || PRICING_TIERS.map((tier) => tier.id);
  const orderedTiers = order
    .map((id) => PRICING_TIERS.find((tier) => tier.id === id))
    .filter(Boolean);

  const handlePickTier = (tier) => {
    if (stage === "confirming") return;
    setSelectedTierId(tier.id);
    setErrorMessage("");

    if (!window.PaystackPop) {
      setErrorMessage("Payment is unavailable right now. Please try again shortly.");
      return;
    }

    const reference = generatePaymentReference(tier.id);

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: userEmail || "member@shareitt.xyz",
      amount: tier.amount * 100,
      currency: "KES",
      channels: ["mobile_money"],
      ref: reference,
      label: `ShareIt — ${tier.name}`,
      callback: function (response) {
        confirmingRef.current = true;
        setStage("confirming");
        verifyPayment({ reference: response.reference, tier: tier.id, accessToken })
          .then((grant) => {
            confirmingRef.current = false;
            setStage("idle");
            onSuccess(grant);
          })
          .catch((error) => {
            confirmingRef.current = false;
            setStage("error");
            setErrorMessage(
              error.message || "We couldn't confirm this payment. Please try again.",
            );
          });
      },
      onClose: function () {
        if (!confirmingRef.current) {
          setSelectedTierId(null);
        }
      },
    });

    handler.openIframe();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-saddle-600">
              {action === "host" ? "Host a group" : "Join a group"}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Choose a plan</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={stage === "confirming"}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {orderedTiers.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => handlePickTier(tier)}
              disabled={stage === "confirming"}
              className={`w-full rounded-3xl border p-4 text-left transition disabled:opacity-50 ${
                selectedTierId === tier.id
                  ? "border-[#1A7A3C] bg-[#F1F8F4]"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-950">{tier.name}</p>
                    {tier.badge && (
                      <span className="rounded-full bg-[#1A7A3C] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        {tier.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{tier.description}</p>
                </div>
                <p className="whitespace-nowrap text-lg font-semibold text-slate-950">
                  KSh {tier.amount}
                </p>
              </div>
            </button>
          ))}
        </div>

        {stage === "confirming" && (
          <p className="mt-4 text-center text-sm font-medium text-slate-600">
            Confirming payment…
          </p>
        )}
        {errorMessage && (
          <p className="mt-4 text-center text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setWhyOpen((current) => !current)}
            className="text-sm font-semibold text-[#1A7A3C] underline-offset-2 hover:underline"
          >
            Why this fee?
          </button>
          {whyOpen && (
            <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>This plan fee goes toward:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Keeping the servers and matching system running</li>
                <li>Verifying hosts and members to keep scams off ShareIt</li>
                <li>Supporting the developers who build and maintain ShareIt</li>
                <li>Customer support and dispute help</li>
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Your subscription cost is separate — that's still paid directly to
                your host.
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Secured by Paystack · SSL encrypted
        </p>
      </div>
    </div>
  );
}
