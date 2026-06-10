import { useState } from "react";
import { SOCIAL_PLATFORMS } from "../lib/socialPlatforms";

export default function SocialHandleInput({ onChange, placeholder }) {
  const [platform, setPlatform] = useState(SOCIAL_PLATFORMS[0]);
  const [handle, setHandle] = useState("");

  const emit = (nextPlatform, nextHandle) => {
    onChange(nextHandle.trim() ? `${nextPlatform}: ${nextHandle.trim()}` : "");
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select
        value={platform}
        onChange={(event) => {
          setPlatform(event.target.value);
          emit(event.target.value, handle);
        }}
        className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 sm:w-44"
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
        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  );
}
