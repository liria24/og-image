import { defineEventHandler } from '#imports'

import { revokeOgImages } from '../utils/ogImage'

export default defineEventHandler((event) => revokeOgImages(event, { requireToken: true }))
