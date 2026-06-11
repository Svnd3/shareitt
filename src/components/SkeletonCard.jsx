// src/components/SkeletonCard.jsx
// Ghost placeholder shown while listing squircles are loading from Supabase.
// Usage: render an array of these (e.g. 12) before real data arrives.

export default function SkeletonCard() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="aspect-square w-full animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

// Render a grid of N skeletons while loading:
export function SkeletonGrid({ count = 12 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}
