export async function onRequestGet({ env }) {
  const ready = Boolean(env.AI && typeof env.AI.run === "function");
  return new Response(JSON.stringify({
    ready,
    mode: ready ? "private-and-free-daily-ai-edit" : "locked",
    service: "Dau an Ao xanh - private on-device composition and optional free daily AI image editing",
    privateMode: "The original photo stays in the browser and is not uploaded.",
    aiEditMode: "After separate consent, the photo and selected landscape reference are sent to Cloudflare Workers AI FLUX.2 Klein 4B.",
    aiEditModel: "@cf/black-forest-labs/flux-2-klein-4b",
    dailyFreeNeuronAllocation: 10000,
    estimatedNeuronsPerAiEditAtCurrentDimensions: 115,
    estimatedAiEditsWithinQuota: 50,
    noAutomaticPaidFallback: true
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff"
    }
  });
}
