// PDF.js uses Uint8Array#toHex in its Node test worker. Node 24 has not shipped it yet.
if (!Uint8Array.prototype.toHex) {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value() {
      return Buffer.from(this.buffer, this.byteOffset, this.byteLength).toString('hex')
    },
    configurable: true,
  })
}
