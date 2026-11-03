export async function onRequestGet({ env }) {
  const schoolMode = env.SCHOOL_PROCESSING_APPROVED === "YES";
  const adultMode = !schoolMode && env.ADULT_TESTING_ENABLED === "YES";
  const privacyReady = env.PHOTOROOM_NO_TRAINING_CONFIRMED === "YES";
  const ready = Boolean(env.PHOTOROOM_API_KEY && privacyReady && (schoolMode || adultMode));

  return new Response(JSON.stringify({
    ready,
    mode: schoolMode ? "school" : adultMode ? "adult" : "locked",
    service: "Dau an Ao xanh AI check-in"
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff"
    }
  });
}
