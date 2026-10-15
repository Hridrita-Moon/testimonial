"use client";

/**
 * Wall of Love manager — client island.
 *
 * Owns:
 *   - the open-drawer state (`openSlug` + `openWidget`) for the
 *     Edit drawer,
 *   - the open-create-modal state (`isCreateOpen`) for the
 *     "+ Create Wall of Love" modal,
 *   - the toast stack (multiple toasts in a FIFO list).
 *
 * The server page renders a serialized list of cards (one per
 * space that has at least one `isWallOfLove` testimonial) plus
 * the list of ownable spaces (owned spaces that don't yet have
 * a widget). The island never re-fetches either list —
 * mutations (`router.refresh()` from the drawer / create modal)
 * push a fresh server-render of the page.
 *
 * The Create modal is only available when at least one ownable
 * space exists. The button is rendered regardless, but is
 * disabled (with a tooltip) when the dropdown would be empty —
 * this avoids the user clicking and seeing a blank modal.
 */

import { useState } from "react";
import Link from "next/link";
import { ToastStack, type ToastItem } from "./Toast";
import { WidgetCard, type WidgetCardSpace } from "./WidgetCard";
import { EditWidgetDrawer, type WidgetConfig } from "./EditWidgetDrawer";
import {
  CreateWidgetModal,
  type CreateWidgetSpaceOption,
} from "./CreateWidgetModal";

export function WidgetsManager({
  spaces,
  ownableSpaces,
}: {
  spaces: WidgetCardSpace[];
  ownableSpaces: CreateWidgetSpaceOption[];
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [openWidget, setOpenWidget] = useState<WidgetConfig | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  function pushToast(message: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message }]);
  }
  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function onEdit(publicSlug: string, widget: WidgetConfig) {
    setOpenSlug(publicSlug);
    setOpenWidget(widget);
  }

  function onCloseDrawer() {
    setOpenSlug(null);
    setOpenWidget(null);
  }

  function onOpenCreate() {
    setIsCreateOpen(true);
  }
  function onCloseCreate() {
    setIsCreateOpen(false);
  }

  const activeSpace = openSlug
    ? spaces.find((s) => s.publicSlug === openSlug)
    : null;
  const canCreate = ownableSpaces.length > 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {spaces.length === 0
            ? "No testimonials on the wall yet."
            : `${spaces.length} ${spaces.length === 1 ? "space" : "spaces"} with live testimonials on the wall.`}
        </p>
        <button
          type="button"
          onClick={onOpenCreate}
          disabled={!canCreate}
          aria-disabled={!canCreate}
          title={
            canCreate
              ? "Create a widget for one of your spaces"
              : "Every owned space already has a widget"
          }
          className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create Wall of Love
        </button>
      </div>

      {spaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Your wall is empty.
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Open the{" "}
            <Link
              href="/dashboard/inbox"
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
            >
              Inbox
            </Link>{" "}
            and tap{" "}
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <span aria-hidden>♥</span> Add to wall
            </span>{" "}
            on any testimonial to feature it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {spaces.map((s) => (
            <WidgetCard
              key={s.id}
              space={s}
              onEdit={onEdit}
              onCopySuccess={pushToast}
              onCopyError={pushToast}
              onDeleteSuccess={pushToast}
              onDeleteError={pushToast}
            />
          ))}
        </div>
      )}

      {openSlug && openWidget && activeSpace ? (
        <EditWidgetDrawer
          publicSlug={openSlug}
          spaceTitle={activeSpace.title}
          widget={openWidget}
          onClose={onCloseDrawer}
          onSaved={pushToast}
          onError={pushToast}
        />
      ) : null}

      {isCreateOpen ? (
        <CreateWidgetModal
          availableSpaces={ownableSpaces}
          onClose={onCloseCreate}
          onCreated={pushToast}
          onError={pushToast}
        />
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
