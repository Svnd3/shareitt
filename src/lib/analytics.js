const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

// Loads gtag.js once and wires up window.gtag — mirrors the hCaptcha
// script-loading pattern in Auth.jsx (shared script tag by id, guarded
// against double-injection on remount).
export function initGA() {
  if (initialized || !GA_MEASUREMENT_ID || typeof window === "undefined") {
    return;
  }
  initialized = true;

  if (!document.getElementById("ga-gtag-script")) {
    const script = document.createElement("script");
    script.id = "ga-gtag-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  // Page views are sent manually on each route change (see trackPageView) —
  // this is a single-page app, so gtag's own URL-based page_view on load
  // would never fire again after the first render.
  window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
}

export function trackPageView(path) {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(name, params = {}) {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
