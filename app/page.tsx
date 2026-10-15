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
          <p className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Testimonial SaaS
          </p>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline hover:text-zinc-950 transition-colors duration-150 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get started
            </Link>
          </nav>
        </header>

        <section className="mt-20 flex-1">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-zinc-900 px-6 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
            >
              Create your free account
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
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
      <p className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}
