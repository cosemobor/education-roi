import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 text-center">
      <h1 className="text-6xl font-bold text-text-primary">404</h1>
      <p className="mt-4 text-lg text-text-secondary">Page not found</p>
      <p className="mt-2 text-sm text-text-secondary">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
      >
        Back to Explorer
      </Link>
    </main>
  );
}
