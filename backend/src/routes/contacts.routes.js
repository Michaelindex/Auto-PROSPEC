import { Router } from 'express'
import multer from 'multer'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import prisma from '../prisma/client.js'
import { processCSV } from '../services/csv.service.js'
import { refreshContactProfilePicture } from '../services/chat.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const uploadDir = resolve(__dirname, '../../uploads/csv')
mkdirSync(uploadDir, { recursive: true })

const upload = multer({ storage: multer.memoryStorage() })
const router = Router()

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' })
  const result = await processCSV(req.file.buffer)
  res.json(result)
})

router.get('/', async (req, res) => {
  const { search = '', page = '1', limit = '50' } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where = search ? {
    OR: [
      { firstName: { contains: search } },
      { rawName: { contains: search } },
      { phone: { contains: search } }
    ]
  } : {}

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
    prisma.contact.count({ where })
  ])

  res.json({ contacts, total, page: Number(page), limit: Number(limit) })
})

router.delete('/:id', async (req, res) => {
  await prisma.contact.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

router.get('/:id/profile-picture/refresh', async (req, res) => {
  try {
    const url = await refreshContactProfilePicture(req.params.id)
    res.json({ profilePictureUrl: url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
