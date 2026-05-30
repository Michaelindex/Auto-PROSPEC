import prisma from '../prisma/client.js'
import logger from '../utils/logger.js'

let runCampaignFn = null

export function setRunCampaignFn(fn) {
  runCampaignFn = fn
}

export async function promoteQueued() {
  const settings = await prisma.settings.findFirst()
  const max = settings?.maxConcurrentCampaigns || 1

  const runningCount = await prisma.campaign.count({
    where: { status: { in: ['running', 'pausing'] } }
  })

  if (runningCount >= max) return

  const slots = max - runningCount
  const queued = await prisma.campaign.findMany({
    where: { status: 'queued' },
    orderBy: [{ queuePosition: 'asc' }, { createdAt: 'asc' }],
    take: slots
  })

  for (const campaign of queued) {
    logger.info({ campaignId: campaign.id }, 'Promovendo campanha da fila para running')
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'running', startedAt: new Date() }
    })
    if (runCampaignFn) runCampaignFn(campaign.id)
  }
}
