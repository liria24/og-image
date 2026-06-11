import init, { Renderer } from '@takumi-rs/wasm'
import wasmModule from '@takumi-rs/wasm/next'
import { googleFont } from 'takumi-js/helpers'
import type { GoogleFontOptions } from 'takumi-js/helpers'

const RENDER_TIMEOUT_MS = 15_000 // 15 seconds
const GOOGLE_FONTS_CSS_URL = 'https://fonts.googleapis.com/css2'
const GOOGLE_FONTS_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const resolved = await wasmModule
const module =
    resolved && typeof resolved === 'object' && 'default' in resolved ? resolved.default : resolved
await init({ module_or_path: module })

type RenderPng = (descriptor: OgImageDescriptor, context?: RenderContext) => Promise<Uint8Array>
type FontOptions = Omit<GoogleFontOptions, 'text'>
type UnicodeRange = readonly [start: number, end: number]

export interface RenderContext {
    signal?: AbortSignal
}

const buildGoogleFontsUrl = (
    family: string,
    { display, style = 'normal', weight = 400 }: FontOptions = {},
) => {
    const weights = (Array.isArray(weight) ? [...weight].sort((a, b) => a - b) : [weight]).map(
        String,
    )
    const styles = Array.isArray(style) ? style : [style]
    const axes = styles.includes('italic')
        ? `ital,wght@${(styles.includes('normal') ? [0, 1] : [1])
              .flatMap((italic) => weights.map((fontWeight) => `${italic},${fontWeight}`))
              .sort()
              .join(';')}`
        : `wght@${weights.join(';')}`
    let url = `${GOOGLE_FONTS_CSS_URL}?family=${encodeURIComponent(family)}:${axes}`
    if (display) url += `&display=${display}`

    return url
}

const parseUnicodeRanges = (css: string): UnicodeRange[] => {
    const ranges: UnicodeRange[] = []

    for (const match of css.matchAll(/unicode-range:\s*([^;]+);/gi)) {
        const value = match[1]
        if (!value) continue

        for (const range of value.split(',')) {
            const normalized = range.trim().toUpperCase()
            const parts = normalized.match(/^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/)
            if (!parts?.[1]) continue

            const startText = parts[1].replace(/\?/g, '0')
            const endText = parts[2] ?? parts[1].replace(/\?/g, 'F')
            const start = Number.parseInt(startText, 16)
            const end = Number.parseInt(endText, 16)

            if (Number.isFinite(start) && Number.isFinite(end)) ranges.push([start, end])
        }
    }

    return ranges
}

const getGoogleFontRanges = async (
    family: string,
    options: FontOptions | undefined,
    signal?: AbortSignal,
) => {
    const response = await fetch(buildGoogleFontsUrl(family, options), {
        headers: { 'User-Agent': GOOGLE_FONTS_USER_AGENT },
        signal,
    })
    if (!response.ok)
        throw new Error(`HTTP ${response.status} ${response.statusText} fetching Google Font CSS`)

    return parseUnicodeRanges(await response.text())
}

const isCodePointInRanges = (codePoint: number, ranges: readonly UnicodeRange[]) =>
    ranges.some(([start, end]) => start <= codePoint && codePoint <= end)

const isCharacterSupported = (character: string, ranges: readonly UnicodeRange[]) =>
    ranges.length === 0 ||
    Array.from(character).every((part) => {
        const codePoint = part.codePointAt(0)
        return codePoint !== undefined && isCodePointInRanges(codePoint, ranges)
    })

const getUniqueFontCharacters = (text: string) =>
    Array.from(new Set(Array.from(text).filter((character) => character.trim())))

const loadGoogleFont = async (
    renderer: Renderer,
    config: GoogleFontConfig,
    text: string,
    signal?: AbortSignal,
) => {
    const descriptors = await googleFont(config.family, {
        ...config.options,
        text,
    })

    for (const descriptor of descriptors) await renderer.loadFont(descriptor, signal)
}

const loadFontsForText = async (
    renderer: Renderer,
    fonts: readonly GoogleFontConfig[],
    text: string,
    signal?: AbortSignal,
) => {
    const characters = getUniqueFontCharacters(text)
    const ranges = new Map<GoogleFontConfig, readonly UnicodeRange[]>()
    const textByFont = new Map<GoogleFontConfig, string[]>()
    const unsupportedCharacters: string[] = []

    for (const character of characters) {
        const font = fonts.find((config) => {
            const fontRanges = ranges.get(config)
            return fontRanges && isCharacterSupported(character, fontRanges)
        })

        if (font) {
            textByFont.set(font, [...(textByFont.get(font) ?? []), character])
            continue
        }

        let matchedFont: GoogleFontConfig | undefined

        for (const config of fonts) {
            let fontRanges = ranges.get(config)
            if (!fontRanges) {
                fontRanges = await getGoogleFontRanges(config.family, config.options, signal)
                ranges.set(config, fontRanges)
            }

            if (isCharacterSupported(character, fontRanges)) {
                matchedFont = config
                break
            }
        }

        if (!matchedFont) {
            unsupportedCharacters.push(character)
            continue
        }

        textByFont.set(matchedFont, [...(textByFont.get(matchedFont) ?? []), character])
    }

    if (unsupportedCharacters.length > 0)
        throw new Error(`No configured font supports: ${unsupportedCharacters.join('')}`)

    for (const config of fonts) {
        const fontText = textByFont.get(config)?.join('')
        if (fontText) await loadGoogleFont(renderer, config, fontText, signal)
    }
}

export const renderDescriptor = async (
    descriptor: OgImageDescriptor,
    context: RenderContext = {},
): Promise<Uint8Array> => {
    if (context.signal?.aborted) throw new Error('Render aborted')

    const preset = getPreset(descriptor)
    if (!preset) throw new Error('Unknown renderer')

    if (context.signal?.aborted) throw new Error('Render aborted')

    const renderer = new Renderer({
        loadDefaultFonts: false,
        persistentImages: preset.persistentImages,
    })
    try {
        await loadFontsForText(
            renderer,
            preset.fonts,
            preset.fontText(descriptor.props),
            context.signal,
        )
        return renderer.render(preset.content(descriptor.props), preset.renderOptions)
    } finally {
        renderer.free()
    }
}

export const pngBytes = (png: ArrayBuffer | ArrayBufferView) =>
    png instanceof ArrayBuffer
        ? new Uint8Array(png)
        : new Uint8Array(png.buffer, png.byteOffset, png.byteLength)

export const withRenderTimeout = async (
    descriptor: OgImageDescriptor,
    renderPng: RenderPng,
    context: RenderContext = {},
) => {
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
                controller.abort()
                reject(new Error('OG image render timed out'))
            }, RENDER_TIMEOUT_MS)
        })

        return await Promise.race([
            renderPng(descriptor, {
                ...context,
                signal: controller.signal,
            }),
            timeoutPromise,
        ])
    } finally {
        if (timeout) clearTimeout(timeout)
    }
}
