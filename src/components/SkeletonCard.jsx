// src/components/SkeletonCard.jsx
// Ghost placeholder shown while listing cards are loading from Supabase.
// Usage: render an array of these (e.g. 6) before real data arrives.

export default function SkeletonCard() {
  return (
    <div style={styles.card}>
      {/* Service icon placeholder */}
      <div style={{ ...styles.skel, ...styles.icon }} />

      {/* Title line */}
      <div style={{ ...styles.skel, ...styles.lineWide, marginBottom: 8 }} />
      {/* Subtitle line */}
      <div style={{ ...styles.skel, ...styles.lineMid, marginBottom: 16 }} />

      {/* Slot dots */}
      <div style={styles.slotRow}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ ...styles.skel, ...styles.slotDot }} />
        ))}
      </div>

      {/* Divider */}
      <div style={styles.divider} />

      {/* Price + button row */}
      <div style={styles.footer}>
        <div style={{ ...styles.skel, ...styles.price }} />
        <div style={{ ...styles.skel, ...styles.btn }} />
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: .45; }
          50%       { opacity: .9;  }
        }
      `}</style>
    </div>
  );
}

// Render a grid of N skeletons while loading:
export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

const shimmer = {
  animation: "shimmer 1.6s ease-in-out infinite",
};

const styles = {
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "16px 18px",
    minWidth: 260,
  },
  skel: {
    background: "#f3f4f6",
    borderRadius: 6,
    ...shimmer,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    marginBottom: 14,
  },
  lineWide: {
    height: 13,
    width: "78%",
  },
  lineMid: {
    height: 11,
    width: "55%",
  },
  slotRow: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
  },
  slotDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
  },
  divider: {
    height: 1,
    background: "#f3f4f6",
    marginBottom: 14,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: {
    height: 18,
    width: 80,
    borderRadius: 6,
  },
  btn: {
    height: 32,
    width: 72,
    borderRadius: 8,
  },
};
