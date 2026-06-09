import { defineHandler } from 'nitro'
import { useStorage } from 'nitro/storage'
import * as v from 'valibot'

const PNG_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const FAILED_TTL_SECONDS = 60 * 5 // 5 minutes
const SUCCESS_CACHE_CONTROL = 'public, max-age=31536000, immutable'

const request = {
    params: v.object({
        imageId: v.pipe(
            v.string(),
            v.regex(/^[a-f0-9]{64}\.png$/),
            v.transform((v) => v.replace(/\.png$/i, '')),
        ),
    }),
}

export default defineHandler(async (event) => {
    const { imageId } = await validateParams(event, request.params)

    const storage = useStorage('og-image')

    try {
        const cachedPng = await storage.getItemRaw<ArrayBuffer>(`png:${imageId}`)
        if (cachedPng) {
            event.res.headers.set('content-type', 'image/png')
            event.res.headers.set('cache-control', SUCCESS_CACHE_CONTROL)
            return Uint8Array.from(pngBytes(cachedPng)).buffer
        }

        const failed = await storage.getItem(`failed:${imageId}`)
        if (failed) throw serverError.notFound()

        const d = await storage.getItem(`descriptor:${imageId}`)
        const parsed = typeof d === 'string' ? JSON.parse(d) : d
        const result = v.safeParse(ogImageDescriptorBaseSchema, parsed)
        if (!result.success) throw serverError.notFound()

        const preset = getPreset(result.output)

        const propsResult = v.safeParse(preset.props, result.output.props)
        if (!propsResult.success) throw serverError.notFound()
        const descriptor = { ...result.output, props: propsResult.output }

        const renderStart = Date.now()
        const png = await withRenderTimeout(descriptor, renderDescriptor)
        await storage.setItemRaw(`png:${imageId}`, pngBytes(png), { ttl: PNG_TTL_SECONDS })

        console.info('Image rendered on demand', {
            imageId,
            preset: descriptor.slug,
            durationMs: Date.now() - renderStart,
        })

        event.res.headers.set('content-type', 'image/png')
        event.res.headers.set('cache-control', SUCCESS_CACHE_CONTROL)
        return Uint8Array.from(pngBytes(png)).buffer
    } catch (error: unknown) {
        console.error('On-demand render failed', {
            imageId,
            error: error instanceof Error ? error.message : String(error),
        })

        await storage.setItem(`failed:${imageId}`, '1', { ttl: FAILED_TTL_SECONDS })

        throw serverError.internalServerError()
    }
})
