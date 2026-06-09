import { allPresets } from '#presets'

const presetMap: Record<string, OgImagePreset> = Object.fromEntries(
    allPresets.map((preset) => [preset.slug, preset]),
)

export const getPreset = (descriptor: OgImageDescriptor): OgImagePreset => {
    const preset = presetMap[descriptor.slug]
    if (!preset || preset.version !== descriptor.version) throw new Error('Preset not found')
    return preset
}
