export function Footer() {
  return (
    <div className="mt-4 mb-6 px-6 text-center font-mono text-[11px] tracking-wide text-paper-dim">
      This app is an {' '}
      <a
        href="https://github.com/Z-Space-Society/zconsole/tree/main/apps/party-pics"
        target="_blank"
        rel="noopener noreferrer"
        className="text-stamp hover:brightness-110 underline"
      >
        open source
      </a>
      {' '}project.
    </div>
  )
}
