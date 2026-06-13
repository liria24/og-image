import { createError, getHeader, getQuery, readBody, useRuntimeConfig } from '#imports'

import { request, revoke } from '../../../client'

interface RuntimeConfig {
    ogImage?: {
        endpoint?: string
        preset?: string
        secret?: string
        token?: string
    }
}

interface OgImageResponse {
    url: string | null
}

interface RevokeOgImagesOptions {
    requireToken: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

const ogImageConfig = () => useRuntimeConfig() as unknown as RuntimeConfig

const stringValue = (value: unknown) => (typeof value === 'string' ? value : undefined)

const tokenFromAuthorizationHeader = (value: string | undefined) => {
    const match = value?.match(/^Bearer\s+(.+)$/i)
    return match?.[1]?.trim()
}

const requestToken = async (event: unknown) => {
    const authorizationToken = tokenFromAuthorizationHeader(
        stringValue(getHeader(event, 'authorization')),
    )
    if (authorizationToken) return authorizationToken

    const headerToken = stringValue(getHeader(event, 'x-og-image-token'))
    if (headerToken) return headerToken

    const queryToken = stringValue(getQuery(event).token)
    if (queryToken) return queryToken

    const body = await readBody(event).catch(() => undefined)
    return isRecord(body) ? stringValue(body.token) : undefined
}

export const issueOgImage = async (event: unknown): Promise<OgImageResponse> => {
    const config = ogImageConfig()
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
}

export const revokeOgImages = async (event: unknown, options: RevokeOgImagesOptions) => {
    const config = ogImageConfig()
    const ogImage = config.ogImage
    const preset = ogImage?.preset as Parameters<typeof revoke>[0]['preset'] | undefined
    if (!preset)
        throw createError({ statusCode: 500, statusMessage: 'OG image preset is not configured.' })

    if (options.requireToken) {
        if (!ogImage?.token)
            throw createError({
                statusCode: 500,
                statusMessage: 'OG image token is not configured.',
            })

        if ((await requestToken(event)) !== ogImage.token)
            throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    return await revoke({
        preset,
        endpoint: ogImage?.endpoint,
        secret: ogImage?.secret,
    })
}
