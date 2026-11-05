export async function onRequestGet({ env }) {
  const aiReady = Boolean(env.AI && typeof env.AI.run === "function");
  const cacheReady = Boolean(env.BG_CACHE && typeof env.BG_CACHE.get === "function" && typeof env.BG_CACHE.put === "function");
  return new Response(JSON.stringify({
    ready: aiReady && cacheReady,
    mode: aiReady && cacheReady ? "daily-ai-background-pool" : "locked",
    service: "Dau an Ao xanh - on-device person matting with a daily AI landscape pool",
    privateMode: "Original person pixels and alpha matte stay in the browser and are never uploaded.",
    backgroundModel: "@cf/black-forest-labs/flux-2-klein-4b",
    backgroundSize: "1024x1280",
    dailyPoolVariants: 44,
    poolDesign: "11 scenery themes x 4 AI-generated variants per UTC day; cached landscape backgrounds are reused to serve about 100 local photo composites.",
    estimatedNeuronsPerNewBackground: 156.3,
    estimatedDailyNeuronsAtFullPool: 6877.2,
    dailyFreeNeuronAllocation: 10000,
    backgroundCacheReady: cacheReady,
    cacheProvider: "Cloudflare Workers KV",
    maxPhotoCompositesTargetPerDay: 100,
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
