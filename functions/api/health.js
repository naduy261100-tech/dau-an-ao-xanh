export async function onRequestGet({ env }) {
  const ready = Boolean(env.AI && typeof env.AI.run === "function");
  return new Response(JSON.stringify({
    ready,
    mode: ready ? "free-ai" : "locked",
    service: "Dau an Ao xanh - on-device portrait composition with Cloudflare Workers AI",
    photoPrivacy: "The original photo is processed in the browser and is not uploaded to the Worker.",
    backgroundModel: "@cf/black-forest-labs/flux-1-schnell",
    freeDailyNeuronAllowance: 10000
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff"
    }
  });
}
