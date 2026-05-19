import { useState } from "react";

export default function QuickPairing() {
  const [step, setStep] = useState(1);
  const [slotCount, setSlotCount] = useState(1);
  const [message, setMessage] = useState("");

  const handleQuickPair = () => {
    const totalCost = 250 * slotCount + 150;
    const msg = `Hi ShareIt! I want to quickly pair Spotify Premium with ${slotCount} slot${slotCount > 1 ? "s" : ""}. Total cost including setup: KSh ${totalCost}. Please match me with an available family.`;
    setMessage(msg);
    window.open(
      `https://wa.me/254741401230?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  };

  return (
    <section className="space-y-4 py-8">
      <div className="space-y-2 px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-slate-950">
          ⚡ Quick Pairing — Spotify Premium
        </h2>
        <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          Instant Spotify Match
        </div>
        <p className="text-sm text-slate-600">
          Match with a Spotify family quickly for a one-time KSh 150 setup fee
          and join faster.
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
              <p className="text-sm text-slate-600">Total cost breakdown:</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">
                  Spotify per slot × {slotCount}
                </span>
                <span className="font-semibold text-slate-900">
                  KSh {250 * slotCount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Setup fee (one-time)</span>
                <span className="font-semibold text-slate-900">KSh 150</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-lg font-bold text-emerald-600">
                  KSh {250 * slotCount + 150}
                </span>
              </div>
            </div>

            <button
              onClick={handleQuickPair}
              className="w-full rounded-full bg-[#1A7A3C] px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
            >
              Match on WhatsApp →
            </button>
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
