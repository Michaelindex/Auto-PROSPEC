import './config/env.js'
import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import logger from './utils/logger.js'
import { PORT } from './config/env.js'
import { connectWhatsApp, setSocketIO as waSetIO } from './services/whatsapp.service.js'
import { setSocketIO as campaignSetIO, runCampaign } from './services/campaign.service.js'
import { setRunCampaignFn } from './services/queue.service.js'
import { startScheduler } from './services/scheduler.service.js'
import prisma from './prisma/client.js'

import whatsappRoutes from './routes/whatsapp.routes.js'
import settingsRoutes from './routes/settings.routes.js'
import contactsRoutes from './routes/contacts.routes.js'
import campaignsRoutes from './routes/campaigns.routes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Ensure directories exist
mkdirSync(resolve(__dirname, '../data/auth'), { recursive: true })
mkdirSync(resolve(__dirname, '../uploads/csv'), { recursive: true })
mkdirSync(resolve(__dirname, '../uploads/images'), { recursive: true })
mkdirSync(resolve(__dirname, '../logs'), { recursive: true })

const app = express()
const httpServer = createServer(app)

const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// Static uploads (images)
app.use('/uploads', express.static(resolve(__dirname, '../uploads')))

// Routes
app.use('/api/whatsapp', whatsappRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/contacts', contactsRoutes)
app.use('/api/campaigns', campaignsRoutes)

// Health check
app.get('/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }))

// Socket.IO
io.on('connection', socket => {
  logger.info({ id: socket.id }, 'Cliente WebSocket conectado')
  socket.on('disconnect', () => logger.info({ id: socket.id }, 'Cliente WebSocket desconectado'))
})

// Wire up socket to services
waSetIO(io)
campaignSetIO(io)
setRunCampaignFn(runCampaign)

// Initialize settings if not exist
async function initSettings() {
  const settings = await prisma.settings.findFirst()
  if (!settings) {
    await prisma.settings.create({ data: {} })
    logger.info('Settings inicializados com valores padrão')
  }
}

// Resume running campaigns after restart (they become paused)
async function resumeInterrupted() {
  await prisma.campaign.updateMany({
    where: { status: { in: ['running', 'pausing'] } },
    data: { status: 'paused' }
  })
}

httpServer.listen(PORT, async () => {
  logger.info(`Servidor rodando na porta ${PORT}`)
  await initSettings()
  await resumeInterrupted()
  startScheduler()
  await connectWhatsApp()
})

export { io }
