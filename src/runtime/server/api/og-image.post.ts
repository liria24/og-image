import { createError, defineEventHandler, readBody, useRuntimeConfig } from '#imports'

import { request } from '../../../client'

interface RuntimeConfig {
    ogImage?: {
        endpoint?: string
        preset?: string
        secret?: string
    }
}

interface OgImageResponse {
    url: string | null
}

export default defineEventHandler(async (event): Promise<OgImageResponse> => {
    const config = useRuntimeConfig() as unknown as RuntimeConfig
    const preset = config.ogImage?.preset as Parameters<typeof request>[0]['preset'] | undefined
    if (!preset)
        throw createError({ statusCode: 500, statusMessage: 'OG image preset is not configured.' })

    const props = await readBody(event)

    try {
        return await request({
            preset,
            props,
            endpoint: config.ogImage?.endpoint,
            secret: config.ogImage?.secret,
        })
    } catch (error) {
        console.warn('Failed to issue OG image URL', error)
        return { url: null }
    }
})
