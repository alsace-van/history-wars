// v1.0 (17/05/2026) — Wrapper du Web Worker decimation GLB.
// Usage : const r = await optimizeGlbFile(file, 30000)
//         r.blob = GLB optimise pret a uploader

import OptimizerWorker from './optimizer.worker?worker'

export interface OptimizeResult {
  blob: Blob
  fromTris: number
  toTris: number
  durationMs: number
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

type WorkerResponse = SuccessResponse | ErrorResponse

/**
 * Decime le GLB pour atteindre approximativement `targetTris` triangles.
 * Lance dans un Web Worker (non-bloquant pour l'UI).
 */
export async function optimizeGlbFile(file: File | Blob, targetTris: number): Promise<OptimizeResult> {
  const buffer = await file.arrayBuffer()
  return new Promise<OptimizeResult>((resolve, reject) => {
    const w = new OptimizerWorker()
    const cleanup = () => w.terminate()
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const data = e.data
      if (data.type === 'success') {
        resolve({
          blob: new Blob([data.buffer], { type: 'model/gltf-binary' }),
          fromTris: data.fromTris,
          toTris: data.toTris,
          durationMs: data.durationMs,
        })
      } else {
        reject(new Error(data.message))
      }
      cleanup()
    }
    w.onerror = err => {
      cleanup()
      reject(new Error(err.message || 'worker crashed'))
    }
    w.postMessage({ buffer, targetTris }, [buffer])
  })
}
