import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { HTTPError } from 'nitro/h3'

interface ServerErrorOptions {
    log?: {
        tag?: string
        message: string
    }
    responseMessage?: string
}

const FAILURE_CACHE_CONTROL = 'no-store'

export const serverError = {
    /** 400 */
    badRequest(options?: ServerErrorOptions): never {
        if (options?.log) console.error(options.log.message)
        throw new HTTPError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
            message: options?.responseMessage,
            headers: {
                'cache-control': FAILURE_CACHE_CONTROL,
            },
        })
    },
    /** 401 */
    unauthorized(options?: ServerErrorOptions): never {
        if (options?.log) console.error(options.log.message)
        throw new HTTPError({
            status: StatusCodes.UNAUTHORIZED,
            statusText: getReasonPhrase(StatusCodes.UNAUTHORIZED),
            message: options?.responseMessage,
            headers: {
                'cache-control': FAILURE_CACHE_CONTROL,
            },
        })
    },
    /** 403 */
    forbidden(options?: ServerErrorOptions): never {
        if (options?.log) console.error(options.log.message)
        throw new HTTPError({
            status: StatusCodes.FORBIDDEN,
            statusText: getReasonPhrase(StatusCodes.FORBIDDEN),
            message: options?.responseMessage,
            headers: {
                'cache-control': FAILURE_CACHE_CONTROL,
            },
        })
    },
    /** 404 */
    notFound(options?: ServerErrorOptions): never {
        if (options?.log) console.error(options.log.message)
        throw new HTTPError({
            status: StatusCodes.NOT_FOUND,
            statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
            message: options?.responseMessage,
            headers: {
                'cache-control': FAILURE_CACHE_CONTROL,
            },
        })
    },
    /** 500 */
    internalServerError(options?: ServerErrorOptions): never {
        if (options?.log) console.error(options.log.message)
        throw new HTTPError({
            status: StatusCodes.INTERNAL_SERVER_ERROR,
            statusText: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
            message: options?.responseMessage,
            headers: {
                'cache-control': FAILURE_CACHE_CONTROL,
            },
        })
    },
}
