import { useEffect } from "react";

const SITE_URL = "https://shareitt.xyz";
const DEFAULT_TITLE = "ShareIt | Subscription families for Kenya";
const DEFAULT_DESCRIPTION =
  "Join or host shared subscription plans for Spotify, Netflix, YouTube Premium and more. Split costs with trusted members across Kenya and save monthly.";

function setMeta(selector, attr, value) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

// The app is a client-rendered SPA (react-router, no SSR), so every route
// otherwise inherits the same <title>/description/canonical baked into
// index.html. This keeps each route's head tags distinct for search engines
// and link previews without pulling in react-helmet.
export default function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  noindex = false,
}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ShareIt` : DEFAULT_TITLE;
    document.title = fullTitle;

    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", fullTitle);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[name="twitter:title"]', "content", fullTitle);
    setMeta('meta[name="twitter:description"]', "content", description);

    const canonicalUrl = `${SITE_URL}${path}`;
    setMeta('link[rel="canonical"]', "href", canonicalUrl);
    setMeta('meta[property="og:url"]', "content", canonicalUrl);

    setMeta(
      'meta[name="robots"]',
      "content",
      noindex ? "noindex, follow" : "index, follow",
    );

    // Reset to the site defaults on unmount so a page that doesn't render
    // SeoHead (or an error boundary) never inherits a stale title/noindex.
    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', "content", DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:title"]', "content", DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', "content", DEFAULT_DESCRIPTION);
      setMeta('meta[name="twitter:title"]', "content", DEFAULT_TITLE);
      setMeta('meta[name="twitter:description"]', "content", DEFAULT_DESCRIPTION);
      setMeta('link[rel="canonical"]', "href", SITE_URL);
      setMeta('meta[property="og:url"]', "content", SITE_URL);
      setMeta('meta[name="robots"]', "content", "index, follow");
    };
  }, [title, description, path, noindex]);

  return null;
}
