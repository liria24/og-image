import { consola } from 'consola'
import { defineHandler } from 'nitro'

export default defineHandler((event) => {
    if (import.meta.dev)
        consola
            .withTag(`Request ${new Date().toLocaleTimeString()}`)
            .info(`${event.req.method.toUpperCase()}: ${event.url.pathname}`)
})
