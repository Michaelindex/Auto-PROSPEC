import prisma from '../prisma/client.js'
import logger from '../utils/logger.js'
import { runCampaign } from './campaign.service.js'
import { promoteQueued } from './queue.service.js'

let interval = null

async function checkScheduled() {
  const now = new Date()

  const scheduled = await prisma.campaign.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: now } }
  })

  for (const campaign of scheduled) {
    logger.info({ campaignId: campaign.id }, 'Campanha agendada: hora de disparar')
    const settings = await prisma.settings.findFirst()
    const max = settings?.maxConcurrentCampaigns || 1
    const runningCount = await prisma.campaign.count({
      where: { status: { in: ['running', 'pausing'] } }
    })

    const newStatus = runningCount < max ? 'running' : 'queued'
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: newStatus, startedAt: new Date() }
    })

    if (newStatus === 'running') runCampaign(campaign.id)
  }

  // Also check daily limit reset (midnight)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const pausedDailyLimit = await prisma.campaign.findMany({
    where: { status: 'paused_daily_limit' }
  })

  if (pausedDailyLimit.length > 0) {
    const todayStr = now.toISOString().split('T')[0]
    const todayCounter = await prisma.dailyCounter.findUnique({ where: { date: todayStr } })
    const sentToday = todayCounter?.sentCount || 0
    const settings2 = await prisma.settings.findFirst()

    if (!settings2?.dailyLimitEnabled || sentToday < (settings2?.dailyLimitValue || 200)) {
      for (const c of pausedDailyLimit) {
        await prisma.campaign.update({
          where: { id: c.id },
          data: { status: 'queued' }
        })
      }
      await promoteQueued()
    }
  }
}

export function startScheduler() {
  if (interval) return
  interval = setInterval(checkScheduled, 30_000)
  checkScheduled()
  logger.info('Agendador iniciado')
}

export function stopScheduler() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
