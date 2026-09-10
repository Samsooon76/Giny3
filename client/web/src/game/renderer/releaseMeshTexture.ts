import { Texture, type Renderer, type Shader } from 'pixi.js'

/** Pixi 8's non-batched WebGL meshes share the adaptor's default shader.
 * mesh.texture = EMPTY only updates the mesh, not the shader's last binding.
 * Keep this version-specific access here until Pixi exposes a release API.
 */
export function releaseMeshTexture(renderer: Renderer | undefined, texture: Texture): void {
  const pipe = renderer?.renderPipes?.mesh as unknown as {
    _adaptor?: { _shader?: Shader }
  } | undefined
  const resources = pipe?._adaptor?._shader?.resources
  if (resources?.uTexture === texture.source) {
    // Shader resource setters call BindGroup.setResource, removing listeners
    // from the old source before Texture.destroy(true) emits its change event.
    resources.uTexture = Texture.EMPTY.source
    resources.uSampler = Texture.EMPTY.source.style
  }
}
