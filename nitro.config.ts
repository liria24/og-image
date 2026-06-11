import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'nitro'

const svgAssetNames = () => {
    const assetsDir = fileURLToPath(new URL('./server/assets', import.meta.url))
    return readdirSync(assetsDir)
        .filter((file) => file.endsWith('.svg'))
        .map((file) => file.replace(/\.svg$/, ''))
        .sort((a, b) => a.localeCompare(b))
}

const presetNames = () => {
    const presetsDir = fileURLToPath(new URL('./server/presets', import.meta.url))
    return readdirSync(presetsDir)
        .filter((file) => file.endsWith('.ts'))
        .map((file) => file.replace(/\.ts$/, ''))
        .sort((a, b) => a.localeCompare(b))
}

const writeGeneratedTypes = () => {
    const imageEntries = svgAssetNames()
        .map((name) => `        readonly ${name}: OgImageAsset<'${name}'>`)
        .join('\n')

    writeFileSync(
        fileURLToPath(new URL('./types/assets.d.ts', import.meta.url)),
        `declare module '*.woff2' {
    const value: ArrayBuffer
    export default value
}

declare module '#fonts/*' {
    interface FontAssetDefinition {
        key: string
        name: string
        path: string
        ranges: readonly (readonly [number, number])[]
    }

    export const fontFamily: string
    export const fonts: readonly FontAssetDefinition[]
}

declare module '#images' {
    interface OgImageAsset<TSrc extends string = string> {
        src: TSrc
        svg: string
    }

    export const images: {
${imageEntries}
    }
}
`,
    )

    const presets = presetNames().map((name) => `'${name}'`).join(' | ') || 'never'

    writeFileSync(
        fileURLToPath(new URL('./types/presets.d.ts', import.meta.url)),
        `declare module '#presets' {
    export type Preset = ${presets}
    export const allPresets: import('../server/utils/definePreset').OgImagePreset[]
}
`,
    )
}

writeGeneratedTypes()

export default defineConfig({
    compatibilityDate: '2026-06-03',

    preset: 'cloudflare_module',

    devServer: {
        port: 4000,
    },

    serverDir: true,

    typescript: {
        generateRuntimeConfigTypes: true,
        generateTsConfig: true,
        tsConfig: {
            compilerOptions: {
                baseUrl: null,
                noEmit: true,
            },
        },
    },

    noExternals: ['takumi-js', '@takumi-rs/wasm', '@takumi-rs/helpers'],

    cloudflare: {
        deployConfig: true,
        nodeCompat: true,
        wrangler: {
            name: 'og-image',
            observability: {
                enabled: true,
                head_sampling_rate: 1,
            },
            kv_namespaces: [
                {
                    binding: 'OG_IMAGE_CACHE',
                    id: 'e678f8e834784ea8b457786c695ded19',
                },
            ],
        },
    },

    storage: {
        'og-image': {
            driver: 'cloudflare-kv-binding',
            binding: 'OG_IMAGE_CACHE',
        },
    },
    devStorage: {
        'og-image': {
            driver: 'fs-lite',
            base: './.data/dev-storage/og-image',
        },
    },

    imports: {
        dirs: ['./server/utils'],
    },

    alias: {
        '@src': fileURLToPath(new URL('./src', import.meta.url)),
    },

    virtual: {
        '#images': () => {
            const assetsDir = fileURLToPath(new URL('./server/assets', import.meta.url))
            const entries = svgAssetNames().map((key) => {
                const svgPath = fileURLToPath(
                    new URL(`./server/assets/${key}.svg`, import.meta.url),
                )
                const svg = readFileSync(svgPath, 'utf8')
                return [
                    JSON.stringify(key),
                    `{ src: ${JSON.stringify(key)}, svg: ${JSON.stringify(svg)} }`,
                ].join(': ')
            })
            return `export const images = { ${entries.join(', ')} }`
        },
        '#presets': () => {
            const names = presetNames()
            const imports = names
                .map((name, i) =>
                    [
                        `import _preset${i} from '${fileURLToPath(new URL(`./server/presets/${name}.ts`, import.meta.url)).replace(/\\/g, '/')}'`,
                    ].join('\n'),
                )
                .join('\n')
            const helper = `import { withPresetId as _withPresetId } from '${fileURLToPath(new URL('./server/utils/definePreset.ts', import.meta.url)).replace(/\\/g, '/')}'`
            const exports = `export const allPresets = [${names.map((name, i) => `_withPresetId(_preset${i}, ${JSON.stringify(name)})`).join(', ')}]`
            return [helper, imports, exports].join('\n')
        },
    },
})
