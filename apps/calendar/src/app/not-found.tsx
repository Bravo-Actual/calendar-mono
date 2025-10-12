import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground mt-2">Page not found</p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Go Home
      </Link>
    </div>
  );
}
