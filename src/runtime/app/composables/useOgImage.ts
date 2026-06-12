import { $fetch } from 'ofetch'

import { useRequestFetch, useRuntimeConfig } from '#imports'

interface OgImageResponse {
    url: string | null
}

interface RuntimeConfig {
    public: {
        ogImage?: {
            route?: string
        }
    }
}

const defaultRoute = '/api/og-image'

export const useOgImage = async <TProps extends Record<string, unknown> = Record<string, unknown>>(
    props: TProps,
): Promise<string | undefined> => {
    const config = useRuntimeConfig() as unknown as RuntimeConfig
    const route = config.public.ogImage?.route || defaultRoute
    const fetcher = import.meta.server ? useRequestFetch() : $fetch

    try {
        const response = await fetcher<OgImageResponse>(route, {
            method: 'POST',
            body: props,
        })

        return response.url ?? undefined
    } catch (error) {
        if (import.meta.server) console.warn('Failed to issue OG image URL', error)
        return undefined
    }
}
