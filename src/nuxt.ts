import { addImports, addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import type { Preset } from '#presets'

interface RevokeOptions {
    route?: string
    token?: string
}

export interface ModuleOptions {
    preset: Preset
    endpoint?: string
    secret?: string
    route?: string
    revoke?: boolean | RevokeOptions
    revokeToken?: string
}

interface RuntimeOgImageConfig {
    endpoint?: string
    preset?: Preset
    secret?: string
    revokeToken?: string
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

const normalizeRoute = (route: string | undefined) => {
    const value = route?.trim() || defaultRoute
    return value.startsWith('/') ? value : `/${value}`
}

const resolveRevokeRoute = (route: string, revoke: ModuleOptions['revoke']) =>
    typeof revoke === 'object' ? normalizeRoute(revoke.route ?? route) : route

const resolveRevokeToken = (options: ModuleOptions) =>
    typeof options.revoke === 'object'
        ? (options.revoke.token ?? options.revokeToken)
        : options.revokeToken

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: '@liria24/og-image',
        configKey: 'ogImage',
    },
    defaults: {
        route: defaultRoute,
        revoke: false,
    } as Partial<ModuleOptions>,
    setup(options: ModuleOptions, nuxt: Nuxt) {
        if (!options.preset)
            throw new Error('@liria24/og-image/nuxt requires ogImage.preset to be configured.')

        const resolver = createResolver(import.meta.url)
        const route = normalizeRoute(options.route)
        const runtimeConfig = nuxt.options.runtimeConfig as unknown as RuntimeConfig

        runtimeConfig.ogImage = {
            ...runtimeConfig.ogImage,
            endpoint: options.endpoint ?? runtimeConfig.ogImage?.endpoint,
            preset: options.preset,
            secret: options.secret ?? runtimeConfig.ogImage?.secret,
            revokeToken: resolveRevokeToken(options) ?? runtimeConfig.ogImage?.revokeToken,
        }
        runtimeConfig.public.ogImage = {
            ...runtimeConfig.public.ogImage,
            route,
        }

        addImports({
            name: 'useOgImage',
            from: resolver.resolve('./runtime/app/composables/useOgImage'),
        })

        addServerHandler({
            method: 'POST',
            route,
            handler: resolver.resolve('./runtime/server/api/og-image.post'),
        })

        if (options.revoke)
            addServerHandler({
                method: 'DELETE',
                route: resolveRevokeRoute(route, options.revoke),
                handler: resolver.resolve('./runtime/server/api/og-image.delete'),
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
