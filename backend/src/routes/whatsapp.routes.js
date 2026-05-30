import { Router } from 'express'
import { getStatus, logout } from '../services/whatsapp.service.js'

const router = Router()

router.get('/status', (req, res) => {
  res.json(getStatus())
})

router.post('/logout', async (req, res) => {
  await logout()
  res.json({ ok: true })
})

export default router
