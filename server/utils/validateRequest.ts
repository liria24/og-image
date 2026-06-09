import type { H3Event } from 'nitro'
import { getValidatedQuery, getValidatedRouterParams, readValidatedBody } from 'nitro/h3'
import * as v from 'valibot'

const throwIfFailed = <T extends v.GenericSchema>(
    result: v.SafeParseResult<T>,
): v.InferOutput<T> => {
    if (!result.success) {
        if (import.meta.dev) console.error(result.issues)
        throw serverError.badRequest({ responseMessage: 'Validation Error' })
    }
    return result.output
}

export const validateBody = async <const T extends v.GenericSchema>(
    event: H3Event,
    s: T,
): Promise<v.InferOutput<T>> => throwIfFailed(await readValidatedBody(event, v.safeParser(s)))

export const validateParams = async <T extends v.GenericSchema>(
    event: H3Event,
    s: T,
): Promise<v.InferOutput<T>> =>
    throwIfFailed(await getValidatedRouterParams(event, v.safeParser(s)))

export const validateQuery = async <T extends v.GenericSchema>(
    event: H3Event,
    s: T,
): Promise<v.InferOutput<T>> => throwIfFailed(await getValidatedQuery(event, v.safeParser(s)))
