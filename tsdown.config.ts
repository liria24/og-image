import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

import { presetType, writeGeneratedTypes } from './scripts/generated-types.ts'

writeGeneratedTypes()

export default defineConfig({
    entry: [
        'src/client.ts',
        'src/nuxt.ts',
        'src/runtime/app/composables/useOgImage.ts',
        'src/runtime/server/api/og-image.post.ts',
        'src/runtime/server/api/og-image.delete.ts',
        'src/runtime/server/api/og-image-token.delete.ts',
        'src/runtime/server/utils/ogImage.ts',
    ],
    format: 'esm',
    dts: true,
    clean: true,
    deps: {
        neverBundle: ['#imports'],
    },
    onSuccess: () => {
        for (const path of ['./dist/client.d.mts', './dist/nuxt.d.mts']) {
            const dtsPath = fileURLToPath(new URL(path, import.meta.url))
            const dts = readFileSync(dtsPath, 'utf8')
            writeFileSync(
                dtsPath,
                dts.replace(
                    /import(?: type)? \{ Preset \} from ['"]#presets['"];?/,
                    `type Preset = ${presetType()};`,
                ),
            )
        }
    },
})
