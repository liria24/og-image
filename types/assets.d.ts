declare module '*.woff2' {
    const value: ArrayBuffer
    export default value
}

declare module '#fonts/*' {
    interface FontAssetDefinition {
        key: string
        name: string
        path: string
        ranges: readonly (readonly [number, number])[]
    }

    export const fontFamily: string
    export const fonts: readonly FontAssetDefinition[]
}

declare module '#images' {
    interface OgImageAsset<TSrc extends string = string> {
        src: TSrc
        svg: string
    }

    export const images: {
        readonly avatio: OgImageAsset<'avatio'>
    }
}
