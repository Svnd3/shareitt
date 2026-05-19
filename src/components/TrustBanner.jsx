export default function TrustBanner() {
  return (
    <div className="space-y-4 px-4 sm:px-0">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-emerald-900">
            🛡️ Safety First
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            Payments go <strong>directly to your host</strong> via M-Pesa.
            ShareIt is a <strong>matching platform</strong>, not a payment
            processor. Always verify the host's details and use WhatsApp for
            communication. Trust is earned through verified badges and community
            reviews.
          </p>
        </div>
      </div>
    </div>
  );
}
