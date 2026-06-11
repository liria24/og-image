import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

const presetNames = () => {
    const presetsDir = fileURLToPath(new URL('./server/presets', import.meta.url))
    return readdirSync(presetsDir)
        .filter((file) => file.endsWith('.ts'))
        .map((file) => file.replace(/\.ts$/, ''))
        .sort((a, b) => a.localeCompare(b))
}

const presetType = () => presetNames().map((name) => `'${name}'`).join(' | ') || 'never'

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
