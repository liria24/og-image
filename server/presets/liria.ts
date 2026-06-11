import * as v from 'valibot'

export default definePreset({
    props: v.object({
        title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
        description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(240))),
    }),
    fonts: [
        {
            family: 'Geist',
            options: { weight: '100..900' },
        },
        {
            family: 'Noto Sans JP',
            options: { weight: '100..900' },
        },
    ],
    svgs: (images) => [
        {
            src: images.liria,
            color: '#ffffff',
            width: 80,
            height: 80,
        },
    ],
    texts: ({ title, description }) => ({
        title,
        description,
        brand: 'Liria',
    }),
    content: (texts, { svgs }) => ({
        type: 'container',
        style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: texts.title ? 'column' : 'row',
            justifyContent: texts.title ? 'space-between' : 'center',
            alignItems: texts.title ? 'stretch' : 'center',
            padding: '72px',
            backgroundColor: '#000000',
            color: '#ffffff',
            fontFamily: 'Geist, Noto Sans JP',
        },
        children: texts.title
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
                              text: texts.title,
                              style: {
                                  fontSize: '68px',
                                  fontWeight: 800,
                                  lineHeight: 1.12,
                                  letterSpacing: '0px',
                                  maxWidth: '960px',
                              },
                          },
                          ...(texts.description
                              ? [
                                    {
                                        type: 'text' as const,
                                        text: texts.description,
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
                      children: [svgs.liria],
                  },
              ]
            : [
                  svgs.liria,
                  {
                      type: 'text',
                      text: texts.brand,
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
