import { googleFont } from 'takumi-js/helpers'
import * as v from 'valibot'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { definePreset } from './definePreset'
import { loadFontsForText } from './render'

vi.mock('takumi-js/helpers', () => ({
    googleFont: vi.fn(async (family: string, options: { text: string }) => [
        {
            name: family,
            data: new Uint8Array(),
            text: options.text,
        },
    ]),
}))

const preset = definePreset({
    props: v.object({}),
    fonts: [
        {
            family: 'Geist',
            options: { weight: '100..900' },
        },
        {
            family: 'Noto Sans JP',
            options: { weight: '100..900' },
        },
    ],
    texts: () => ({}),
    content: () => ({
        type: 'container',
    }),
})

const createRenderer = () => ({
    loadFont: vi.fn(async () => undefined),
})

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

describe('loadFontsForText', () => {
    it.each([
        [
            'without unicode-range descriptors',
            `@font-face {
                font-family: 'Geist';
                font-style: normal;
                font-weight: 100 900;
                src: url(https://fonts.gstatic.com/s/geist/font.woff2) format('woff2');
            }`,
        ],
        [
            'with latin-only unicode-range descriptors',
            `@font-face {
                font-family: 'Geist';
                font-style: normal;
                font-weight: 100 900;
                src: url(https://fonts.gstatic.com/s/geist/font.woff2) format('woff2');
                unicode-range: U+0000-00FF;
            }`,
        ],
    ])(
        'assigns Japanese characters to Noto Sans JP when Google Fonts CSS returns %s',
        async (_caseName, geistCss) => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => new Response(geistCss, { status: 200 })),
            )
            const renderer = createRenderer()

            await loadFontsForText(
                renderer as unknown as Parameters<typeof loadFontsForText>[0],
                preset.fonts,
                'A日本語アあ、。',
            )

            expect(googleFont).toHaveBeenCalledTimes(2)
            expect(googleFont).toHaveBeenNthCalledWith(1, 'Geist', {
                weight: '100..900',
                text: 'A',
            })
            expect(googleFont).toHaveBeenNthCalledWith(2, 'Noto Sans JP', {
                weight: '100..900',
                text: '日本語アあ、。',
            })
            expect(renderer.loadFont).toHaveBeenCalledTimes(2)
        },
    )
})
