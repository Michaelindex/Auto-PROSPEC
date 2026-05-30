import { Router } from 'express'
import prisma from '../prisma/client.js'

const router = Router()

router.get('/', async (req, res) => {
  let settings = await prisma.settings.findFirst()
  if (!settings) {
    settings = await prisma.settings.create({ data: {} })
  }
  res.json(settings)
})

router.put('/', async (req, res) => {
  const {
    mode, maxConcurrentCampaigns, dailyLimitEnabled,
    dailyLimitValue, defaultMinDelaySec, defaultMaxDelaySec, simulateTyping
  } = req.body

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      mode, maxConcurrentCampaigns, dailyLimitEnabled,
      dailyLimitValue, defaultMinDelaySec, defaultMaxDelaySec, simulateTyping
    },
    update: {
      ...(mode !== undefined && { mode }),
      ...(maxConcurrentCampaigns !== undefined && { maxConcurrentCampaigns: Number(maxConcurrentCampaigns) }),
      ...(dailyLimitEnabled !== undefined && { dailyLimitEnabled }),
      ...(dailyLimitValue !== undefined && { dailyLimitValue: Number(dailyLimitValue) }),
      ...(defaultMinDelaySec !== undefined && { defaultMinDelaySec: Number(defaultMinDelaySec) }),
      ...(defaultMaxDelaySec !== undefined && { defaultMaxDelaySec: Number(defaultMaxDelaySec) }),
      ...(simulateTyping !== undefined && { simulateTyping })
    }
  })

  res.json(settings)
})

export default router
