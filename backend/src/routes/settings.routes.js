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
    mode, maxConcurrentCampaigns, dailyLimitEnabled, dailyLimitValue,
    defaultContactDelayMinSec, defaultContactDelayMaxSec,
    defaultMsgDelayMinSec, defaultMsgDelayMaxSec, simulateTyping
  } = req.body

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      mode, maxConcurrentCampaigns, dailyLimitEnabled, dailyLimitValue,
      defaultContactDelayMinSec, defaultContactDelayMaxSec,
      defaultMsgDelayMinSec, defaultMsgDelayMaxSec, simulateTyping
    },
    update: {
      ...(mode !== undefined && { mode }),
      ...(maxConcurrentCampaigns !== undefined && { maxConcurrentCampaigns: Number(maxConcurrentCampaigns) }),
      ...(dailyLimitEnabled !== undefined && { dailyLimitEnabled }),
      ...(dailyLimitValue !== undefined && { dailyLimitValue: Number(dailyLimitValue) }),
      ...(defaultContactDelayMinSec !== undefined && { defaultContactDelayMinSec: Number(defaultContactDelayMinSec) }),
      ...(defaultContactDelayMaxSec !== undefined && { defaultContactDelayMaxSec: Number(defaultContactDelayMaxSec) }),
      ...(defaultMsgDelayMinSec !== undefined && { defaultMsgDelayMinSec: Number(defaultMsgDelayMinSec) }),
      ...(defaultMsgDelayMaxSec !== undefined && { defaultMsgDelayMaxSec: Number(defaultMsgDelayMaxSec) }),
      ...(simulateTyping !== undefined && { simulateTyping })
    }
  })

  res.json(settings)
})

export default router
