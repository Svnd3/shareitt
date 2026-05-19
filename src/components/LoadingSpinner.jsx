// src/components/LoadingSpinner.jsx
// Full-page loader — use while fetching listings, auth checks, etc.

export default function LoadingSpinner({ message = "Loading…" }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.inner}>
        {/* Triple-ring spinner */}
        <div style={styles.rings}>
          <div style={{ ...styles.ring, ...styles.ring1 }} />
          <div style={{ ...styles.ring, ...styles.ring2 }} />
          <div style={{ ...styles.ring, ...styles.ring3 }} />
          <div style={styles.dot} />
        </div>

        {/* Progress bar */}
        <div style={styles.barTrack}>
          <div style={styles.barFill} />
        </div>

        <p style={styles.message}>{message}</p>
      </div>

      <style>{`
        @keyframes spin-cw  { to { transform: rotate(360deg);  } }
        @keyframes spin-ccw { to { transform: rotate(-360deg); } }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%       { transform: scale(.65); opacity: .45; }
        }
        @keyframes bar-slide {
          0%   { transform: translateX(-100%); width: 38%; }
          50%  { width: 55%; }
          100% { transform: translateX(280%);  width: 38%; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  overlay: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    width: "100%",
  },
  inner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
  },
  rings: {
    position: "relative",
    width: 68,
    height: 68,
  },
  ring: {
    position: "absolute",
    borderRadius: "50%",
    borderStyle: "solid",
    borderColor: "transparent",
  },
  ring1: {
    inset: 0,
    borderWidth: 3,
    borderTopColor: "#1D9E75",
    animation: "spin-cw 1.1s linear infinite",
  },
  ring2: {
    inset: 10,
    borderWidth: 2.5,
    borderTopColor: "#5DCAA5",
    animation: "spin-ccw 0.85s linear infinite",
  },
  ring3: {
    inset: 20,
    borderWidth: 2,
    borderTopColor: "#9FE1CB",
    animation: "spin-cw 1.4s linear infinite",
  },
  dot: {
    position: "absolute",
    inset: 30,
    background: "#1D9E75",
    borderRadius: "50%",
    animation: "pulse-dot 1.4s ease-in-out infinite",
  },
  barTrack: {
    width: 180,
    height: 3,
    background: "#e5e7eb",
    borderRadius: 99,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    width: "38%",
    background: "#1D9E75",
    borderRadius: 99,
    animation: "bar-slide 1.5s ease-in-out infinite",
  },
  message: {
    fontSize: 14,
    color: "#6b7280",
    margin: 0,
    letterSpacing: "0.02em",
  },
};
