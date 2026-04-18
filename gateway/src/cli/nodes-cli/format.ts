/** CoreBlow — Nodes Format */ export function formatNodeList(nodes: Array<{ name: string; online: boolean }>): string { return nodes.map((n) => (n.online ? "🟢" : "🔴") + " " + n.name).join("\n"); }
