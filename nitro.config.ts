import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'nitro'

import { presetNames, svgAssetNames, writeGeneratedTypes } from './scripts/generated-types.ts'

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
