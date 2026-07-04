import { googleFonts, subsetFonts } from 'takumi-js/helpers'
import type { FontLoader, Node } from 'takumi-js/wasm'

import type { GoogleFontConfig } from './definePreset'

const RENDER_TIMEOUT_MS = 15_000 // 15 seconds

type RenderPng = (descriptor: OgImageDescriptor, context?: RenderContext) => Promise<Uint8Array>

export interface RenderContext {
    signal?: AbortSignal
}

const googleFontsCssCache = new Map<string, string>()

const loadGoogleFont = async (config: GoogleFontConfig, signal?: AbortSignal) => {
    const { baseUrl, display, ...familyOptions } = config.options ?? {}

    return googleFonts({
        baseUrl,
        cache: googleFontsCssCache,
        display,
        families: [{ name: config.family, ...familyOptions }],
        signal,
    })
}

export const loadFontsForNode = async (
    fonts: readonly GoogleFontConfig[],
    node: Node,
    signal?: AbortSignal,
): Promise<FontLoader[]> =>
    subsetFonts({
        fonts: (await Promise.all(fonts.map((config) => loadGoogleFont(config, signal)))).flat(),
        source: node,
    })

export const renderDescriptor = async (
    descriptor: OgImageDescriptor,
    context: RenderContext = {},
): Promise<Uint8Array> => {
    if (context.signal?.aborted) throw new Error('Render aborted')

    const preset = getPreset(descriptor)
    if (!preset) throw new Error('Unknown renderer')

    if (context.signal?.aborted) throw new Error('Render aborted')

    const renderer = preset.getRenderer()
    const node = preset.content(descriptor.props)
    const fonts = await loadFontsForNode(preset.fonts, node, context.signal)

    if (context.signal?.aborted) throw new Error('Render aborted')

    return await renderer.render(node, {
        ...preset.renderOptions,
        fonts,
        images: [...preset.images],
    })
}

export const pngBytes = (png: ArrayBuffer | ArrayBufferView) =>
    png instanceof ArrayBuffer
        ? new Uint8Array(png)
        : new Uint8Array(png.buffer, png.byteOffset, png.byteLength)

export const withRenderTimeout = async (
    descriptor: OgImageDescriptor,
    renderPng: RenderPng,
    context: RenderContext = {},
) => {
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
                controller.abort()
                reject(new Error('OG image render timed out'))
            }, RENDER_TIMEOUT_MS)
        })

        return await Promise.race([
            renderPng(descriptor, {
                ...context,
                signal: controller.signal,
            }),
            timeoutPromise,
        ])
    } finally {
        if (timeout) clearTimeout(timeout)
    }
}
