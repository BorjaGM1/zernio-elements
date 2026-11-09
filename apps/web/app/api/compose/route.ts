import { streamText } from "ai";
import { EXAMPLE_DATA, catalogPrompt } from "@zernio-elements/catalog";
import { composeModel } from "@/lib/compose-model";

export const maxDuration = 60;

/**
 * Streams a json-render spec (JSONL patches) from the model, constrained by catalogPrompt().
 * The client compiles the stream and validates it against the catalog before anything renders.
 */
export async function POST(req: Request) {
  const configured = composeModel();
  if (!configured) {
    return Response.json({ error: "No model configured. Set ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY on the server." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 1000) {
    return Response.json({ error: "Send a prompt of 1 to 1000 characters." }, { status: 400 });
  }

  const result = streamText({
    model: configured.model,
    system: catalogPrompt({
      data: EXAMPLE_DATA,
      rules: ["The brand is Bodega Norte, a restaurant in Bilbao. Write titles and copy in English."],
    }),
    prompt,
    maxOutputTokens: 6000,
    temperature: 0.2,
  });
  return result.toTextStreamResponse({ headers: { "x-compose-model": configured.label } });
}
