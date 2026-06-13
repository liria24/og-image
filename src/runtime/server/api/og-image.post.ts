import { defineEventHandler } from '#imports'

import { issueOgImage } from '../utils/ogImage'

export default defineEventHandler((event) => issueOgImage(event))
