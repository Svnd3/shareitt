import { Link } from "react-router-dom";

const emailAddress = "keninnofficial@gmail.com";
const emailSubject = "ShareIt issue report";
const emailBody =
  "Hello ShareIt team,%0D%0A%0D%0AI would like to report an issue with a family listing or subscription share. Details:%0D%0A%0D%0AService:%0D%0AHost name:%0D%0AIssue:%0D%0A%0D%0ABest regards,%0D%0A";

export default function Report() {
  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">
            Report a problem
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Need help with a family listing?
          </h1>
          <p className="mt-4 text-slate-600">
            If you experienced a listing issue, missing group access, or a
            payment problem, report it directly to ShareIt by email only.
          </p>

          <div className="mt-8 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">
                Email support only
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Report all issues by email to keninnofficial@gmail.com. Keep
                your payment proof, service name, and host details ready.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              <a
                href={`mailto:${emailAddress}?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`}
                className="inline-flex h-full items-center justify-center rounded-3xl bg-[#1A7A3C] px-6 py-5 text-center text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Report by Email
              </a>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Sample report message
              </h2>
              <div className="mt-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Email message</p>
                <pre className="mt-2 rounded-2xl bg-slate-100 p-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap">
                  Hello ShareIt team, I would like to report an issue with a
                  subscription family. Service: Canva Pro Host: James N. Issue:
                  I have not received the WhatsApp group link after paying. Best
                  regards,
                </pre>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
              <p className="font-semibold">Note</p>
              <p className="mt-2">
                Keep your payment confirmation and WhatsApp chat handy so
                ShareIt support can help you faster.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            <p className="font-semibold">Member reporting only</p>
            <p className="mt-2">
              Only members of a full family may use this report email. Please
              include your service name, host name, and a short description of
              the issue.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
            <Link
              to="/"
              className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Back to home
            </Link>
            <Link
              to="/host"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Host a family
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
