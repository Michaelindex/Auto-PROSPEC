import pino from 'pino'
import { LOG_LEVEL } from '../config/env.js'

const logger = pino({
  level: LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' }
  }
})

export default logger
