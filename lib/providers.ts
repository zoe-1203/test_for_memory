import OpenAI from "openai";
export type Provider = "openai" | "deepseek";

export function getClient(provider: Provider) {
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { client, model: "gpt-4o-mini" };
  }
  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("Missing DEEPSEEK_API_KEY");
  const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL });
  return { client, model: "deepseek-chat" };
}
