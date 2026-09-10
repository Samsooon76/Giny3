/** Shared overlay for world entry and map transitions. */
export function LoadingScreen({ label = 'Chargement du monde…' }: { label?: string }) {
  return <div className="loading-screen" role="status" aria-label={label} aria-live="polite">
    <img className="loading-emblem" src="/images/loading-emblem.png" alt="" width="200" height="206" draggable={false} />
  </div>
}
