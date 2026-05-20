import { useState } from "react";

export default function HowItWorks() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      number: 1,
      title: "Browse",
      description:
        "Explore live family listings for your favorite subscriptions",
      icon: "🔍",
    },
    {
      number: 2,
      title: "Confirm via WhatsApp",
      description:
        "Pay KSh 90 reliability fee to 0741401230 via WhatsApp or M-Pesa",
      icon: "💬",
    },
    {
      number: 3,
      title: "Pay KSh 90",
      description: "This keeps hosts protected and keeps listings trusted",
      icon: "💳",
    },
    {
      number: 4,
      title: "Join group",
      description: "After payment, join the WhatsApp group and start sharing",
      icon: "👥",
    },
  ];

  return (
    <section className="space-y-6">
      {/* Desktop view - horizontal stepper */}
      <div className="hidden sm:block">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950 mb-8">
            How it works
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative flex flex-col items-center text-center"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute top-12 left-1/2 w-1/2 h-1 bg-gradient-to-r from-emerald-400 to-emerald-200 hidden lg:block" />
                )}

                {/* Step circle */}
                <div className="relative z-10 mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200">
                  <div className="text-center">
                    <div className="text-3xl mb-1">{step.icon}</div>
                    <div className="text-lg font-bold text-emerald-700">
                      {step.number}
                    </div>
                  </div>
                </div>

                {/* Step content */}
                <h3 className="text-lg font-semibold text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile view - carousel stepper */}
      <div className="sm:hidden">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950 mb-6">
            How it works
          </h2>

          {/* Current step card */}
          <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 p-8 text-center">
            <div className="text-5xl mb-4">{steps[currentStep].icon}</div>
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white border-2 border-emerald-600 mb-4">
              <span className="text-lg font-bold text-emerald-700">
                {steps[currentStep].number}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-slate-950">
              {steps[currentStep].title}
            </h3>
            <p className="mt-3 text-sm text-slate-700">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Navigation dots and buttons */}
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`h-2 rounded-full transition ${
                    index === currentStep
                      ? "w-8 bg-emerald-600"
                      : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setCurrentStep((prev) =>
                    prev === 0 ? steps.length - 1 : prev - 1,
                  )
                }
                className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Back
              </button>
              <button
                onClick={() =>
                  setCurrentStep((prev) => (prev + 1) % steps.length)
                }
                className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
