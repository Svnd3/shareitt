import SummertidesLogo from "../assets/summertideslogo.webp";
import DstvLogo from "../assets/dstvlogo.svg";

export const CUSTOM_LOGOS = [
  ["summertides", SummertidesLogo],
  ["dstv", DstvLogo],
];

export const BRAND_KEYWORDS = [
  ["spotify", "spotify.com"],
  ["netflix", "netflix.com"],
  ["youtube", "youtube.com"],
  ["prime video", "amazon.com"],
  ["amazon", "amazon.com"],
  ["disney", "disneyplus.com"],
  ["showmax", "showmax.com"],
  ["apple", "apple.com"],
  ["chatgpt", "openai.com"],
  ["openai", "openai.com"],
  ["claude", "claude.ai"],
  ["canva", "canva.com"],
  ["microsoft", "microsoft.com"],
  ["google", "google.com"],
  ["notion", "notion.so"],
  ["figma", "figma.com"],
  ["dropbox", "dropbox.com"],
  ["adobe", "adobe.com"],
  ["grammarly", "grammarly.com"],
  ["duolingo", "duolingo.com"],
  ["playstation", "playstation.com"],
  ["xbox", "xbox.com"],
  ["nordvpn", "nordvpn.com"],
  ["expressvpn", "expressvpn.com"],
  ["audible", "audible.com"],
  ["telegram", "telegram.org"],
  ["discord", "discord.com"],
  ["deezer", "deezer.com"],
  ["tidal", "tidal.com"],
  ["soundcloud", "soundcloud.com"],
  ["hulu", "hulu.com"],
  ["crunchyroll", "crunchyroll.com"],
  ["hbo", "max.com"],
  ["linkedin", "linkedin.com"],
];

export function getCustomLogo(serviceName) {
  const lowerName = serviceName?.toLowerCase() ?? "";
  const match = CUSTOM_LOGOS.find(([keyword]) => lowerName.includes(keyword));
  return match ? match[1] : null;
}

export function getBrandDomain(serviceName) {
  const lowerName = serviceName?.toLowerCase() ?? "";
  const match = BRAND_KEYWORDS.find(([keyword]) =>
    lowerName.includes(keyword),
  );

  return match ? match[1] : null;
}

// Whether ServiceCard can resolve a logo for this name on its own — if so,
// there's nothing for the host to upload a photo for.
export function isRecognizedService(serviceName) {
  return Boolean(getCustomLogo(serviceName) || getBrandDomain(serviceName));
}
