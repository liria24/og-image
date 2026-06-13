declare module '#imports' {
    export const createError: (input: { statusCode: number; statusMessage?: string }) => Error
    export const defineEventHandler: <T>(handler: (event: unknown) => T) => T
    export const getHeader: (event: unknown, name: string) => unknown
    export const getQuery: (event: unknown) => Record<string, unknown>
    export const readBody: (event: unknown) => Promise<unknown>
    export const useRequestFetch: () => typeof import('ofetch').$fetch
    export const useRuntimeConfig: () => unknown
}
