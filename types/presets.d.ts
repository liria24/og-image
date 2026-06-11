declare module '#presets' {
    export type Preset = 'avatio'
    export const allPresets: import('../server/utils/definePreset').OgImagePreset[]
}
