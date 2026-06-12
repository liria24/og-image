import { createError, defineEventHandler, readBody, useRuntimeConfig } from '#imports'

import { revoke } from '../../../client'

interface RuntimeConfig {
    ogImage?: {
        endpoint?: string
        preset?: string
        revokeToken?: string
        secret?: string
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig() as unknown as RuntimeConfig
    const preset = config.ogImage?.preset as Parameters<typeof revoke>[0]['preset'] | undefined
    if (!preset)
        throw createError({ statusCode: 500, statusMessage: 'OG image preset is not configured.' })

    const body = await readBody(event).catch(() => undefined)
    const token = isRecord(body) ? body.token : undefined
    if (!config.ogImage?.revokeToken || token !== config.ogImage.revokeToken)
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

    return await revoke({
        preset,
        endpoint: config.ogImage.endpoint,
        secret: config.ogImage.secret,
    })
})
