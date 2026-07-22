import "server-only";

export function showcaseRuntimeEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.SHOWCASE_MODE_ENABLED === "true";
}

export function disabledShowcaseResponse() {
  return Response.json(
    { error: "Showcase mode is local-only unless SHOWCASE_MODE_ENABLED is set." },
    { status: 404 }
  );
}
