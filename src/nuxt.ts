import { addImports, addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import type { Preset } from '#presets'

interface RevokeOptions {
    token?: string
}

interface RouteRevokeOptions {
    requireToken?: boolean
}

interface RoutesOptions {
    revoke?: boolean | RouteRevokeOptions
}

export interface ModuleOptions {
    preset: Preset
    endpoint?: string
    secret?: string
    route?: string
    routes?: RoutesOptions
    token?: string
    /**
     * @deprecated Use routes.revoke and token instead.
     */
    revoke?: boolean | RevokeOptions
    /**
     * @deprecated Use token instead.
     */
    revokeToken?: string
}

interface RuntimeOgImageConfig {
    endpoint?: string
    preset?: Preset
    secret?: string
    token?: string
}

interface PublicRuntimeOgImageConfig {
    route?: string
}

interface RuntimeConfig {
    ogImage?: RuntimeOgImageConfig
    public: {
        ogImage?: PublicRuntimeOgImageConfig
    }
}

const defaultRoute = '/api/og-image'

const normalizeRoute = (route: string) => {
    const value = route.trim() || defaultRoute
    return value.startsWith('/') ? value : `/${value}`
}

const joinRoute = (base: string, path: string) =>
    `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

const resolveRevokeToken = (options: ModuleOptions) =>
    options.token ??
    (typeof options.revoke === 'object' ? options.revoke.token : undefined) ??
    options.revokeToken

const revokeRouteOptions = (options: ModuleOptions): RouteRevokeOptions | undefined => {
    const revoke = options.routes?.revoke
    if (revoke === false) return undefined
    if (revoke === true) return { requireToken: true }
    if (revoke) return { requireToken: revoke.requireToken !== false }
    if (options.revoke) return { requireToken: true }
    return undefined
}

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: '@liria24/og-image',
        configKey: 'ogImage',
    },
    defaults: {
        revoke: false,
    } as Partial<ModuleOptions>,
    setup(options: ModuleOptions, nuxt: Nuxt) {
        if (!options.preset)
            throw new Error('@liria24/og-image/nuxt requires ogImage.preset to be configured.')

        const resolver = createResolver(import.meta.url)
        const moduleManaged = options.route === undefined
        const route = options.route === undefined ? defaultRoute : normalizeRoute(options.route)
        const issueRoute = route
        const revokeRoute = moduleManaged ? route : joinRoute(route, 'revoke')
        const runtimeConfig = nuxt.options.runtimeConfig as unknown as RuntimeConfig
        const revokeRouteConfig = revokeRouteOptions(options)
        const token = resolveRevokeToken(options)

        if (revokeRouteConfig?.requireToken && !token)
            throw new Error(
                '@liria24/og-image/nuxt requires ogImage.token when routes.revoke.requireToken is true.',
            )

        runtimeConfig.ogImage = {
            ...runtimeConfig.ogImage,
            endpoint: options.endpoint ?? runtimeConfig.ogImage?.endpoint,
            preset: options.preset,
            secret: options.secret ?? runtimeConfig.ogImage?.secret,
            token: token ?? runtimeConfig.ogImage?.token,
        }
        runtimeConfig.public.ogImage = {
            ...runtimeConfig.public.ogImage,
            route: issueRoute,
        }

        addImports({
            name: 'useOgImage',
            from: resolver.resolve('./runtime/app/composables/useOgImage'),
        })

        addServerHandler({
            method: 'POST',
            route: issueRoute,
            handler: resolver.resolve('./runtime/server/api/og-image.post'),
        })

        if (revokeRouteConfig)
            addServerHandler({
                method: 'DELETE',
                route: revokeRoute,
                handler: resolver.resolve(
                    revokeRouteConfig.requireToken
                        ? './runtime/server/api/og-image-token.delete'
                        : './runtime/server/api/og-image.delete',
                ),
            })
    },
})

declare module '@nuxt/schema' {
    interface NuxtConfig {
        ogImage?: Partial<ModuleOptions>
    }

    interface NuxtOptions {
        ogImage?: ModuleOptions
    }
}
