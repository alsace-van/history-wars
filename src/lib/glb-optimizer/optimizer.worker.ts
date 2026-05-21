// v1.2 (17/05/2026) — Encoder DRACO aussi (gltf-transform veut le re-encoder en sortie)
// v1.1 (17/05/2026) — Support decodage DRACO via draco3dgltf (WASM en /draco/)
// v1.0 (17/05/2026) — Worker decimation GLB : weld + simplify (meshoptimizer) via gltf-transform.
// Lance dans un Web Worker pour ne pas freezer le main thread (1.5M tris = 5-15s de calcul).

import { WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import draco3d from 'draco3dgltf'

interface OptimizeRequest {
  buffer: ArrayBuffer
  targetTris: number
}

interface SuccessResponse {
  type: 'success'
  buffer: ArrayBuffer
  fromTris: number
  toTris: number
  durationMs: number
}

interface ErrorResponse {
  type: 'error'
  message: string
}

type Response = SuccessResponse | ErrorResponse

function countTriangles(doc: ReturnType<WebIO['readBinary']> extends Promise<infer D> ? D : never): number {
  let tris = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      if (idx) {
        tris += idx.getCount() / 3
      } else {
        const pos = prim.getAttribute('POSITION')
        if (pos) tris += pos.getCount() / 3
      }
    }
  }
  return tris
}

// Decodeur + encodeur DRACO partages (init 1x, cache si plusieurs uploads dans la session worker).
// locateFile pointe vers /draco/ qui contient les WASM copies depuis node_modules.
let dracoPairPromise: Promise<{ decoder: unknown; encoder: unknown }> | null = null
function getDracoPair(): Promise<{ decoder: unknown; encoder: unknown }> {
  if (dracoPairPromise) return dracoPairPromise
  dracoPairPromise = Promise.all([
    draco3d.createDecoderModule({
      locateFile: (path: string) => path.endsWith('.wasm') ? '/draco/draco_decoder_gltf.wasm' : path,
    }),
    draco3d.createEncoderModule({
      locateFile: (path: string) => path.endsWith('.wasm') ? '/draco/draco_encoder.wasm' : path,
    }),
  ]).then(([decoder, encoder]) => ({ decoder, encoder }))
  return dracoPairPromise
}

self.onmessage = async (e: MessageEvent<OptimizeRequest>) => {
  const start = performance.now()
  try {
    const { buffer, targetTris } = e.data
    const { decoder, encoder } = await getDracoPair()
    const io = new WebIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'draco3d.decoder': decoder, 'draco3d.encoder': encoder })
    const doc = await io.readBinary(new Uint8Array(buffer))

    const fromTris = countTriangles(doc)
    const ratio = Math.min(1, targetTris / fromTris)

    await MeshoptSimplifier.ready

    // weld d'abord (fusionne vertex bitwise identiques → simplify marche mieux), puis simplify.
    // error: 0.01 = 1% deviation max acceptable. lockBorder: true preserve les bords ouverts (silhouettes).
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: true }),
    )

    const toTris = countTriangles(doc)
    const out = await io.writeBinary(doc)

    const response: SuccessResponse = {
      type: 'success',
      buffer: out.buffer as ArrayBuffer,
      fromTris: Math.round(fromTris),
      toTris: Math.round(toTris),
      durationMs: Math.round(performance.now() - start),
    }
    ;(self as unknown as Worker).postMessage(response, [response.buffer])
  } catch (err) {
    const response: ErrorResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : 'unknown worker error',
    }
    ;(self as unknown as Worker).postMessage(response satisfies Response)
  }
}

export {}
