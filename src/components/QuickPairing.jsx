import { useState } from "react";

export default function QuickPairing() {
  const [step, setStep] = useState(1);
  const [slotCount, setSlotCount] = useState(1);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const handleQuickPair = () => {
    const msg = `Hi ShareIt! I want to quickly pair Spotify Premium with ${slotCount} slot${slotCount > 1 ? "s" : ""}. I understand there is a one-time KSh 90 setup fee. Please match me on WhatsApp and find people to cost-share with.`;
    setMessage(msg);
    setConfirmed(true);
    setTimeout(() => {
      setConfirmed(false);
      window.open(
        `https://wa.me/254741401230?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    }, 2000);
  };

  return (
    <section className="space-y-4 py-8">
      <div className="space-y-2 px-4 sm:px-0">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-950">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954] text-white">
            <svg
              viewBox="0 0 496 512"
              className="h-5 w-5"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm108.6 362.6c-4.4 6.8-13.2 8.9-20 4.4-54.7-35.4-123.3-43.4-204.3-23.8-7.8 1.7-15.7-3.2-17.4-11-1.7-7.8 3.2-15.7 11-17.4 86.2-18.8 159.2-10 219.6 26.3 6.7 4.3 8.8 13.1 4.4 20zm26.8-63.9c-5.2 8-15.8 10.6-23.8 5.4-62.7-40.7-158.3-52.5-233.6-28.8-9 2.8-18.4-2.9-21.2-11.8-2.8-9 2.9-18.4 11.8-21.2 85.7-27 190.5-14.1 261.5 33.7 8.1 5.2 10.6 15.9 5.3 23.7zm1.7-68.1c-70.9-46-188.8-50.3-262.8-27.5-10.3 3.2-21.2-2.8-24.4-13.1-3.2-10.3 2.8-21.2 13.1-24.4 86.1-27 218.5-22.4 301.8 30.6 9 5.8 12 17.9 6.2 26.9-5.8 9-17.9 12-26.9 6.9z" />
            </svg>
          </span>
          ⚡ Quick Pairing — Spotify Premium
        </h2>
        <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          Instant Spotify Match
        </div>
        <p className="text-sm text-slate-600">
          Match with a Spotify family quickly for a one-time KSh 90 setup fee.
          Press Match on WhatsApp and our team will find people to cost-share
          with.
        </p>
        <p className="text-sm text-slate-600">
          Use the WhatsApp button to send your request and we’ll connect you
          with a suitable sharing group.
        </p>
      </div>

      <div className="space-y-4 px-4 sm:px-0">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900">
                How many slots do you need?
              </label>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => setSlotCount(Math.max(1, slotCount - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-700 border border-slate-200"
                >
                  −
                </button>
                <div className="flex-1 rounded-full bg-white px-4 py-2 text-center text-xl font-bold text-slate-900 border border-slate-200">
                  {slotCount}
                </div>
                <button
                  onClick={() => setSlotCount(slotCount + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-700 border border-slate-200"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-white p-4">
              <p className="text-sm text-slate-600">Quick pairing summary:</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Requested slots</span>
                <span className="font-semibold text-slate-900">
                  {slotCount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Setup fee (one-time)</span>
                <span className="font-semibold text-slate-900">KSh 90</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-lg font-bold text-emerald-600">
                  KSh 90
                </span>
              </div>
            </div>

            {confirmed ? (
              <div className="w-full rounded-full bg-emerald-50 border border-emerald-200 px-6 py-3 text-sm font-bold text-emerald-700 text-center">
                ✅ Request sent! We'll connect you within 24 hours.
              </div>
            ) : (
              <button
                onClick={handleQuickPair}
                className="w-full rounded-full bg-[#1A7A3C] px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
              >
                Match on WhatsApp →
              </button>
            )}
            <p className="text-xs text-slate-600">
              ✓ You'll be prioritized for faster Spotify pairing.
            </p>
            <p className="text-xs text-slate-400">
              Other services: browse listings above or host your own.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}