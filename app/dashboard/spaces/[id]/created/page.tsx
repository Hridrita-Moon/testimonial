import { Suspense } from "react";
import { SpaceCreatedContent } from "./SpaceCreatedContent";

/**
 * `/dashboard/spaces/<id>/created` — synchronous server
 * component shell.
 *
 * The actual success card (with the new space's title, public
 * URL, copy button, and action links) lives in
 * `SpaceCreatedContent`, an async server component that runs
 * inside a `<Suspense>` boundary and streams in once the
 * params + session + DB reads resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. Without it, the top-level `await params`
 * parks the page inside an implicit Suspense with no
 * fallback, which Next 16's cacheComponents pipeline drops
 * from its instant-UI cache.
 */

export default function SpaceCreatedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<SpaceCreatedContentFallback />}>
      <SpaceCreatedContent params={params} />
    </Suspense>
  );
}

function SpaceCreatedContentFallback() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="h-64 rounded-2xl border border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-800 dark:bg-emerald-950" />
    </div>
  );
}
