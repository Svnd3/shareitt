import { useState } from "react";

export default function Tooltip({ children, content, label = "?" }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className="ml-1 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-slate-200 px-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-300 hover:text-slate-700"
        aria-label="Help"
      >
        {label}
      </button>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 max-w-[80vw] -translate-x-1/2 rounded-2xl bg-slate-950 px-3 py-2 text-xs text-white shadow-lg">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950" />
        </div>
      )}
    </div>
  );
}
