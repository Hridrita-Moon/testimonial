import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyLinkButton } from "./CopyLinkButton";

/**
 * Dynamic inner of `/dashboard/spaces/<id>/created/page.tsx`.
 *
 * Post-create success screen. The new-space form redirects
 * here after a 201. We show the public URL with a copy button,
 * an "Open page" link, and a "Back to dashboard" link.
 *
 * Runs inside a `<Suspense>` boundary owned by the page.
 */
export async function SpaceCreatedContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;
  const space = await prisma.space.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, title: true, publicSlug: true },
  });
  if (!space) notFound();
  const publicUrl = `/p/${space.publicSlug}`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 shadow-md ring-1 ring-emerald-200/50 dark:border-emerald-800 dark:bg-emerald-950 dark:ring-emerald-800/50">
        <h1 className="text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
          Space created
        </h1>
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
          <span className="font-medium">{space.title}</span> is live. Share
          the link below to start collecting testimonials.
        </p>

        <div className="mt-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 dark:border-emerald-800 dark:bg-zinc-900">
          <code className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
            {publicUrl}
          </code>
          <CopyLinkButton text={publicUrl} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Open public page
          </a>
          <Link
            href={`/dashboard/spaces/${space.id}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
          >
            Edit space
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
