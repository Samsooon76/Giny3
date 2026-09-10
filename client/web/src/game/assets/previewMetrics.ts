let contexts = 0
let thumbnailBytes = 0
export function trackPreviewContext(delta: number) { contexts = Math.max(0, contexts + delta) }
export function trackThumbnailBytes(bytes: number) { thumbnailBytes = bytes }
export function previewMetrics() { return { contexts, thumbnailBytes } }
