import * as v from 'valibot'

import { images } from '#images'

const logo = defineSvgImage(images.liria!, {
    src: 'liria-logo',
    color: '#ffffff',
    width: 80,
    height: 80,
})

export default definePreset({
    version: 'v1',
    props: v.object({
        title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
        description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(240))),
    }),
    fonts: [
        { family: 'Geist', options: { weight: '100..900' } },
        { family: 'Noto Sans JP', options: { weight: '100..900' } },
    ],
    persistentImages: [logo.image],
    fontText: ({ title, description }) => [title, description, 'Liria'],
    content: ({ title, description }) => ({
        type: 'container',
        style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: title ? 'column' : 'row',
            justifyContent: title ? 'space-between' : 'center',
            alignItems: title ? 'stretch' : 'center',
            padding: '72px',
            backgroundColor: '#000000',
            color: '#ffffff',
            fontFamily: 'Geist, Noto Sans JP',
        },
        children: title
            ? [
                  {
                      type: 'container',
                      style: {
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '24px',
                      },
                      children: [
                          {
                              type: 'text',
                              text: title,
                              style: {
                                  fontSize: '68px',
                                  fontWeight: 800,
                                  lineHeight: 1.12,
                                  letterSpacing: '0px',
                                  maxWidth: '960px',
                              },
                          },
                          ...(description
                              ? [
                                    {
                                        type: 'text' as const,
                                        text: description,
                                        style: {
                                            fontSize: '34px',
                                            fontWeight: 500,
                                            lineHeight: 1.45,
                                            color: '#71717b',
                                            maxWidth: '900px',
                                        },
                                    },
                                ]
                              : []),
                      ],
                  },
                  {
                      type: 'container',
                      style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                      },
                      children: [logo.node],
                  },
              ]
            : [
                  logo.node,
                  {
                      type: 'text',
                      text: 'Liria',
                      style: {
                          fontSize: '68px',
                          fontWeight: 800,
                          lineHeight: 1.12,
                          letterSpacing: '0px',
                      },
                  },
              ],
    }),
})
