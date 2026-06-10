export async function sendViaResend(
  apiKey: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error?.message ||
        result?.error ||
        "Resend API error",
    );
  }

  return result;
}
