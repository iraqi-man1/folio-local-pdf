import { createQpdfRunner } from 'qpdf-run'

const asset = (name: string) =>
  new URL(`${import.meta.env.BASE_URL}qpdf/${name}`, window.location.href).href

async function run(input: Uint8Array, args: string[]) {
  const runner = await createQpdfRunner({
    workerUrl: asset('worker.js'),
    qpdfJsUrl: asset('qpdf.js'),
    wasmUrl: asset('qpdf.wasm'),
    timeoutMs: 120_000,
  })
  try {
    // qpdf-run transfers the input ArrayBuffer to its worker. Keep the caller's bytes intact.
    const result = await runner.run({
      inputs: { 'input.pdf': input.slice() },
      args: [...args, 'input.pdf', 'output.pdf'],
      outputs: ['output.pdf'],
    })
    const bytes = result.outputs['output.pdf']
    if (!bytes || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-')
      throw new Error('qpdf produced an invalid PDF header.')
    return { bytes, warnings: result.warnings }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'qpdf failed'
    throw new Error(detail)
  } finally {
    await runner.destroy()
  }
}

export async function repairPdf(input: Uint8Array) {
  return run(input, [])
}

export async function optimizePdf(input: Uint8Array, level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 9)
    throw new Error('Compression level must be from 1 to 9.')
  return run(input, [
    '--stream-data=compress',
    '--recompress-flate',
    '--object-streams=generate',
    `--compression-level=${level}`,
  ])
}

export async function protectPdf(input: Uint8Array, password: string) {
  if (!password) throw new Error('Enter a password.')
  // A distinct random owner password prevents an empty or identical owner credential.
  const owner = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('')
  return run(input, [
    '--encrypt',
    `--user-password=${password}`,
    `--owner-password=${owner}`,
    '--bits=256',
    '--',
  ])
}

export async function unlockPdf(input: Uint8Array, password: string) {
  if (!password) throw new Error('Enter the correct password.')
  try {
    return await run(input, [`--password=${password}`, '--decrypt'])
  } catch {
    throw new Error('Incorrect password or unsupported PDF security.')
  }
}

export async function cleanMetadataPdf(input: Uint8Array) {
  return run(input, ['--remove-info', '--remove-metadata'])
}
