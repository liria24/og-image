import * as v from 'valibot'

export const ogImageDescriptorBaseSchema = v.object({
    slug: v.string(),
    version: v.string(),
    props: v.optional(v.unknown()),
})

export type OgImageDescriptor = v.InferOutput<typeof ogImageDescriptorBaseSchema>
