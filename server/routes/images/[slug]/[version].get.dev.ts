import { defineHandler } from 'nitro'
import { getQuery } from 'nitro/h3'
import * as v from 'valibot'

import { allPresets } from '#presets'

const request = {
    params: v.object({
        slug: v.union([...allPresets.map((preset) => v.literal(preset.slug))]),
        version: v.string(),
    }),
    query: v.optional(v.unknown()),
}

export default defineHandler(async (event) => {
    const { slug, version } = await validateParams(event, request.params)

    const preset = getPreset({ slug, version })

    const propsResult = v.safeParse(preset.props, getQuery(event))
    if (!propsResult.success) throw serverError.badRequest()

    const descriptor: OgImageDescriptor = {
        slug: preset.slug,
        version: preset.version,
        props: propsResult.output,
    }

    return await renderDescriptor(descriptor)
})
