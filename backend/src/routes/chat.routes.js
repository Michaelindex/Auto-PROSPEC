import { Router } from 'express'
import multer from 'multer'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import * as chatController from '../controllers/chat.controller.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const chatDir = resolve(__dirname, '../../uploads/chat')
mkdirSync(chatDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, chatDir),
    filename: (req, file, cb) => cb(null, `${randomUUID()}-${file.originalname}`)
  }),
  limits: { fileSize: 16 * 1024 * 1024 }
})

const router = Router()

router.get('/summary', chatController.getSummary)
router.get('/:campaignId/contacts', chatController.getCampaignContacts)
router.get('/:campaignId/contacts/:contactId/messages', chatController.getMessages)
router.post('/:campaignId/contacts/:contactId/messages', upload.single('media'), chatController.sendMessage)
router.post('/:campaignId/contacts/:contactId/read', chatController.markAsRead)

export default router
