declare module '#imports' {
    export const createError: (input: { statusCode: number; statusMessage?: string }) => Error
    export const defineEventHandler: <T>(handler: (event: unknown) => T) => T
    export const readBody: (event: unknown) => Promise<unknown>
    export const useRequestFetch: () => typeof import('ofetch').$fetch
    export const useRuntimeConfig: () => unknown
}
