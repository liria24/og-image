import { createHash } from 'node:crypto'

import { Renderer } from '@takumi-rs/wasm'
import type {
    ImageNode,
    ImageSource,
    ConstructRendererOptions,
    Node,
    RenderOptions,
} from 'takumi-js/wasm'
import type { GenericSchema, InferOutput } from 'valibot'

import { images as importImages } from '#images'

type PresetRenderOptions = Omit<RenderOptions, 'width' | 'height' | 'format' | 'devicePixelRatio'>
type PresetPropsSchema = GenericSchema
type TextValue = string | null | undefined | false
type Texts = Record<string, TextValue>
export type UnicodeRange = readonly [start: number, end: number]
type SvgImageKey<T> = T extends { src: infer TSrc extends string } ? TSrc : string
type SvgImageNodes<TSvgs extends readonly DefinePresetSvgImageOptions[]> = {
    readonly [TSvg in TSvgs[number] as SvgImageKey<TSvg['src']>]: ImageNode
}

export interface GoogleFontConfig {
    family: string
    options?: Omit<import('takumi-js/helpers').GoogleFontOptions, 'text'>
    unicodeRanges?: readonly UnicodeRange[]
}

interface SvgImageAsset {
    src: string
    svg: string
}

interface DefinePresetSvgImageOptions {
    src: SvgImageAsset
    color: string
    width: number
    height: number
    id?: string
}

interface PresetContentContext<TSvgs extends readonly DefinePresetSvgImageOptions[]> {
    svgs: SvgImageNodes<TSvgs>
}

interface DefinePresetOptions<
    TPropsSchema extends PresetPropsSchema,
    TTexts extends Texts,
    TSvgs extends readonly DefinePresetSvgImageOptions[],
> {
    props: TPropsSchema
    fonts: readonly GoogleFontConfig[]
    texts: (props: InferOutput<TPropsSchema>) => TTexts
    content: (texts: TTexts, context: PresetContentContext<TSvgs>) => Node
    svgs?: (images: typeof importImages) => TSvgs
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
    texts: (props: unknown) => Texts
    fontText: (props: unknown) => string
    getRenderer: () => Renderer
    renderOptions: PresetRenderConfig
    content: (props: unknown) => Node
}

type DefinedOgImagePreset<
    TPropsSchema extends PresetPropsSchema,
    TTexts extends Texts,
    _TSvgs extends readonly DefinePresetSvgImageOptions[],
> = Omit<OgImagePreset, 'slug' | 'props' | 'texts' | 'fontText' | 'content'> & {
    props: TPropsSchema
    texts: (props: InferOutput<TPropsSchema>) => TTexts
    fontText: (props: InferOutput<TPropsSchema>) => string
    content: (props: InferOutput<TPropsSchema>) => Node
}

const JAPANESE_UNICODE_RANGES = [
    [0x3000, 0x303f],
    [0x3040, 0x309f],
    [0x30a0, 0x30ff],
    [0x4e00, 0x9fff],
] as const satisfies readonly UnicodeRange[]

const DEFAULT_GOOGLE_FONT_UNICODE_RANGES = new Map<string, readonly UnicodeRange[]>([
    ['Noto Sans JP', JAPANESE_UNICODE_RANGES],
])

const normalizeGoogleFontConfig = (font: GoogleFontConfig): GoogleFontConfig => {
    if (font.unicodeRanges !== undefined) return font

    const unicodeRanges = DEFAULT_GOOGLE_FONT_UNICODE_RANGES.get(font.family)
    return unicodeRanges ? { ...font, unicodeRanges } : font
}

const normalizeGoogleFontConfigs = (fonts: readonly GoogleFontConfig[]) =>
    fonts.map((font) => normalizeGoogleFontConfig(font))

const normalizeFontText = (texts: Texts) =>
    Object.values(texts)
        .filter((text): text is string => Boolean(text))
        .join('\n')

const stableValue = (value: unknown): unknown => {
    if (typeof value === 'function') return value.toString()
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map((item) => stableValue(item))

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([, entry]) => entry !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, entry]) => [key, stableValue(entry)]),
    )
}

const createVersion = (options: unknown) =>
    `v-${createHash('sha256')
        .update(JSON.stringify(stableValue(options)))
        .digest('hex')
        .slice(0, 12)}`

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

const defineSvgImage = <const TAsset extends SvgImageAsset>(
    asset: TAsset,
    { color, height, id = asset.src, width }: Omit<DefinePresetSvgImageOptions, 'src'>,
): { key: SvgImageKey<TAsset>; image: ImageSource; node: ImageNode } => ({
    key: asset.src as SvgImageKey<TAsset>,
    image: {
        src: id,
        data: new TextEncoder().encode(withSvgRootColor(asset.svg, color)),
    },
    node: {
        type: 'image',
        src: id,
        width,
        height,
    },
})

export const definePreset = <
    const TPropsSchema extends PresetPropsSchema,
    const TTexts extends Texts,
    const TSvgs extends readonly DefinePresetSvgImageOptions[] = [],
>(
    options: DefinePresetOptions<TPropsSchema, TTexts, TSvgs>,
): DefinedOgImagePreset<TPropsSchema, TTexts, TSvgs> => {
    const {
        texts,
        content,
        fonts: configuredFonts,
        svgs = () => [],
        width = 1200,
        height = 630,
        format = 'png',
        devicePixelRatio = 1,
        persistentImages = [],
        renderOptions,
        ...preset
    } = options

    const fonts = normalizeGoogleFontConfigs(configuredFonts)
    const svgImages = svgs(importImages).map(({ src, ...svg }) => defineSvgImage(src, svg))
    const svgNodes = Object.fromEntries(
        svgImages.map((svg) => [svg.key, svg.node]),
    ) as SvgImageNodes<TSvgs>
    const allPersistentImages = [...persistentImages, ...svgImages.map((svg) => svg.image)]
    let renderer: Renderer | undefined

    return {
        ...preset,
        fonts,
        version: createVersion({ ...options, fonts }),
        texts,
        fontText: (props) => normalizeFontText(texts(props)),
        getRenderer: () => {
            renderer ??= new Renderer({
                loadDefaultFonts: false,
                persistentImages: allPersistentImages,
            })
            return renderer
        },
        renderOptions: {
            width,
            height,
            format,
            devicePixelRatio,
            ...renderOptions,
        },
        content: (props) => content(texts(props), { svgs: svgNodes }),
    }
}

export const withPresetId = <
    const TPropsSchema extends PresetPropsSchema,
    const TTexts extends Texts,
    const TSvgs extends readonly DefinePresetSvgImageOptions[],
>(
    preset: DefinedOgImagePreset<TPropsSchema, TTexts, TSvgs>,
    slug: string,
): OgImagePreset => ({
    ...preset,
    slug,
    texts: preset.texts as (props: unknown) => Texts,
    fontText: preset.fontText as (props: unknown) => string,
    content: preset.content as (props: unknown) => Node,
})
