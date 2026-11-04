export async function onRequestGet({ env }) {
  const ready = Boolean(env.AI && typeof env.AI.run === "function");
  return new Response(JSON.stringify({
    ready,
    mode: ready ? "private-and-opt-in-ai-edit" : "locked",
    service: "Dau an Ao xanh - private on-device composition and optional AI image editing",
    privateMode: "The original photo stays in the browser and is not uploaded.",
    aiEditMode: "The original photo is sent only after separate explicit consent to Cloudflare AI and the FLUX.1 Kontext Pro model.",
    aiEditModel: "black-forest-labs/flux-1-kontext-pro",
    estimatedAiEditPriceUsd: 0.04
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff"
    }
  });
}
