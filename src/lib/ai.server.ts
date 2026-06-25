// Server-only AI helper. Never import from client code.
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5";
const CLAUDE_MAX_TOKENS = 8192;

type ChatTurn = { role: "system" | "user" | "assistant"; content: string };
type Provider = "lovable" | "claude";

function getProvider(): Provider {
  const explicit = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (explicit === "claude" || explicit === "lovable") return explicit as Provider;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return "lovable";
}

function getLovableKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY no está configurada.");
  return key;
}

function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY no está configurada.");
  return key;
}

function getClaudeModel(): string { return process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL; }

function mapStatus(status: number, body: string): Error {
  if (status === 429) return new Error("Demasiadas solicitudes. Intentá de nuevo en unos segundos.");
  if (status === 402) return new Error("Se agotaron los créditos de IA.");
  if (status === 401) return new Error("API key inválida. Revisá tu configuración.");
  return new Error(`Error del servicio de IA (${status}): ${body.slice(0, 300)}`);
}

function splitSystem(messages: ChatTurn[]) {
  const system = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
  const turns = messages.filter(m => m.role !== "system").map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
  return { system, turns };
}

async function lovableText(messages: ChatTurn[], model: string): Promise<string> {
  const res = await fetch(GATEWAY_URL, { method: "POST", headers: { Authorization: `Bearer ${getLovableKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages }) });
  if (!res.ok) throw mapStatus(res.status, await res.text());
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function claudeText(messages: ChatTurn[]): Promise<string> {
  const { system, turns } = splitSystem(messages);
  const res = await fetch(ANTHROPIC_URL, { method: "POST", headers: { "x-api-key": getAnthropicKey(), "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json" }, body: JSON.stringify({ model: getClaudeModel(), max_tokens: CLAUDE_MAX_TOKENS, ...(system ? { system } : {}), messages: turns }) });
  if (!res.ok) throw mapStatus(res.status, await res.text());
  const json = await res.json();
  const block = (json.content ?? []).find((b: { type: string }) => b.type === "text");
  return block?.text ?? "";
}

export async function aiText(messages: ChatTurn[], model: string = DEFAULT_MODEL): Promise<string> {
  return getProvider() === "claude" ? claudeText(messages) : lovableText(messages, model);
}

async function lovableStructured<T>(messages: ChatTurn[], toolName: string, description: string, parameters: Record<string, unknown>, model: string): Promise<T> {
  const res = await fetch(GATEWAY_URL, { method: "POST", headers: { Authorization: `Bearer ${getLovableKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, tools: [{ type: "function", function: { name: toolName, description, parameters } }], tool_choice: { type: "function", function: { name: toolName } } }) });
  if (!res.ok) throw mapStatus(res.status, await res.text());
  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("La IA no devolvió resultado estructurado.");
  return JSON.parse(call.function.arguments) as T;
}

async function claudeStructured<T>(messages: ChatTurn[], toolName: string, description: string, parameters: Record<string, unknown>): Promise<T> {
  const { system, turns } = splitSystem(messages);
  const res = await fetch(ANTHROPIC_URL, { method: "POST", headers: { "x-api-key": getAnthropicKey(), "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json" }, body: JSON.stringify({ model: getClaudeModel(), max_tokens: CLAUDE_MAX_TOKENS, ...(system ? { system } : {}), messages: turns, tools: [{ name: toolName, description, input_schema: parameters }], tool_choice: { type: "tool", name: toolName } }) });
  if (!res.ok) throw mapStatus(res.status, await res.text());
  const json = await res.json();
  const call = (json.content ?? []).find((b: { type: string; name?: string }) => b.type === "tool_use" && b.name === toolName);
  if (!call?.input) throw new Error("La IA no devolvió resultado estructurado.");
  return call.input as T;
}

export async function aiStructured<T>(messages: ChatTurn[], toolName: string, description: string, parameters: Record<string, unknown>, model: string = DEFAULT_MODEL): Promise<T> {
  return getProvider() === "claude" ? claudeStructured<T>(messages, toolName, description, parameters) : lovableStructured<T>(messages, toolName, description, parameters, model);
}
