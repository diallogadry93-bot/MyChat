import { createServer } from './server.js'

const PORT = parseInt(process.env['PORT'] ?? '3001', 10)
const HOST = process.env['HOST'] ?? '0.0.0.0'

async function main() {
  const server = await createServer()

  try {
    await server.listen({ port: PORT, host: HOST })
    console.info(`🚀 MyChat API running at http://${HOST}:${PORT}`)
    console.info(`📖 Swagger docs at http://${HOST}:${PORT}/docs`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

void main()
