import { readFileSync, existsSync } from 'fs'
import prisma from '../prisma/client.js'
import logger from '../utils/logger.js'
import { randomDelay, sleep } from '../utils/delay.js'
import {
  sendTextMessage,
  sendImageMessage,
  setPresenceTyping,
  checkOnWhatsApp,
  resolveSendJid
} from './whatsapp.service.js'
import { promoteQueued } from './queue.service.js'
import { TEST_PHONE_NUMBER } from '../config/env.js'

let io = null
const activeCampaigns = new Map() // campaignId -> { running: bool, stopping: bool }

export function setSocketIO(socketIO) { io = socketIO }

function getIO() { return io }

function pickVariation(variations) {
  return variations[Math.floor(Math.random() * variations.length)]
}

function applyVars(text, contact) {
  return text.replace(/\{nome\}/gi, contact.firstName)
}

async function getTodayCount() {
  const date = new Date().toISOString().split('T')[0]
  const counter = await prisma.dailyCounter.findUnique({ where: { date } })
  return { date, count: counter?.sentCount || 0 }
}

async function incrementDailyCounter(date) {
  await prisma.dailyCounter.upsert({
    where: { date },
    create: { date, sentCount: 1 },
    update: { sentCount: { increment: 1 } }
  })
}

async function checkDailyLimit() {
  const settings = await prisma.settings.findFirst()
  if (!settings?.dailyLimitEnabled) return false
  const { date, count } = await getTodayCount()
  if (count >= settings.dailyLimitValue) {
    io?.emit('daily_limit:reached', { count, limit: settings.dailyLimitValue })
    return true
  }
  return false
}

async function sendMessage(campaign, contact, message, settings, isTest) {
  const variation = pickVariation(message.variations)
  let text = applyVars(variation.content, contact)

  let targetPhone = contact.phone
  if (isTest) {
    targetPhone = TEST_PHONE_NUMBER
    if (!targetPhone) throw new Error('TEST_PHONE_NUMBER não configurado no .env')
    text = `[TESTE - Campanha: ${campaign.name}] [Contato fictício: ${contact.firstName}]\n\n${text}`
  }

  const jid = await resolveSendJid(targetPhone)

  logger.info({
    campaignId: campaign.id,
    contactPhone: contact.phone,
    targetJid: jid,
    isTest,
    msgOrder: message.order,
    textPreview: text.slice(0, 80)
  }, '[CAMPANHA] Preparando envio')

  // Simulate typing
  if (campaign.simulateTyping) {
    const typingDuration = Math.min((text.length / 50) * 1000, 5000)
    logger.debug({ jid, typingDuration }, '[CAMPANHA] Iniciando simulação de digitação')
    await setPresenceTyping(jid, typingDuration)
  }

  const isFirstMessage = message.order === 1
  const hasImage = isFirstMessage && campaign.imagePath

  if (hasImage) {
    if (!existsSync(campaign.imagePath)) {
      logger.warn({ imagePath: campaign.imagePath }, '[CAMPANHA] Imagem não encontrada no disco — enviando só texto')
      await sendTextMessage(jid, text)
    } else {
      logger.info({ imagePath: campaign.imagePath }, '[CAMPANHA] Carregando imagem do disco')
      const imageBuffer = readFileSync(campaign.imagePath)
      logger.info({ imageSize: imageBuffer.length }, '[CAMPANHA] Enviando imagem com legenda')
      await sendImageMessage(jid, imageBuffer, text)
    }
  } else {
    await sendTextMessage(jid, text)
  }

  return variation.content
}

async function processContact(campaign, campaignContact, messages, settings, isTest) {
  const state = activeCampaigns.get(campaign.id)
  const contact = campaignContact.contact

  logger.info({
    campaignId: campaign.id,
    contactId: contact.id,
    phone: contact.phone,
    name: contact.firstName,
    totalMessages: messages.length,
    isTest
  }, '[CAMPANHA] Iniciando processamento do contato')

  await prisma.campaignContact.update({
    where: { id: campaignContact.id },
    data: { status: 'in_progress' }
  })

  for (const message of messages) {
    if (state?.stopping) {
      logger.info({ campaignId: campaign.id }, '[CAMPANHA] Parada solicitada — interrompendo contato')
      break
    }

    // Re-check if replied
    const fresh = await prisma.campaignContact.findUnique({ where: { id: campaignContact.id } })
    if (fresh?.status === 'replied' && campaign.stopOnReply) {
      logger.info({ phone: contact.phone }, '[CAMPANHA] Contato já respondeu — pulando mensagens restantes')
      break
    }

    const limitReached = await checkDailyLimit()
    if (limitReached) {
      logger.warn('[CAMPANHA] Limite diário atingido — pausando campanha')
      await pauseAllForDailyLimit()
      return
    }

    logger.info({
      campaignId: campaign.id,
      phone: contact.phone,
      msgOrder: message.order,
      totalVariations: message.variations.length
    }, '[CAMPANHA] Processando mensagem')

    try {
      // Check WhatsApp registration on first message only (skip in test mode)
      if (message.order === 1 && !isTest) {
        logger.info({ phone: contact.phone }, '[CAMPANHA] Verificando se número está no WhatsApp')
        const onWA = await checkOnWhatsApp(contact.phone)
        if (!onWA) {
          logger.warn({ phone: contact.phone }, '[CAMPANHA] Número não está no WhatsApp — descartando')
          await prisma.sendLog.create({
            data: {
              campaignId: campaign.id,
              contactId: contact.id,
              phone: contact.phone,
              messageOrder: message.order,
              status: 'failed',
              errorType: 'not_on_whatsapp'
            }
          })
          await prisma.campaignContact.update({ where: { id: campaignContact.id }, data: { status: 'failed' } })
          await prisma.campaign.update({ where: { id: campaign.id }, data: { failedCount: { increment: 1 } } })
          io?.emit('campaign:message_failed', {
            campaignId: campaign.id,
            contactId: contact.id,
            phone: contact.phone,
            errorType: 'not_on_whatsapp'
          })
          return
        }
        logger.info({ phone: contact.phone }, '[CAMPANHA] Número confirmado no WhatsApp')
      }

      const variationUsed = await sendMessage(campaign, contact, message, settings, isTest)
      logger.info({ phone: contact.phone, msgOrder: message.order }, '[CAMPANHA] ✅ Mensagem enviada com sucesso')

      const { date } = await getTodayCount()
      await incrementDailyCounter(date)

      await prisma.sendLog.create({
        data: {
          campaignId: campaign.id,
          contactId: contact.id,
          phone: contact.phone,
          messageOrder: message.order,
          variationUsed,
          status: 'sent'
        }
      })

      await prisma.campaignContact.update({
        where: { id: campaignContact.id },
        data: { currentMsgOrder: message.order, lastSentAt: new Date() }
      })

      await prisma.campaign.update({ where: { id: campaign.id }, data: { sentCount: { increment: 1 } } })

      const updated = await prisma.campaign.findUnique({ where: { id: campaign.id } })
      io?.emit('campaign:message_sent', {
        campaignId: campaign.id,
        contactId: contact.id,
        phone: contact.phone,
        firstName: contact.firstName,
        messageOrder: message.order,
        variationContent: variationUsed,
        sentAt: new Date().toISOString()
      })
      io?.emit('campaign:progress', {
        campaignId: campaign.id,
        sentCount: updated.sentCount,
        failedCount: updated.failedCount,
        totalContacts: updated.totalContacts
      })

    } catch (err) {
      const errorType = classifyError(err)
      logger.error({
        campaignId: campaign.id,
        phone: contact.phone,
        msgOrder: message.order,
        errorType,
        errorMessage: err.message,
        stack: err.stack
      }, '[CAMPANHA] ❌ ERRO ao enviar mensagem')

      await prisma.sendLog.create({
        data: {
          campaignId: campaign.id,
          contactId: contact.id,
          phone: contact.phone,
          messageOrder: message.order,
          status: 'failed',
          errorType,
          errorMessage: err.message
        }
      })
      await prisma.campaignContact.update({ where: { id: campaignContact.id }, data: { status: 'failed' } })
      await prisma.campaign.update({ where: { id: campaign.id }, data: { failedCount: { increment: 1 } } })
      io?.emit('campaign:message_failed', {
        campaignId: campaign.id,
        contactId: contact.id,
        phone: contact.phone,
        errorType,
        errorMessage: err.message
      })
      return
    }

    if (message.order < messages.length) {
      await randomDelay(campaign.minDelaySec, campaign.maxDelaySec)
    }
  }

  const fresh = await prisma.campaignContact.findUnique({ where: { id: campaignContact.id } })
  if (!['failed', 'replied'].includes(fresh.status)) {
    await prisma.campaignContact.update({ where: { id: campaignContact.id }, data: { status: 'completed' } })
  }
}

function classifyError(err) {
  const msg = err.message?.toLowerCase() || ''
  if (msg.includes('not on whatsapp')) return 'not_on_whatsapp'
  if (msg.includes('blocked')) return 'blocked'
  if (msg.includes('timeout')) return 'timeout'
  if (msg.includes('invalid')) return 'invalid_number'
  return 'unknown'
}

async function pauseAllForDailyLimit() {
  const running = await prisma.campaign.findMany({ where: { status: { in: ['running', 'pausing'] } } })
  for (const c of running) {
    await prisma.campaign.update({ where: { id: c.id }, data: { status: 'paused_daily_limit', pausedAt: new Date() } })
    io?.emit('campaign:status_changed', { campaignId: c.id, status: 'paused_daily_limit', metrics: {} })
    const state = activeCampaigns.get(c.id)
    if (state) state.stopping = true
  }
}

async function runSequential(campaignId, settings, isTest) {
  const state = activeCampaigns.get(campaignId)

  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId, status: 'pending' },
    include: { contact: true },
    orderBy: { id: 'asc' }
  })

  // Shuffle contacts
  for (let i = contacts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [contacts[i], contacts[j]] = [contacts[j], contacts[i]]
  }

  const messages = await prisma.message.findMany({
    where: { campaignId },
    include: { variations: true },
    orderBy: { order: 'asc' }
  })

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })

  logger.info({
    campaignId,
    pendingContacts: contacts.length,
    messages: messages.map(m => ({ order: m.order, variations: m.variations.length }))
  }, '[CAMPANHA] runSequential — contatos e mensagens carregados')

  for (const cc of contacts) {
    if (state.stopping) break

    const currentCampaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
    if (!['running'].includes(currentCampaign.status)) break

    await processContact(currentCampaign, cc, messages, settings, isTest)

    if (messages.length > 1) {
      await randomDelay(campaign.minDelaySec, campaign.maxDelaySec)
    }
  }
}

async function runBroadcast(campaignId, settings, isTest) {
  const state = activeCampaigns.get(campaignId)

  const messages = await prisma.message.findMany({
    where: { campaignId },
    include: { variations: true },
    orderBy: { order: 'asc' }
  })

  for (const message of messages) {
    if (state.stopping) break

    const contacts = await prisma.campaignContact.findMany({
      where: { campaignId, status: { in: ['pending', 'in_progress'] } },
      include: { contact: true }
    })

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })

    for (const cc of contacts) {
      if (state.stopping) break
      const currentCampaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
      if (!['running'].includes(currentCampaign.status)) break

      await processContact(currentCampaign, cc, [message], settings, isTest)
      await randomDelay(campaign.minDelaySec, campaign.maxDelaySec)
    }
  }
}

async function runShuffled(campaignId, settings, isTest) {
  const state = activeCampaigns.get(campaignId)

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  const messages = await prisma.message.findMany({
    where: { campaignId },
    include: { variations: true },
    orderBy: { order: 'asc' }
  })

  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId, status: 'pending' },
    include: { contact: true }
  })

  // Build queue maintaining per-contact message order
  const queue = []
  for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
    for (const cc of contacts) {
      queue.push({ cc, message: messages[msgIdx] })
    }
  }

  // Shuffle while respecting order
  // Simple approach: interleave contacts for each message in order
  for (const item of queue) {
    if (state.stopping) break
    const currentCampaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
    if (!['running'].includes(currentCampaign.status)) break

    const fresh = await prisma.campaignContact.findUnique({ where: { id: item.cc.id } })
    if (!['pending', 'in_progress'].includes(fresh.status)) continue

    await processContact(currentCampaign, item.cc, [item.message], settings, isTest)
    await randomDelay(campaign.minDelaySec, campaign.maxDelaySec)
  }
}

export async function runCampaign(campaignId) {
  logger.info({ campaignId }, '[CAMPANHA] ========== INICIANDO EXECUÇÃO ==========')
  activeCampaigns.set(campaignId, { running: true, stopping: false })

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { messages: { include: { variations: true } } }
    })

    if (!campaign) throw new Error('Campanha não encontrada no banco')

    const settings = await prisma.settings.findFirst()
    const isTest = settings?.mode === 'test'

    logger.info({
      campaignId,
      name: campaign.name,
      flowMode: campaign.flowMode,
      totalContacts: campaign.totalContacts,
      totalMessages: campaign.messages.length,
      isTest,
      testPhone: isTest ? TEST_PHONE_NUMBER : null,
      minDelaySec: campaign.minDelaySec,
      maxDelaySec: campaign.maxDelaySec,
      simulateTyping: campaign.simulateTyping,
      hasImage: !!campaign.imagePath,
      imagePath: campaign.imagePath || null
    }, '[CAMPANHA] Configuração da campanha')

    if (isTest && !TEST_PHONE_NUMBER) {
      throw new Error('Modo TESTE ativo mas TEST_PHONE_NUMBER não está configurado no .env!')
    }

    io?.emit('campaign:status_changed', {
      campaignId,
      status: campaign.status,
      metrics: { totalContacts: campaign.totalContacts, sentCount: campaign.sentCount }
    })

    logger.info({ campaignId, flowMode: campaign.flowMode }, '[CAMPANHA] Iniciando fluxo de disparo')

    if (campaign.flowMode === 'sequential_per_contact') {
      await runSequential(campaignId, settings, isTest)
    } else if (campaign.flowMode === 'broadcast') {
      await runBroadcast(campaignId, settings, isTest)
    } else if (campaign.flowMode === 'shuffled') {
      await runShuffled(campaignId, settings, isTest)
    }

    // Check final state
    const state = activeCampaigns.get(campaignId)
    const finalCampaign = await prisma.campaign.findUnique({ where: { id: campaignId } })

    logger.info({
      campaignId,
      finalStatus: finalCampaign.status,
      sentCount: finalCampaign.sentCount,
      failedCount: finalCampaign.failedCount
    }, '[CAMPANHA] Fluxo concluído — verificando status final')

    if (state?.stopping && finalCampaign.status === 'pausing') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'paused', pausedAt: new Date() }
      })
      io?.emit('campaign:status_changed', { campaignId, status: 'paused', metrics: {} })
      logger.info({ campaignId }, '[CAMPANHA] Campanha pausada com sucesso')
    } else if (!['paused', 'paused_daily_limit', 'cancelled', 'failed'].includes(finalCampaign.status)) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'completed', completedAt: new Date() }
      })
      io?.emit('campaign:status_changed', { campaignId, status: 'completed', metrics: {} })
      logger.info({ campaignId, sentCount: finalCampaign.sentCount }, '[CAMPANHA] ✅ Campanha concluída com sucesso')
    }

  } catch (err) {
    logger.error({
      campaignId,
      errorMessage: err.message,
      stack: err.stack
    }, '[CAMPANHA] ❌ ERRO CRÍTICO na execução da campanha')
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'failed' }
    }).catch(() => {})
    io?.emit('campaign:status_changed', { campaignId, status: 'failed', metrics: {} })
  } finally {
    activeCampaigns.delete(campaignId)
    logger.info({ campaignId }, '[CAMPANHA] ========== EXECUÇÃO FINALIZADA ==========')
    await promoteQueued()
  }
}

export async function pauseCampaign(campaignId) {
  const state = activeCampaigns.get(campaignId)
  if (state) {
    state.stopping = true
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'pausing' }
    })
    io?.emit('campaign:status_changed', { campaignId, status: 'pausing', metrics: {} })
  } else {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'paused', pausedAt: new Date() }
    })
    io?.emit('campaign:status_changed', { campaignId, status: 'paused', metrics: {} })
  }
}

export async function resumeCampaign(campaignId) {
  const settings = await prisma.settings.findFirst()
  const max = settings?.maxConcurrentCampaigns || 1
  const runningCount = await prisma.campaign.count({
    where: { status: { in: ['running', 'pausing'] } }
  })

  const newStatus = runningCount < max ? 'running' : 'queued'
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: newStatus, pausedAt: null }
  })
  io?.emit('campaign:status_changed', { campaignId, status: newStatus, metrics: {} })

  if (newStatus === 'running') runCampaign(campaignId)
}

export async function cancelCampaign(campaignId) {
  const state = activeCampaigns.get(campaignId)
  if (state) state.stopping = true

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'cancelled' }
  })
  io?.emit('campaign:status_changed', { campaignId, status: 'cancelled', metrics: {} })
  await promoteQueued()
}

export async function startCampaign(campaignId) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { contacts: true }
  })
  if (!campaign) throw new Error('Campanha não encontrada')

  const settings = await prisma.settings.findFirst()
  const max = settings?.maxConcurrentCampaigns || 1
  const runningCount = await prisma.campaign.count({
    where: { status: { in: ['running', 'pausing'] } }
  })

  // Reset pending contacts if re-starting
  await prisma.campaignContact.updateMany({
    where: { campaignId, status: { in: ['failed'] } },
    data: { status: 'pending', currentMsgOrder: 0 }
  })

  const newStatus = runningCount < max ? 'running' : 'queued'
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: newStatus, startedAt: new Date() }
  })

  io?.emit('campaign:status_changed', { campaignId, status: newStatus, metrics: {} })

  if (newStatus === 'running') runCampaign(campaignId)
}
