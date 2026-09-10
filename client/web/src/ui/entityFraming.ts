export type PreviewMode = 'fit' | 'hero' | 'portrait' | 'selection'

export function previewSize(mode: PreviewMode, hostWidth: number, hostHeight: number, width: number, height: number) {
  const safeWidth = Math.max(1, width), safeHeight = Math.max(1, height)
  if (mode === 'portrait') {
    const scale = Math.min((hostWidth * 1.1) / safeWidth, (hostHeight * 2.3) / safeHeight)
    // Anchor the top of the look inside the portrait; lower body may be clipped.
    return { scale, baseline: safeHeight * scale + hostHeight * 0.06 }
  }
  const widthRatio = mode === 'hero' ? 0.5 : mode === 'selection' ? 0.55 : 0.78
  const heightRatio = mode === 'hero' ? 0.42 : mode === 'selection' ? 0.59 : 0.8
  return {
    scale: Math.min((hostWidth * widthRatio) / safeWidth, (hostHeight * heightRatio) / safeHeight),
    baseline: hostHeight * (mode === 'hero' ? 0.735 : mode === 'selection' ? 0.92 : 0.9),
  }
}
