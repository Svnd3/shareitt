# ShareIt payment strategy (removed 2026-07-03 — for future re-introduction)

This document records exactly how monetization worked before it was stripped
out of the app, so it can be rebuilt later without re-deriving the design
from scratch. Nothing here is live anymore — it's a spec of the old system.

## Why it was removed

The app was gating the entire product behind a manual, unverified M-Pesa fee
flow. That created friction (new users had to pay before they could do
anything) and risk (money flowed to a personal M-Pesa number with no real
verification — see "Trust model" below). The decision was to strip
monetization entirely for now and relaunch as a free matching platform:
sign up → join a family for free, or host one for free. Payments between a
member and their host for the actual subscription cost still happen, but
entirely outside the app (WhatsApp/M-Pesa, unmediated by ShareIt).

## What existed

### 1. The "Reliability Fee" (mandatory paywall)

A one-time **KSh 90** fee, paid by every user before they could access
anything beyond `/auth`.

- Flow: sign up or sign in → `App.jsx` checked the `payments` table for a
  confirmed row for that `user_id` → if none, hard-redirect to `/pay`
  (`PayRoute` in `src/App.jsx`), which blocked every other route.
- `src/pages/Pay.jsx` rendered M-Pesa "Send Money" instructions to a fixed
  number (`0741401230`, "Lavender Echessa" — the operator's personal M-Pesa,
  not a business till/paybill) and a form for the user to paste the M-Pesa
  SMS confirmation code (validated client-side as `^[A-Z0-9]{10}$`).
- Submitting inserted a row into `payments` (`user_id`, `mpesa_code`,
  `amount: 90`, `payment_confirmed: false`) — confirmation was **not**
  automatic. Someone with the Supabase service-role key had to manually
  flip `payment_confirmed` to `true` after checking the M-Pesa code against
  actual SMS/statement, then the user was unblocked on next login/refresh.
- `src/App.jsx` (`checkPaymentStatus`) queried `payments` for
  `payment_confirmed = true` on every sign-in and drove the `/pay` vs `/`
  redirect via `paymentConfirmed` state.
- A confirmation email (`payment_confirmation` type) and a reminder email
  (`payment_reminder` type, sent by hosts to their members — see below) were
  wired through `supabase/functions/send-email`.

### 2. ShareIt Escrow (optional hosting method — never fully launched)

An alternative to plain WhatsApp hosting where ShareIt was meant to act as a
payment intermediary between a joining member and the host.

- A family's `hosting_method` column could be `'whatsapp'` (default) or
  `'escrow'`.
- `src/pages/EscrowPay.jsx` (route `/pay-escrow/:familyId`, already
  disabled/unrouted before this cleanup) collected `price_per_slot` plus a
  tiered ShareIt service fee via `src/lib/maintenanceFee.js`:
  - `< 200` → KSh 9
  - `200–600` → KSh 12
  - `600–1200` → KSh 17
  - `> 1200` → KSh 22
- Same manual-verification pattern as the reliability fee: user pastes an
  M-Pesa code, a row lands in `escrow_payments`
  (`service_amount`, `maintenance_fee`, `total_amount`, `mpesa_code`,
  `payment_confirmed: false`), and a human with the service-role key
  confirms it later.
- `supabase/functions/escrow-payment-confirmed` was a DB-webhook edge
  function: on `escrow_payments` UPDATE where `payment_confirmed` flips
  `false → true`, it emailed the joining member ("payment confirmed, your
  slot is active"). It never emailed/paid the host automatically — an
  operator was expected to forward the service-minus-fee amount to the host
  manually. That forwarding step was never built.
- A prior commit (`12590c2`, "Hide ShareIt Escrow…") already hid the
  hosting-method picker and the escrow flow from the UI because it "wasn't
  ready" — every new family defaulted to `hosting_method: 'whatsapp'`. This
  cleanup finished the job by deleting the code paths outright.

### 3. Per-member payment tracking on the host dashboard

Independent of the two flows above, `members.payment_confirmed` (default
`false`) was a boolean the host could reference for each joined member.
Nothing in the app ever set it to `true` (no UI wrote it — it would have
needed manual/service-role intervention, same pattern as the other two
tables). The host dashboard (`src/pages/Host.jsx`) showed a "Paid"/"Remind"
badge per member and could fire a `payment_reminder` email pointing the
member at the KSh 90 reliability fee.

### 4. `families.payment_due`

`src/components/ServiceCard.jsx` rendered a "⚠ Host payment due — listing
may become inactive soon" warning when `family.payment_due === true`, but no
`payment_due` column ever existed in `supabase_schema.sql` and nothing set
it. Dead/aspirational code, removed as part of this cleanup.

## Trust model (as it existed)

All money moved over M-Pesa "Send Money" to a personal phone number
(`0741401230`, "Lavender Echessa") — not a Paybill/Till, so there was no
API-based automatic confirmation (no Daraja/M-Pesa STK push or C2B
callback integration). Confirmation was 100% manual: an operator held the
Supabase service-role key and flipped `payment_confirmed` after
cross-checking submitted codes against real M-Pesa statements. This is the
core reason the flow felt like friction without matching security — a
determined user could submit a plausible-looking fake code and the app had
no way to catch it until someone manually checked.

## What's still true after removal

- Members and hosts still settle the *actual subscription cost* directly
  with each other via WhatsApp/M-Pesa — that was always outside ShareIt's
  systems and still is. The disclaimers about this ("payments go directly
  to your host, ShareIt is not a payment processor") remain in the UI
  because they describe that ongoing reality, not a ShareIt feature.
- The underlying Supabase tables (`payments`, `escrow_payments`) and the
  `hosting_method` column/check-constraint on `families` were **left in the
  database schema files untouched** — no destructive migration was run.
  Re-enabling monetization later can reuse them as-is, or replace them with
  a real payment gateway (Daraja STK push, Paystack, Flutterwave, etc.)
  instead of manual M-Pesa-code verification.

## What was deleted in this cleanup

- `src/pages/Pay.jsx` — reliability-fee paywall page.
- `src/pages/EscrowPay.jsx` — escrow payment page.
- `src/lib/maintenanceFee.js` — escrow fee tiers.
- `src/components/PaymentSpinner.jsx` — loading spinner only used by the
  two pages above.
- `supabase/functions/escrow-payment-confirmed/` — escrow confirmation
  webhook function.
- Payment-gate logic in `src/App.jsx` (`checkPaymentStatus`,
  `paymentConfirmed` state, `PayRoute`, the `/pay` route, and every
  redirect branch that sent a signed-in user to `/pay`).
- `sendPaymentConfirmationEmail`, `sendPaymentReminderEmail`,
  `sendEscrowPaymentReceivedEmail` from `src/lib/sendEmail.js`, and their
  corresponding `payment_confirmation` / `payment_reminder` /
  `escrow_payment_received` cases in
  `supabase/functions/send-email/index.ts`.
- The per-member "Paid"/"Remind" payment UI and `handleSendPaymentReminder`
  in `src/pages/Host.jsx`.
- The `family.payment_due` warning badge in `src/components/ServiceCard.jsx`.
- All "KSh 90 reliability fee" copy across `src/pages/Auth.jsx`,
  `src/pages/Home.jsx`, `src/pages/Host.jsx`,
  `src/components/HowItWorks.jsx`, and `src/components/FAQ.jsx` — these
  were rewritten to describe the current free join/host flow instead.

## New flow after removal

1. Sign up or sign in (`src/pages/Auth.jsx`) → land straight on `/` (or
   wherever they were headed, via the existing `location.state.from`
   pattern) — no payment gate in between.
2. From `/`: **Join** a family for free (`src/pages/Join.jsx` — name,
   phone, two social handles for host verification, no fee) or **Host**
   your own for free (`src/pages/Host.jsx` — WhatsApp-only, no
   hosting-method choice).
3. Subscription-cost settlement between member and host continues to
   happen directly over WhatsApp/M-Pesa, outside the app.
