import init from '@takumi-rs/wasm'
import wasmModule from '@takumi-rs/wasm/next'
import { definePlugin } from 'nitro'

const takumiReady = (async () => {
    const resolved = await wasmModule
    const module =
        resolved && typeof resolved === 'object' && 'default' in resolved
            ? resolved.default
            : resolved

    await init({ module_or_path: module })
})()

export default definePlugin((nitroApp) => {
    nitroApp.hooks.hook('request', () => takumiReady)
})
