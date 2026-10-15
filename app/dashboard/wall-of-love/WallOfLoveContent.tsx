import { auth } from "@/lib/auth";
import {
  listOwnedWalls,
  listOwnableSpacesWithoutWidget,
} from "@/lib/widgets";
import { WidgetsManager } from "./WidgetsManager";

/**
 * Dynamic inner of `/dashboard/wall-of-love/page.tsx`.
 *
 * Loads:
 *   - `walls`: every owned space with at least one published
 *     wall testimonial (filtered at the DB layer via the
 *     `some` filter on the relation — empty placeholder cards
 *     never render).
 *   - `ownableSpaces`: every owned space WITHOUT a widget yet.
 *     The "+ Create Wall of Love" modal picks from this list.
 *
 * Runs inside a `<Suspense>` boundary owned by the page. The
 * static shell (the "Wall of Love" heading) renders in the
 * initial response; this content streams in once the session +
 * DB reads resolve. The summary line + create button live
 * inside `WidgetsManager` so they're co-located with the
 * dropdown's data.
 *
 * The `WidgetsManager` client island owns the drawer + toast +
 * create-modal state.
 */
export async function WallOfLoveContent() {
  const session = await auth();
  if (!session?.user) return null;

  const [walls, ownableSpaces] = await Promise.all([
    listOwnedWalls(session.user.id),
    listOwnableSpacesWithoutWidget(session.user.id),
  ]);

  return <WidgetsManager spaces={walls} ownableSpaces={ownableSpaces} />;
}
