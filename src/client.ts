import { ofetch } from 'ofetch'

type Presets = 'avatio'
interface PresetVersions {
    avatio: 'v1'
}

export interface RequestOgImageOptions<TProps = unknown> {
    /**
     * @default https://og.liria.me
     */
    endpoint?: string
    /**
     * @default process.env.OG_IMAGE_SECRET
     */
    secret?: string
    preset: Presets
    version: PresetVersions[Presets]
    props: TProps
}

export interface IssueImageResponse {
    url: string
}

export const requestOgImage = async ({
    preset,
    version,
    props,
    endpoint = 'https://og.liria.me',
    secret = process.env.OG_IMAGE_SECRET || '',
}: RequestOgImageOptions) =>
    ofetch<IssueImageResponse>(
        `/images/${encodeURIComponent(preset)}/${encodeURIComponent(version)}`,
        {
            baseURL: endpoint,
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: { secret, props },
            retry: 3,
        },
    )
