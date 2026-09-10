/** Where a tree sits on the runtime surface.

    The canvas dimensions in UXML describe the UI Builder artboard, not a
    runtime panel. UI Toolkit mounts the document root at the panel origin,
    so the extracted tree must never be letterboxed against that artboard. */
export function treeFrameOffset(
  _canvas: { width: number; height: number },
  _source: { width: number; height: number },
  _pinOrigin = false,
): { left: number; top: number } {
  return { left: 0, top: 0 }
}
