import { googleFont } from 'takumi-js/helpers'

const RENDER_TIMEOUT_MS = 15_000 // 15 seconds

type RenderPng = (descriptor: OgImageDescriptor, context?: RenderContext) => Promise<Uint8Array>

export interface RenderContext {
    signal?: AbortSignal
}

export const renderDescriptor = async (
    descriptor: OgImageDescriptor,
    context: RenderContext = {},
): Promise<Uint8Array> => {
    if (context.signal?.aborted) throw new Error('Render aborted')

    const preset = getPreset(descriptor)
    if (!preset) throw new Error('Unknown renderer')

    if (context.signal?.aborted) throw new Error('Render aborted')

    const renderer = preset.getRenderer()
    const descriptors = (
        await Promise.all(
            preset.fonts.map((config) =>
                googleFont(config.family, {
                    ...config.options,
                    text: preset.fontText(descriptor.props),
                }),
            ),
        )
    ).flat()

    await renderer.loadFonts(descriptors, context.signal)
    return renderer.render(preset.content(descriptor.props), preset.renderOptions)
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
