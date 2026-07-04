import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectUrl = new URL('../', import.meta.url)
const DEFAULT_HOST = 'http://localhost'
const DEFAULT_PORT = '4000'
const DEFAULT_TITLE = 'Takumi v2 RC'
const DEFAULT_DESCRIPTION = 'direct route check'
const DEFAULT_SERVER_TIMEOUT_MS = 30_000
const EXPECTED_WIDTH = 1200
const EXPECTED_HEIGHT = 630
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

interface CliOptions {
    preset: string
    host: string
    port: string
    title: string
    description: string
    output: string
    open: boolean
    serverTimeoutMs: number
}

const presetNames = () =>
    readdirSync(fileURLToPath(new URL('./server/presets', projectUrl)))
        .filter((file) => file.endsWith('.ts'))
        .map((file) => file.slice(0, -'.ts'.length))
        .sort((a, b) => a.localeCompare(b))

const availablePresetsText = () =>
    presetNames()
        .map((preset) => `  - ${preset}`)
        .join('\n')

const usage = () => `Usage:
  bun run verify <preset> [--title <text>] [--description <text>] [--open]

Examples:
  bun run verify avatio --title "Takumi v2 RC" --description "direct route check"
  bun run verify avatio --title "Takumi v2 RC" --description "direct route check" --open

Available presets:
${availablePresetsText()}

Options:
  --host <url>                Default: ${DEFAULT_HOST}
  --port <port>               Default: ${DEFAULT_PORT}
  --output <path>             Default: .tmp/og-images/<preset>.png
  --server-timeout-ms <ms>    Default: ${DEFAULT_SERVER_TIMEOUT_MS}
  --open                      Open the saved PNG with the OS default app
`

const takeValue = (args: string[], index: number, name: string) => {
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for ${name}`)
    }
    return value
}

const parseArgs = (args: string[]): CliOptions => {
    const options: Partial<CliOptions> = {
        host: DEFAULT_HOST,
        port: DEFAULT_PORT,
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        open: false,
        serverTimeoutMs: DEFAULT_SERVER_TIMEOUT_MS,
    }

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i]
        if (!arg) continue

        if (arg === '--help' || arg === '-h') {
            console.info(usage())
            process.exit(0)
        }

        if (!arg.startsWith('--')) {
            if (options.preset) throw new Error(`Unexpected positional argument: ${arg}`)
            options.preset = arg
            continue
        }

        const [rawName, inlineValue] = arg.split('=', 2)
        const name = rawName ?? ''
        if (name === '--open') {
            options.open = true
            continue
        }

        const value = inlineValue ?? takeValue(args, i, name)
        if (inlineValue === undefined) i += 1

        switch (name) {
            case '--host':
                options.host = value
                break
            case '--port':
                options.port = value
                break
            case '--title':
                options.title = value
                break
            case '--description':
                options.description = value
                break
            case '--output':
                options.output = value
                break
            case '--server-timeout-ms':
                options.serverTimeoutMs = Number(value)
                if (!Number.isFinite(options.serverTimeoutMs) || options.serverTimeoutMs <= 0) {
                    throw new Error(`Invalid value for ${name}: ${value}`)
                }
                break
            default:
                throw new Error(`Unknown option: ${name}`)
        }
    }

    if (!options.preset)
        throw new Error(`Preset is required\n\nAvailable presets:\n${availablePresetsText()}`)

    const presets = presetNames()
    if (!presets.includes(options.preset)) {
        throw new Error(
            `Unknown preset: ${options.preset}\n\nAvailable presets:\n${availablePresetsText()}`,
        )
    }

    return {
        ...options,
        output: options.output ?? `.tmp/og-images/${options.preset}.png`,
    } as CliOptions
}

const directRouteUrl = ({ description, host, port, preset, title }: CliOptions) => {
    const base = `${host.replace(/\/$/, '')}:${port}`
    const url = new URL(`/images/${encodeURIComponent(preset)}/direct`, base)
    url.searchParams.set('title', title)
    if (description) url.searchParams.set('description', description)
    return url
}

const healthUrl = ({ host, port }: CliOptions) =>
    new URL('/health', `${host.replace(/\/$/, '')}:${port}`)

const fetchOk = async (url: URL) => {
    try {
        const response = await fetch(url)
        return response.ok
    } catch {
        return false
    }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForServer = async (options: CliOptions, server?: ChildProcess) => {
    const startedAt = Date.now()
    const url = healthUrl(options)

    while (Date.now() - startedAt < options.serverTimeoutMs) {
        if (await fetchOk(url)) return
        if (server && server.exitCode !== null) {
            throw new Error(`Dev server exited early with code ${server.exitCode}`)
        }
        await delay(250)
    }

    throw new Error(`Timed out waiting for dev server at ${url.toString()}`)
}

const startDevServer = (options: CliOptions) => {
    const cwd = fileURLToPath(projectUrl)
    const server = spawn('bun', ['run', 'dev', '--', '--port', options.port], {
        cwd,
        env: {
            ...process.env,
            WRANGLER_WRITE_LOGS: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    })

    server.stdout.on('data', (data) => process.stdout.write(data))
    server.stderr.on('data', (data) => process.stderr.write(data))

    return server
}

const stopDevServer = async (server: ChildProcess) => {
    if (server.exitCode !== null) return

    if (process.platform === 'win32' && server.pid) {
        await new Promise<void>((resolve) => {
            const taskkill = spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], {
                stdio: 'ignore',
                windowsHide: true,
            })
            taskkill.on('close', () => resolve())
            taskkill.on('error', () => resolve())
        })
        return
    }

    server.kill()
}

const readPngSize = (bytes: Uint8Array) => {
    if (bytes.length < 24) throw new Error('Response is too small to be a PNG')

    for (const [index, byte] of PNG_SIGNATURE.entries()) {
        if (bytes[index] !== byte) throw new Error('Response does not start with a PNG signature')
    }

    const chunkType = String.fromCharCode(...bytes.slice(12, 16))
    if (chunkType !== 'IHDR') throw new Error(`Expected PNG IHDR chunk, got ${chunkType}`)

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return {
        width: view.getUint32(16),
        height: view.getUint32(20),
    }
}

const openFile = (path: string) => {
    const command =
        process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
    const args = process.platform === 'win32' ? ['/c', 'start', '', path] : [path]
    const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    })
    child.unref()
}

let devServer: ChildProcess | undefined

try {
    const options = parseArgs(process.argv.slice(2))
    const alreadyRunning = await fetchOk(healthUrl(options))

    if (alreadyRunning) {
        console.info(`Using existing dev server at ${healthUrl(options).origin}`)
    } else {
        console.info(`Starting dev server at ${healthUrl(options).origin}`)
        devServer = startDevServer(options)
        await waitForServer(options, devServer)
    }

    const url = directRouteUrl(options)
    console.info(`Fetching ${url.toString()}`)
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${await response.text()}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    const { height, width } = readPngSize(bytes)
    if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
        throw new Error(
            `Unexpected PNG dimensions: ${width}x${height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
        )
    }

    const outputPath = resolve(options.output)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, bytes)

    console.info(`Verified PNG ${width}x${height}`)
    console.info(`Saved ${outputPath}`)

    if (options.open) {
        openFile(outputPath)
        console.info('Opened saved PNG')
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
} finally {
    if (devServer) await stopDevServer(devServer)
}
