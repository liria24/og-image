import { defineHandler } from 'nitro'
import { useStorage } from 'nitro/storage'
import * as v from 'valibot'

const cleanupKeyPrefixes = ['descriptor:', 'png:', 'failed:'] as const

const request = {
    params: v.object({
        imageId: v.pipe(
            v.string(),
            v.regex(/^[a-f0-9]{64}\.png$/),
            v.transform((v) => v.replace(/\.png$/i, '')),
        ),
    }),
    body: objectSchemaWithSecret(),
}

export default defineHandler(async (event) => {
    await validateBody(event, request.body)
    const { imageId } = await validateParams(event, request.params)

    try {
        const storage = useStorage('og-image')
        const keys = cleanupKeyPrefixes.map((prefix) => `${prefix}${imageId}`)
        const existingKeys = (
            await Promise.all(
                keys.map(async (key) => ((await storage.hasItem(key)) ? key : undefined)),
            )
        ).filter((key): key is string => key !== undefined)

        await Promise.all(existingKeys.map((key) => storage.removeItem(key)))

        console.info('Image cleaned up', { imageId, deleted: existingKeys.length })

        event.res.headers.set('cache-control', 'no-store')
        return {
            imageId,
            deleted: existingKeys.length,
        }
    } catch (error: unknown) {
        console.error('Failed to cleanup image', {
            imageId,
            error: error instanceof Error ? error.message : String(error),
        })
        throw serverError.internalServerError()
    }
})
