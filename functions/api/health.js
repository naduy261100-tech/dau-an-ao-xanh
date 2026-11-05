export async function onRequestGet({ env }) {
  const aiBindingReady = Boolean(env.AI && typeof env.AI.run === "function");
  return new Response(JSON.stringify({
    ready: aiBindingReady,
    mode: aiBindingReady ? "one-fresh-ai-background-per-shot" : "ai-binding-not-configured",
    service: "Dau an Ao xanh - on-device person matting with per-shot AI landscape generation",
    privateMode: "Original person pixels and alpha matte stay in the browser and are never uploaded.",
    backgroundModel: "@cf/black-forest-labs/flux-1-schnell",
    backgroundSteps: 4,
    backgroundOutput: "Native model output; browser crops to 4:5 portrait",
    estimatedNeuronsPerNewBackground: 57.6,
    estimatedNeuronsFor100Backgrounds: 5760,
    dailyFreeNeuronAllocation: 10000,
    maxPhotoCompositesTargetPerDay: 100,
    backgroundCacheRequired: false,
    noAutomaticPaidFallback: true,
    quotaStatus: "not-probed",
    healthNote: "This endpoint confirms that the AI binding is configured. It does not call the model, spend Neurons, or guarantee that Cloudflare's daily quota is currently available."
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff"
    }
  });
}
