import { Router } from 'express'
import multer from 'multer'
import { mkdirSync, createWriteStream } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import prisma from '../prisma/client.js'
import {
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign
} from '../services/campaign.service.js'
import { runCampaign } from '../services/campaign.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const imageDir = resolve(__dirname, '../../uploads/images')
mkdirSync(imageDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, imageDir),
    filename: (req, file, cb) => cb(null, `${randomUUID()}-${file.originalname}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Apenas imagens JPG/PNG/WEBP'))
  }
})

const router = Router()

// List campaigns
router.get('/', async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { messages: true, contacts: true } } }
  })
  res.json(campaigns)
})

// Create campaign
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body

    const {
      name, flowMode, minDelaySec, maxDelaySec, simulateTyping,
      stopOnReply, scheduledAt, messages, contactIds, imageCaption
    } = body

    if (!name || !flowMode || !messages?.length || !contactIds?.length) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' })
    }
    if (Number(minDelaySec) >= Number(maxDelaySec)) {
      return res.status(400).json({ error: 'minDelaySec deve ser menor que maxDelaySec' })
    }

    const imagePath = req.file ? req.file.path : null

    const campaign = await prisma.campaign.create({
      data: {
        name,
        flowMode,
        minDelaySec: Number(minDelaySec),
        maxDelaySec: Number(maxDelaySec),
        simulateTyping: simulateTyping !== false,
        stopOnReply: stopOnReply !== false,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        imagePath,
        imageCaption: imageCaption || null,
        totalContacts: contactIds.length,
        status: scheduledAt && new Date(scheduledAt) > new Date() ? 'scheduled' : 'draft',
        messages: {
          create: messages.map(msg => ({
            order: msg.order,
            variations: { create: msg.variations.map(v => ({ content: v.content })) }
          }))
        },
        contacts: {
          create: contactIds.map(contactId => ({ contactId, status: 'pending' }))
        }
      },
      include: { messages: { include: { variations: true } }, contacts: true }
    })

    res.json(campaign)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get campaign
router.get('/:id', async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: {
      messages: { include: { variations: true }, orderBy: { order: 'asc' } },
      _count: { select: { contacts: true, sendLogs: true } }
    }
  })
  if (!campaign) return res.status(404).json({ error: 'Não encontrada' })
  res.json(campaign)
})

// Update campaign (only paused/draft)
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
    if (!campaign) return res.status(404).json({ error: 'Não encontrada' })
    if (!['draft', 'paused'].includes(campaign.status)) {
      return res.status(400).json({ error: 'Só pode editar campanhas em draft ou paused' })
    }

    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body
    const { name, flowMode, minDelaySec, maxDelaySec, simulateTyping, stopOnReply, scheduledAt, messages, imageCaption } = body

    const imagePath = req.file ? req.file.path : campaign.imagePath

    // Delete old messages and recreate
    if (messages) {
      await prisma.message.deleteMany({ where: { campaignId: req.params.id } })
      for (const msg of messages) {
        await prisma.message.create({
          data: {
            campaignId: req.params.id,
            order: msg.order,
            variations: { create: msg.variations.map(v => ({ content: v.content })) }
          }
        })
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(flowMode && { flowMode }),
        ...(minDelaySec !== undefined && { minDelaySec: Number(minDelaySec) }),
        ...(maxDelaySec !== undefined && { maxDelaySec: Number(maxDelaySec) }),
        ...(simulateTyping !== undefined && { simulateTyping }),
        ...(stopOnReply !== undefined && { stopOnReply }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
        ...(imageCaption !== undefined && { imageCaption }),
        imagePath
      }
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete campaign
router.delete('/:id', async (req, res) => {
  await prisma.campaign.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

// Start
router.post('/:id/start', async (req, res) => {
  try {
    await startCampaign(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Pause
router.post('/:id/pause', async (req, res) => {
  await pauseCampaign(req.params.id)
  res.json({ ok: true })
})

// Resume
router.post('/:id/resume', async (req, res) => {
  await resumeCampaign(req.params.id)
  res.json({ ok: true })
})

// Cancel
router.post('/:id/cancel', async (req, res) => {
  await cancelCampaign(req.params.id)
  res.json({ ok: true })
})

// Contacts list
router.get('/:id/contacts', async (req, res) => {
  const { status, page = '1', limit = '50' } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const where = { campaignId: req.params.id, ...(status && { status }) }
  const [contacts, total] = await Promise.all([
    prisma.campaignContact.findMany({
      where, skip, take: Number(limit),
      include: { contact: true },
      orderBy: { id: 'asc' }
    }),
    prisma.campaignContact.count({ where })
  ])
  res.json({ contacts, total, page: Number(page), limit: Number(limit) })
})

// Logs
router.get('/:id/logs', async (req, res) => {
  const { page = '1', limit = '100' } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const [logs, total] = await Promise.all([
    prisma.sendLog.findMany({
      where: { campaignId: req.params.id },
      skip, take: Number(limit),
      orderBy: { sentAt: 'desc' }
    }),
    prisma.sendLog.count({ where: { campaignId: req.params.id } })
  ])
  res.json({ logs, total })
})

// Replies
router.get('/:id/replies', async (req, res) => {
  const replies = await prisma.incomingMessage.findMany({
    where: { campaignId: req.params.id },
    orderBy: { receivedAt: 'desc' }
  })
  res.json(replies)
})

// Export logs CSV
router.get('/:id/export/logs.csv', async (req, res) => {
  const logs = await prisma.sendLog.findMany({ where: { campaignId: req.params.id } })
  const header = 'phone,messageOrder,variationUsed,status,errorType,sentAt\n'
  const rows = logs.map(l =>
    `"${l.phone}",${l.messageOrder},"${(l.variationUsed || '').replace(/"/g, '""')}","${l.status}","${l.errorType || ''}","${l.sentAt.toISOString()}"`
  ).join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="logs-${req.params.id}.csv"`)
  res.send(header + rows)
})

// Export errors CSV
router.get('/:id/export/errors.csv', async (req, res) => {
  const errors = await prisma.sendLog.findMany({
    where: { campaignId: req.params.id, status: 'failed' }
  })
  const header = 'phone,errorType,errorMessage,sentAt\n'
  const rows = errors.map(l =>
    `"${l.phone}","${l.errorType || 'unknown'}","${(l.errorMessage || '').replace(/"/g, '""')}","${l.sentAt.toISOString()}"`
  ).join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="errors-${req.params.id}.csv"`)
  res.send(header + rows)
})

// Reorder queue
router.put('/queue/reorder', async (req, res) => {
  const { orderedIds } = req.body
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds deve ser um array' })

  for (let i = 0; i < orderedIds.length; i++) {
    await prisma.campaign.update({
      where: { id: orderedIds[i] },
      data: { queuePosition: i }
    })
  }

  res.json({ ok: true })
})

export default router
