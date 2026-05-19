export function createReply(input) {
  const text = String(input ?? "").trim();
  return {
    product: "CoreBlow",
    ok: text.length > 0,
    reply: text.length > 0 ? `CoreBlow received: ${text}` : "CoreBlow needs input.",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(createReply("hello"), null, 2));
}
