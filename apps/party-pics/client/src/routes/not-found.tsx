import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <section className="screen flex items-center justify-center min-h-screen px-6 text-center">
      <div>
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="font-display font-bold text-4xl uppercase tracking-wide text-paper mb-2">
          Page not found
        </h1>
        <p className="font-mono text-[11px] tracking-wide text-paper-dim mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block bg-stamp text-ink font-mono font-bold text-[11px] tracking-[.14em] uppercase rounded-full px-6 py-3 hover:brightness-110 shadow-[0_0_16px_rgba(255,146,51,.3)]"
        >
          Go home
        </Link>
      </div>
    </section>
  )
}
