import { useState } from "react";
import { SOCIAL_PLATFORMS } from "../lib/socialPlatforms";
import { isPlausibleSocialHandle } from "../lib/socialHandle";

export default function SocialHandleInput({ onChange, placeholder }) {
  const [platform, setPlatform] = useState(SOCIAL_PLATFORMS[0]);
  const [handle, setHandle] = useState("");

  const trimmedHandle = handle.trim();
  const showError =
    trimmedHandle.length > 0 && !isPlausibleSocialHandle(trimmedHandle);

  const emit = (nextPlatform, nextHandle) => {
    const trimmed = nextHandle.trim();
    onChange(
      trimmed && isPlausibleSocialHandle(trimmed)
        ? `${nextPlatform}: ${trimmed}`
        : "",
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={platform}
          onChange={(event) => {
            setPlatform(event.target.value);
            emit(event.target.value, handle);
          }}
          className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-44"
        >
          {SOCIAL_PLATFORMS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          value={handle}
          onChange={(event) => {
            setHandle(event.target.value);
            emit(platform, event.target.value);
          }}
          type="text"
          placeholder={placeholder}
          className={`w-full rounded-3xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 ${
            showError ? "border-red-300" : "border-slate-200"
          }`}
        />
      </div>
      {showError && (
        <p className="text-xs text-red-500">
          That doesn't look like a real username — enter your actual handle,
          e.g. @amina_k203.
        </p>
      )}
    </div>
  );
}
