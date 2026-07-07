import { useNavigate } from "react-router-dom";
import HowItWorks from "../components/HowItWorks";
import SeoHead from "../components/SeoHead";

export default function HowItWorksPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8" style={{ touchAction: 'pan-y' }}>
      <SeoHead
        title="How ShareIt Works"
        description="See how ShareIt lets Kenyans join or host shared Netflix, Spotify, YouTube Premium and ChatGPT plans safely, step by step."
        path="/how-it-works"
      />
      <div className="mx-auto max-w-4xl space-y-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
        >
          ← Back
        </button>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-saddle-600">
                How it works
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950">
                Learn the ShareIt flow
              </h1>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <HowItWorks />
        </div>
      </div>
    </main>
  );
}
