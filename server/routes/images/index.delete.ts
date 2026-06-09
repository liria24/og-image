import { defineHandler } from 'nitro'
import { useStorage } from 'nitro/storage'
import * as v from 'valibot'

const cleanupKeyPrefixes = ['descriptor:', 'png:', 'failed:'] as const

const request = {
    body: v.object({
        secret: v.literal(process.env.OG_IMAGE_SECRET ?? ''),
    }),
}

export default defineHandler(async (event) => {
    await validateBody(event, request.body)

    try {
        const storage = useStorage('og-image')
        const keys = [
            ...new Set(
                (
                    await Promise.all(cleanupKeyPrefixes.map((prefix) => storage.getKeys(prefix)))
                ).flat(),
            ),
        ]

        await Promise.all(keys.map((key) => storage.removeItem(key)))

        console.info('Images cleaned up', { deleted: keys.length })

        event.res.headers.set('cache-control', 'no-store')
        return {
            deleted: keys.length,
        }
    } catch (error: unknown) {
        console.error('Failed to cleanup images', {
            error: error instanceof Error ? error.message : String(error),
        })
        throw serverError.internalServerError()
    }
})
