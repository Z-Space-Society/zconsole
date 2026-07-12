export function Footer() {
  return (
    <div className="mt-4 mb-4 pb-4 text-center text-sm" style={{ color: 'var(--ink-3)' }}>
      This is an {' '}
      <a
        href="https://github.com/Z-Space-Society/zconsole-events-mini-app"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{ color: 'var(--accent)' }}
      >
        open source
      </a>
      {' '}project.
    </div>
  )
}
