import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

import { presetType, writeGeneratedTypes } from './scripts/generated-types.ts'

writeGeneratedTypes()

export default defineConfig({
    entry: ['src/client.ts'],
    format: 'esm',
    dts: true,
    clean: true,
    onSuccess: () => {
        const dtsPath = fileURLToPath(new URL('./dist/client.d.mts', import.meta.url))
        const dts = readFileSync(dtsPath, 'utf8')
        writeFileSync(
            dtsPath,
            dts.replace(
                /import(?: type)? \{ Preset \} from ['"]#presets['"];?/,
                `type Preset = ${presetType()};`,
            ),
        )
    },
})
