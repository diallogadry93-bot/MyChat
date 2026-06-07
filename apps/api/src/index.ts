import { createServer } from './server.js'

const PORT   = parseInt(process.env['PORT']  ?? '3001', 10)
const HOST   = process.env['HOST'] ?? '0.0.0.0'
const ENV    = process.env['NODE_ENV'] ?? 'development'

async function main() {
  const server = await createServer()

  try {
    await server.listen({ port: PORT, host: HOST })
    console.info(`
╔══════════════════════════════════════╗
║         MyChat API  v0.2.0           ║
╠══════════════════════════════════════╣
║  ENV  : ${ENV.padEnd(28)}║
║  HTTP : http://${HOST}:${PORT}${' '.repeat(20 - String(PORT).length)}║
║  WS   : ws://${HOST}:${PORT}${' '.repeat(22 - String(PORT).length)}║
╚══════════════════════════════════════╝
    `)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

void main()
