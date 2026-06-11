import { defineHandler } from 'nitro'
import { useStorage } from 'nitro/storage'
import * as v from 'valibot'

import { allPresets } from '#presets'

const cleanupKeyPrefixes = ['descriptor:', 'png:', 'failed:'] as const
const imageIdPattern = /^[a-f0-9]{64}\.png$/

const request = {
    params: v.object({
        imageId: v.string(),
    }),
    body: objectSchemaWithSecret(),
}

const presetSchema = v.union([...allPresets.map((preset) => v.literal(preset.slug))])

const normalizedImageId = (imageId: string) => imageId.replace(/\.png$/i, '')

const deleteImageIds = async (imageIds: readonly string[]) => {
    const storage = useStorage('og-image')
    const keys = [
        ...new Set(
            imageIds.flatMap((imageId) =>
                cleanupKeyPrefixes.map((prefix) => `${prefix}${imageId}`),
            ),
        ),
    ]
    const existingKeys = (
        await Promise.all(keys.map(async (key) => ((await storage.hasItem(key)) ? key : undefined)))
    ).filter((key): key is string => key !== undefined)

    await Promise.all(existingKeys.map((key) => storage.removeItem(key)))

    return existingKeys.length
}

const parseStoredJson = (value: unknown) => {
    if (typeof value !== 'string') return value

    try {
        return JSON.parse(value)
    } catch {
        return undefined
    }
}

const imageIdsByPreset = async (preset: string) => {
    const storage = useStorage('og-image')
    const descriptorKeys = await storage.getKeys('descriptor:')
    const imageIds = await Promise.all(
        descriptorKeys.map(async (key) => {
            const descriptor = await storage.getItem(key)
            const result = v.safeParse(ogImageDescriptorBaseSchema, parseStoredJson(descriptor))

            return result.success && result.output.slug === preset
                ? key.replace(/^descriptor:/, '')
                : undefined
        }),
    )

    return imageIds.filter((imageId): imageId is string => imageId !== undefined)
}

export default defineHandler(async (event) => {
    await validateBody(event, request.body)
    const { imageId: target } = await validateParams(event, request.params)
    const presetResult = imageIdPattern.test(target) ? undefined : v.safeParse(presetSchema, target)
    if (presetResult && !presetResult.success) throw serverError.badRequest()

    try {
        if (imageIdPattern.test(target)) {
            const imageId = normalizedImageId(target)
            const deleted = await deleteImageIds([imageId])

            console.info('Image cleaned up', { imageId, deleted })

            event.res.headers.set('cache-control', 'no-store')
            return {
                imageId,
                deleted,
            }
        }

        const preset = presetResult!.output
        const imageIds = await imageIdsByPreset(preset)
        const deleted = await deleteImageIds(imageIds)

        console.info('Preset images cleaned up', {
            preset,
            imageIds: imageIds.length,
            deleted,
        })

        event.res.headers.set('cache-control', 'no-store')
        return {
            preset,
            imageIds,
            deleted,
        }
    } catch (error: unknown) {
        console.error('Failed to cleanup image cache', {
            target,
            error: error instanceof Error ? error.message : String(error),
        })
        throw serverError.internalServerError()
    }
})
