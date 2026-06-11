import * as v from 'valibot'

export const ogImageDescriptorBaseSchema = v.object({
    slug: v.string(),
    version: v.string(),
    props: v.optional(v.unknown()),
})

export type OgImageDescriptor = v.InferOutput<typeof ogImageDescriptorBaseSchema>

export const objectSchemaWithSecret = <const T extends v.ObjectEntries & { secret?: never } = {}>(
    value?: T,
) => {
    const secret = v.pipe(
        v.string(),
        v.check((s) => import.meta.dev || s === (process.env.OG_IMAGE_SECRET ?? '')),
    )
    return v.object({ ...(value ?? {}), secret } as Omit<T, 'secret'> & { secret: typeof secret })
}
