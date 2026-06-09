import type {
    ImageNode,
    ImageSource,
    ConstructRendererOptions,
    Node,
    RenderOptions,
} from 'takumi-js/wasm'
import type { GenericSchema, InferOutput } from 'valibot'

type PresetRenderOptions = Omit<RenderOptions, 'width' | 'height' | 'format' | 'devicePixelRatio'>
type PresetPropsSchema = GenericSchema
type FontTextValue = string | null | undefined | false
type FontText = string | readonly FontTextValue[]

export interface GoogleFontConfig {
    family: string
    options?: Omit<import('takumi-js/helpers').GoogleFontOptions, 'text'>
}

interface DefinePresetOptions<TPropsSchema extends PresetPropsSchema> {
    version: string
    props: TPropsSchema
    fonts: readonly GoogleFontConfig[]
    fontText: (props: InferOutput<TPropsSchema>) => FontText
    content: (props: InferOutput<TPropsSchema>) => Node
    width?: number
    height?: number
    format?: RenderOptions['format']
    devicePixelRatio?: number
    persistentImages?: ConstructRendererOptions['persistentImages']
    renderOptions?: PresetRenderOptions
}

interface PresetRenderConfig {
    width: number
    height: number
    format: RenderOptions['format']
    devicePixelRatio: number
}

export interface OgImagePreset {
    slug: string
    version: string
    props: PresetPropsSchema
    fonts: readonly GoogleFontConfig[]
    fontText: (props: unknown) => string
    persistentImages?: ConstructRendererOptions['persistentImages']
    renderOptions: PresetRenderConfig
    content: (props: unknown) => Node
}

type DefinedOgImagePreset<TPropsSchema extends PresetPropsSchema> = Omit<
    OgImagePreset,
    'slug' | 'props' | 'fontText' | 'content'
> & {
    props: TPropsSchema
    fontText: (props: InferOutput<TPropsSchema>) => string
    content: (props: InferOutput<TPropsSchema>) => Node
}

const normalizeFontText = (value: FontText) =>
    typeof value === 'string'
        ? value
        : value.filter((text): text is string => Boolean(text)).join('\n')

export const definePreset = <const TPropsSchema extends PresetPropsSchema>(
    options: DefinePresetOptions<TPropsSchema>,
): DefinedOgImagePreset<TPropsSchema> => {
    const {
        fontText,
        width = 1200,
        height = 630,
        format = 'png',
        devicePixelRatio = 1,
        renderOptions,
        ...preset
    } = options

    return {
        ...preset,
        fontText: (props) => normalizeFontText(fontText(props)),
        renderOptions: {
            width,
            height,
            format,
            devicePixelRatio,
            ...renderOptions,
        },
    }
}

interface SvgImageAsset {
    src: string
    svg: string
}

interface DefineSvgImageOptions {
    color: string
    width: number
    height: number
    src?: string
}

const setStyleColor = (style: string, color: string) => {
    const normalizedStyle = style.trim().replace(/;+$/, '')
    const nextStyle = normalizedStyle.match(/(^|;)\s*color\s*:/i)
        ? normalizedStyle.replace(/(^|;)\s*color\s*:[^;]*/i, `$1 color: ${color}`)
        : [normalizedStyle, `color: ${color}`].filter(Boolean).join('; ')

    return nextStyle.trim().replace(/;?$/, ';')
}

const escapeAttribute = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const withSvgRootColor = (svg: string, color: string) => {
    let foundSvgRoot = false
    const replaced = svg.replace(/<svg\b([^>]*)>/i, (_tag, attributes: string) => {
        foundSvgRoot = true
        const nextAttributes = attributes.match(/\sstyle=(["'])(.*?)\1/i)
            ? attributes.replace(
                  /\sstyle=(["'])(.*?)\1/i,
                  (_style, quote: string, style: string) =>
                      ` style=${quote}${escapeAttribute(setStyleColor(style, color))}${quote}`,
              )
            : `${attributes} style="color: ${escapeAttribute(color)};"`

        return `<svg${nextAttributes}>`
    })

    if (!foundSvgRoot) throw new Error('SVG root element was not found.')

    return replaced
}

export const defineSvgImage = (
    asset: SvgImageAsset,
    { color, height, src = asset.src, width }: DefineSvgImageOptions,
): { image: ImageSource; node: ImageNode } => ({
    image: {
        src,
        data: new TextEncoder().encode(withSvgRootColor(asset.svg, color)),
    },
    node: {
        type: 'image',
        src,
        width,
        height,
    },
})

export const withPresetId = <const TPropsSchema extends PresetPropsSchema>(
    preset: DefinedOgImagePreset<TPropsSchema>,
    slug: string,
): OgImagePreset => ({
    ...preset,
    slug,
    fontText: preset.fontText as (props: unknown) => string,
    content: preset.content as (props: unknown) => Node,
})
