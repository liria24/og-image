import { defineHandler } from 'nitro'

export default defineHandler(async () => {
    return 'POST to `/images/[preset]`'
})
