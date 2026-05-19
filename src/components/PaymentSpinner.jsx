// src/components/PaymentSpinner.jsx
// Inline loader for Pay.jsx — shown while verifying the M-Pesa code.
// Smaller than the full-page spinner; sits inside the payment form card.

export default function PaymentSpinner({ message = "Verifying payment…" }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.rings}>
        <div style={{ ...styles.ring, ...styles.r1 }} />
        <div style={{ ...styles.ring, ...styles.r2 }} />
        <div style={styles.dot} />
      </div>
      <div>
        <p style={styles.title}>{message}</p>
        <p style={styles.sub}>This usually takes a few seconds</p>
      </div>

      <style>{`
        @keyframes ps-cw  { to { transform: rotate(360deg);  } }
        @keyframes ps-ccw { to { transform: rotate(-360deg); } }
        @keyframes ps-dot {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%       { transform: scale(.6);  opacity: .4;  }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "18px 20px",
    background: "#f0fdf8",
    border: "1px solid #9FE1CB",
    borderRadius: 10,
    margin: "16px 0",
  },
  rings: {
    position: "relative",
    flexShrink: 0,
    width: 40,
    height: 40,
  },
  ring: {
    position: "absolute",
    borderRadius: "50%",
    borderStyle: "solid",
    borderColor: "transparent",
  },
  r1: {
    inset: 0,
    borderWidth: 2.5,
    borderTopColor: "#1D9E75",
    animation: "ps-cw 1s linear infinite",
  },
  r2: {
    inset: 8,
    borderWidth: 2,
    borderTopColor: "#5DCAA5",
    animation: "ps-ccw 0.75s linear infinite",
  },
  dot: {
    position: "absolute",
    inset: 16,
    background: "#1D9E75",
    borderRadius: "50%",
    animation: "ps-dot 1.2s ease-in-out infinite",
  },
  title: {
    margin: 0,
    fontSize: 14,
    fontWeight: 500,
    color: "#0F6E56",
  },
  sub: {
    margin: "2px 0 0",
    fontSize: 12,
    color: "#5DCAA5",
  },
};
