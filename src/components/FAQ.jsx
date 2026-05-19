import { useState } from "react";

export default function FAQ() {
  const [expanded, setExpanded] = useState(0);

  const faqs = [
    {
      q: "What is ShareIt?",
      a: "ShareIt is a subscription-sharing marketplace that connects families and individuals looking to share subscription costs for services like Spotify, Netflix, ChatGPT, and more across Kenya.",
    },
    {
      q: "How does the reliability fee work?",
      a: "The KSh 90 reliability fee is a one-time payment to verify you're a genuine user. It's sent via M-Pesa to 0741401230 when you join a family. This protects hosts from no-shows.",
    },
    {
      q: "Is my payment safe?",
      a: "Payments go directly to your host via M-Pesa. ShareIt is a matching platform, not a payment processor. Always verify the host details before sending money.",
    },
    {
      q: "Can I host my own subscription?",
      a: 'Yes! Head to "Host a Family" and fill in your service details, price, and total slots. You\'ll receive join requests via WhatsApp.',
    },
    {
      q: "What if someone doesn't pay their share?",
      a: "This is between you and your host. That's why we have the reliability fee and verified badges. Always use WhatsApp for communication and keep records.",
    },
    {
      q: "What is ShareIt responsible for?",
      a: "ShareIt is only a marketplace for subscription groups. We do not process payments, hold funds, or guarantee third-party service access. You are responsible for payment and account sharing risks.",
    },
    {
      q: "What risks should I know?",
      a: "There is a risk of group changes, host disputes, or account access issues. ShareIt cannot provide refunds, resolve M-Pesa disputes, or manage third-party bans. Report issues by email and keep your payment proof.",
    },
    {
      q: "How do I join a family?",
      a: '1. Browse available families. 2. Click "Join Family" and enter your name, phone, and email. 3. Pay the KSh 90 reliability fee. 4. Get added to the host\'s WhatsApp group.',
    },
  ];

  return (
    <section className="space-y-4 py-8">
      <div className="space-y-2 px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-slate-950">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-slate-600">
          Got questions? We've got answers.
        </p>
      </div>

      <div className="space-y-2 px-4 sm:px-0">
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-slate-200 bg-white transition"
          >
            <button
              onClick={() => setExpanded(expanded === idx ? -1 : idx)}
              className="flex w-full items-center justify-between px-4 py-4 text-left hover:bg-slate-50 sm:px-6"
            >
              <span className="font-semibold text-slate-950">{faq.q}</span>
              <span
                className={`ml-4 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition ${expanded === idx ? "bg-slate-900 text-white" : ""}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {expanded === idx ? (
                    <line x1="6" y1="12" x2="18" y2="12" />
                  ) : (
                    <>
                      <line x1="12" y1="6" x2="12" y2="18" />
                      <line x1="6" y1="12" x2="18" y2="12" />
                    </>
                  )}
                </svg>
              </span>
            </button>
            {expanded === idx && (
              <div className="border-t border-slate-100 px-4 py-4 text-sm text-slate-600 sm:px-6">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
