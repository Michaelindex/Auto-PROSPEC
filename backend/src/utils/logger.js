import pino from 'pino'
import { createWriteStream, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { LOG_LEVEL } from '../config/env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logsDir = resolve(__dirname, '../../logs')
mkdirSync(logsDir, { recursive: true })

const today = new Date().toISOString().split('T')[0]
const logFile = resolve(logsDir, `campaign-${today}.log`)

// Stream para arquivo (JSON puro, sem cores)
const fileStream = createWriteStream(logFile, { flags: 'a' })

const logger = pino(
  { level: LOG_LEVEL },
  pino.multistream([
    {
      stream: pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' }
      }),
      level: LOG_LEVEL
    },
    {
      stream: fileStream,
      level: LOG_LEVEL
    }
  ])
)

export { logFile }
export default logger
