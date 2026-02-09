'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-text-primary">Something went wrong</h1>
      <p className="mt-2 text-sm text-text-secondary">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
      >
        Try again
      </button>
      <a
        href="/"
        className="mt-3 block text-sm text-accent hover:underline"
      >
        Return to home
      </a>
    </main>
  );
}
