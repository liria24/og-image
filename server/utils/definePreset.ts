import { createHash } from 'node:crypto'

import { Renderer } from '@takumi-rs/wasm'
import type { GoogleFontFamily, GoogleFontsOptions } from 'takumi-js/helpers'
import type { ImageLoader, ImageNode, Node, RenderOptions } from 'takumi-js/wasm'
import type { GenericSchema, InferOutput } from 'valibot'

import { images as importImages } from '#images'

type PresetRenderOptions = Omit<
    RenderOptions,
    'width' | 'height' | 'format' | 'devicePixelRatio' | 'fonts' | 'images'
>
type PresetPropsSchema = GenericSchema
type TextValue = string | null | undefined | false
type Texts = Record<string, TextValue>
type SvgImageKey<T> = T extends { src: infer TSrc extends string } ? TSrc : string
type SvgImageNodes<TSvgs extends readonly DefinePresetSvgImageOptions[]> = {
    readonly [TSvg in TSvgs[number] as SvgImageKey<TSvg['src']>]: ImageNode
}
type GoogleFontFamilyOptions = Omit<Extract<GoogleFontFamily, { name: string }>, 'name'>
type GoogleFontRequestOptions = Pick<GoogleFontsOptions, 'baseUrl' | 'display'>

export interface GoogleFontConfig {
    family: string
    options?: GoogleFontFamilyOptions & GoogleFontRequestOptions
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
    images?: readonly ImageLoader[]
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
    getRenderer: () => Renderer
    renderOptions: PresetRenderConfig
    images: readonly ImageLoader[]
    content: (props: unknown) => Node
}

type DefinedOgImagePreset<
    TPropsSchema extends PresetPropsSchema,
    TTexts extends Texts,
    _TSvgs extends readonly DefinePresetSvgImageOptions[],
> = Omit<OgImagePreset, 'slug' | 'props' | 'texts' | 'content'> & {
    props: TPropsSchema
    texts: (props: InferOutput<TPropsSchema>) => TTexts
    content: (props: InferOutput<TPropsSchema>) => Node
}

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
): { key: SvgImageKey<TAsset>; image: ImageLoader; node: ImageNode } => ({
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
        images = [],
        renderOptions,
        ...preset
    } = options

    const svgImages = svgs(importImages).map(({ src, ...svg }) => defineSvgImage(src, svg))
    const svgNodes = Object.fromEntries(
        svgImages.map((svg) => [svg.key, svg.node]),
    ) as SvgImageNodes<TSvgs>
    const renderImages = [...images, ...svgImages.map((svg) => svg.image)]
    let renderer: Renderer | undefined

    return {
        ...preset,
        fonts: configuredFonts,
        version: createVersion(options),
        texts,
        getRenderer: () => {
            renderer ??= new Renderer()
            return renderer
        },
        renderOptions: {
            width,
            height,
            format,
            devicePixelRatio,
            ...renderOptions,
        },
        images: renderImages,
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
    content: preset.content as (props: unknown) => Node,
})
