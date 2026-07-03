import { googleFonts, subsetFonts } from 'takumi-js/helpers'
import type { FontSubset } from 'takumi-js/helpers'
import type { Node, Renderer } from 'takumi-js/wasm'
import * as v from 'valibot'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OgImagePreset } from './definePreset'
import { loadFontsForNode, renderDescriptor } from './render'

const createFontSubset = (family: string): FontSubset => ({
    name: `${family} subset`,
    subsetOf: family,
    key: `${family}:subset`,
    ranges: [],
    data: async () => new ArrayBuffer(0),
})

const expectedFontSubset = (family: string) =>
    expect.objectContaining({
        name: `${family} subset`,
        subsetOf: family,
        key: `${family}:subset`,
        ranges: [],
        data: expect.any(Function),
    })

vi.mock('takumi-js/helpers', () => ({
    googleFonts: vi.fn(async ({ families }: { families: { name: string }[] }) =>
        families.map((family) => createFontSubset(family.name)),
    ),
    subsetFonts: vi.fn(({ fonts }: { fonts: FontSubset[] }) => fonts),
}))

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

describe('loadFontsForNode', () => {
    it('loads configured Google Fonts and subsets them against the rendered node', async () => {
        const node: Node = {
            type: 'container',
            children: [
                {
                    type: 'text',
                    text: 'A日本語',
                },
            ],
        }

        const fonts = [
            {
                family: 'Geist',
                options: { weight: '100..900' },
            },
            {
                family: 'Noto Sans JP',
                options: { weight: '100..900' },
            },
        ] as const

        const result = await loadFontsForNode(fonts, node)

        expect(googleFonts).toHaveBeenCalledTimes(2)
        expect(googleFonts).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                cache: expect.any(Map),
                families: [{ name: 'Geist', weight: '100..900' }],
            }),
        )
        expect(googleFonts).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                cache: expect.any(Map),
                families: [{ name: 'Noto Sans JP', weight: '100..900' }],
            }),
        )
        expect(subsetFonts).toHaveBeenCalledTimes(1)
        expect(subsetFonts).toHaveBeenCalledWith({
            fonts: [expectedFontSubset('Geist'), expectedFontSubset('Noto Sans JP')],
            source: node,
        })
        expect(result).toEqual([expectedFontSubset('Geist'), expectedFontSubset('Noto Sans JP')])
    })
})

describe('renderDescriptor', () => {
    it('passes fonts and images as per-render resources', async () => {
        const node: Node = {
            type: 'container',
        }
        const renderer = {
            render: vi.fn(async () => new Uint8Array([1, 2, 3])),
        }
        const image = {
            src: 'logo',
            data: new Uint8Array([60, 115, 118, 103, 62]),
        }
        const preset: OgImagePreset = {
            slug: 'test',
            version: 'v-test',
            props: v.object({}),
            fonts: [
                {
                    family: 'Geist',
                    options: { weight: '100..900' },
                },
            ],
            texts: () => ({}),
            getRenderer: () => renderer as unknown as Renderer,
            renderOptions: {
                width: 1200,
                height: 630,
                format: 'png',
                devicePixelRatio: 1,
            },
            images: [image],
            content: () => node,
        }

        vi.stubGlobal('getPreset', () => preset)

        const result = await renderDescriptor({
            slug: 'test',
            version: 'v-test',
            props: {},
        })

        expect(result).toEqual(new Uint8Array([1, 2, 3]))
        expect(renderer.render).toHaveBeenCalledWith(node, {
            width: 1200,
            height: 630,
            format: 'png',
            devicePixelRatio: 1,
            fonts: [expectedFontSubset('Geist')],
            images: [image],
        })
    })
})
