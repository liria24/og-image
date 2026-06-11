import { ofetch } from 'ofetch'

import type { Preset } from '#presets'

export interface RequestOgImageOptions<TProps = unknown> {
    /**
     * @default https://og.liria.me
     */
    endpoint?: string
    /**
     * @default process.env.OG_IMAGE_SECRET
     */
    secret?: string
    preset: Preset
    props: TProps
}

export interface IssueImageResponse {
    url: string
}

export const requestOgImage = async <TProps = unknown>({
    preset,
    props,
    endpoint = 'https://og.liria.me',
    secret = process.env.OG_IMAGE_SECRET || '',
}: RequestOgImageOptions<TProps>) =>
    ofetch<IssueImageResponse>(`/images/${encodeURIComponent(preset)}`, {
        baseURL: endpoint,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { secret, props },
        retry: 3,
    })
