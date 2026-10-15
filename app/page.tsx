import Link from "next/link";

/**
 * Root marketing landing (`/`).
 *
 * The previous create-next-app placeholder is gone; this is the
 * real product landing. It is intentionally minimal — two CTAs,
 * three feature blocks, and a footer. The product is a tool, not
 * a story.
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-tight">
            Testimonial SaaS
          </p>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link
              href="/sign-in"
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Get started
            </Link>
          </nav>
        </header>

        <section className="mt-20 flex-1">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Collect testimonials in minutes.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Create a branded space, share its public link, and watch
            testimonials roll into your inbox. Curate the best ones
            into a Wall of Love that you can show off on your site.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Create your free account
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <Feature
              title="Branded spaces"
              body="Each space is its own public page with your title, prompt, and theme."
            />
            <Feature
              title="Smart inbox"
              body="Favorite, hide, edit, and curate testimonials without leaving the dashboard."
            />
            <Feature
              title="Public Wall of Love"
              body="Publish selected testimonials to a public page at /p/<slug>/wall."
            />
          </div>
        </section>

        <footer className="mt-20 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800">
          <p>
            Built for collecting, curating, and publishing customer
            testimonials.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}
