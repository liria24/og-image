import { ofetch } from 'ofetch'

import type { Preset } from '#presets'

interface ClientOptions {
    /**
     * @default https://og.liria.me
     */
    endpoint?: string
    /**
     * @default process.env.OG_IMAGE_SECRET
     */
    secret?: string
}

export interface RequestOptions<TProps = unknown> extends ClientOptions {
    preset: Preset
    props: TProps
}

export interface IssueImageResponse {
    url: string
}

export interface RevokeByImageIdOptions extends ClientOptions {
    imageId: string
    preset?: never
}

export interface RevokeByPresetOptions extends ClientOptions {
    imageId?: never
    preset: Preset
}

export type RevokeOptions = RevokeByImageIdOptions | RevokeByPresetOptions

export interface RevokeByImageIdResponse {
    imageId: string
    deleted: number
}

export interface RevokeByPresetResponse {
    preset: Preset
    imageIds: string[]
    deleted: number
}

export type RevokeResponse = RevokeByImageIdResponse | RevokeByPresetResponse

const defaultEndpoint = 'https://og.liria.me'

const resolveEndpoint = (endpoint: string | undefined) => endpoint?.trim() || defaultEndpoint

const imageIdPathSegment = (imageId: string) =>
    `${encodeURIComponent(imageId.replace(/\.png$/i, ''))}.png`

export const request = async <TProps = unknown>({
    preset,
    props,
    endpoint,
    secret = process.env.OG_IMAGE_SECRET || '',
}: RequestOptions<TProps>) =>
    ofetch<IssueImageResponse>(`/images/${encodeURIComponent(preset)}`, {
        baseURL: resolveEndpoint(endpoint),
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { secret, props },
        retry: 3,
    })

export const revoke = async (options: RevokeOptions) => {
    const endpoint = resolveEndpoint(options.endpoint)
    const secret = options.secret ?? process.env.OG_IMAGE_SECRET ?? ''
    const path =
        options.imageId !== undefined
            ? `/images/${imageIdPathSegment(options.imageId)}`
            : `/images/${encodeURIComponent(options.preset)}`

    return ofetch<RevokeResponse>(path, {
        baseURL: endpoint,
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: { secret },
        retry: 3,
    })
}
