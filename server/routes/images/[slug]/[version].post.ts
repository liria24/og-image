import { defineHandler } from 'nitro'
import { useStorage } from 'nitro/storage'
import * as v from 'valibot'

import { allPresets } from '#presets'

const PNG_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const FAILED_TTL_SECONDS = 60 * 5 // 5 minutes

const request = {
    params: v.object({
        slug: v.union([...allPresets.map((preset) => v.literal(preset.slug))]),
        version: v.string(),
    }),
    body: v.object({
        secret: v.literal(process.env.OG_IMAGE_SECRET ?? ''),
        props: v.object({
            title: v.string(),
            description: v.string(),
        }),
    }),
}

type CanonicalValue =
    | string
    | number
    | boolean
    | null
    | CanonicalValue[]
    | { [key: string]: CanonicalValue }

const canonicalize = (value: unknown): CanonicalValue => {
    if (value === null) return null
    if (Array.isArray(value)) return value.map((item) => canonicalize(item))
    if (typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, entry]) => entry !== undefined)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, entry]) => [key, canonicalize(entry)]),
        )
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value
    return null
}

export default defineHandler(async (event) => {
    const { slug, version } = await validateParams(event, request.params)
    const { props } = await validateBody(event, request.body)

    const preset = getPreset({ slug, version })

    const propsResult = v.safeParse(preset.props, props)
    if (!propsResult.success) throw serverError.badRequest()

    const descriptor: OgImageDescriptor = {
        slug: preset.slug,
        version: preset.version,
        props: propsResult.output,
    }
    const imageId = await sha256Hex(
        JSON.stringify(
            canonicalize({
                slug: descriptor.slug,
                version: descriptor.version,
                props: descriptor.props,
            }),
        ),
    )

    const storage = useStorage('og-image')

    const existingDescriptor = await storage.getItem(`descriptor:${imageId}`)

    if (!existingDescriptor)
        try {
            await storage.setItem(
                `descriptor:${imageId}`,
                JSON.stringify(
                    canonicalize({
                        slug: descriptor.slug,
                        version: descriptor.version,
                        props: descriptor.props,
                    }),
                ),
            )

            const start = Date.now()
            event.waitUntil(
                (async () => {
                    try {
                        const png = await withRenderTimeout(descriptor, renderDescriptor)
                        await storage.setItemRaw(`png:${imageId}`, pngBytes(png), {
                            ttl: PNG_TTL_SECONDS,
                        })
                        console.info('Image rendered', {
                            imageId,
                            preset: descriptor.slug,
                            durationMs: Date.now() - start,
                        })
                    } catch (error: unknown) {
                        console.error('Background render failed', {
                            imageId,
                            preset: descriptor.slug,
                            durationMs: Date.now() - start,
                            error: error instanceof Error ? error.message : String(error),
                        })
                        await storage.setItem(`failed:${imageId}`, '1', { ttl: FAILED_TTL_SECONDS })
                    }
                })(),
            )

            console.info('Image issued', {
                imageId,
                preset: descriptor.slug,
                props: descriptor.props,
            })
        } catch (error: unknown) {
            console.error('Failed to issue image', {
                imageId,
                error: error instanceof Error ? error.message : String(error),
            })
            throw serverError.internalServerError()
        }
    else {
        console.info('Image already exists', {
            imageId,
            preset: descriptor.slug,
        })
    }

    event.res.status = 202
    return {
        url: `https://og.liria.me/images/${imageId}.png`,
    }
})
