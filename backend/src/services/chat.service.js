import { readFileSync } from 'fs'
import { basename } from 'path'
import prisma from '../prisma/client.js'
import { getSocket, resolveSendJid } from './whatsapp.service.js'
import logger from '../utils/logger.js'

let io = null
export function setSocketIO(socketIO) {
  io = socketIO
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function mediaUrl(filePath) {
  if (!filePath) return null
  return `/uploads/chat/${filePath.replace(/\\/g, '/').split('/').pop()}`
}

async function fetchAndCacheProfilePicture(contact) {
  try {
    const sock = getSocket()
    if (!sock?.user) return contact.profilePictureUrl ?? null
    const jid = contact.phone.replace('+', '') + '@s.whatsapp.net'
    const url = await sock.profilePictureUrl(jid, 'image')
    await prisma.contact.update({
      where: { id: contact.id },
      data: { profilePictureUrl: url, profilePictureUpdatedAt: new Date() }
    })
    return url
  } catch {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { profilePictureUrl: null, profilePictureUpdatedAt: new Date() }
    }).catch(() => {})
    return null
  }
}

export async function getOrFetchProfilePicture(contact) {
  const needsRefresh =
    !contact.profilePictureUpdatedAt ||
    Date.now() - new Date(contact.profilePictureUpdatedAt).getTime() > CACHE_TTL_MS

  if (!needsRefresh) return contact.profilePictureUrl ?? null

  fetchAndCacheProfilePicture(contact).catch(err =>
    logger.warn({ err: err.message }, 'Profile picture fetch failed')
  )
  return contact.profilePictureUrl ?? null
}

export async function getChatSummary() {
  const [campaigns, unreadAgg] = await Promise.all([
    prisma.campaign.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.campaignContact.groupBy({
      by: ['campaignId'],
      _sum: { unreadCount: true }
    })
  ])

  const unreadMap = Object.fromEntries(
    unreadAgg.map(u => [u.campaignId, u._sum.unreadCount || 0])
  )

  const result = campaigns.map(c => ({
    campaignId: c.id,
    name: c.name,
    unreadCount: unreadMap[c.id] || 0
  }))

  const totalUnread = result.reduce((sum, c) => sum + c.unreadCount, 0)
  return { totalUnread, campaigns: result }
}

export async function getCampaignContacts(campaignId, { page = 1, limit = 500 }) {
  const skip = (Number(page) - 1) * Number(limit)

  const [campaignContacts, total] = await Promise.all([
    prisma.campaignContact.findMany({
      where: { campaignId },
      skip,
      take: Number(limit),
      include: {
        contact: true,
        manualMessages: { orderBy: { sentAt: 'desc' }, take: 1 }
      },
      orderBy: [
        { unreadCount: 'desc' },
        { lastSentAt: 'desc' }
      ]
    }),
    prisma.campaignContact.count({ where: { campaignId } })
  ])

  const contactIds = campaignContacts.map(cc => cc.contactId)

  const allSendLogs = await prisma.sendLog.findMany({
    where: { campaignId, contactId: { in: contactIds }, status: 'sent' },
    orderBy: { sentAt: 'desc' }
  })

  const lastLogByContact = {}
  for (const log of allSendLogs) {
    if (!lastLogByContact[log.contactId]) lastLogByContact[log.contactId] = log
  }

  const contacts = campaignContacts.map(cc => {
    const lastManual = cc.manualMessages[0] || null
    const lastLog = lastLogByContact[cc.contactId] || null

    let lastMessage = null, lastMessageAt = null, lastMessageDirection = null, lastMessageStatus = null

    const candidates = []
    if (lastLog) {
      candidates.push({
        text: lastLog.variationUsed || '[mensagem automática]',
        at: lastLog.sentAt,
        direction: 'out',
        status: 'sent'
      })
    }
    if (lastManual) {
      candidates.push({
        text: lastManual.content || `[${lastManual.mediaType || 'mídia'}]`,
        at: lastManual.sentAt,
        direction: lastManual.direction,
        status: lastManual.status
      })
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => new Date(b.at) - new Date(a.at))
      const latest = candidates[0]
      lastMessage = latest.text
      lastMessageAt = latest.at
      lastMessageDirection = latest.direction
      lastMessageStatus = latest.status
    }

    getOrFetchProfilePicture(cc.contact).catch(() => {})

    return {
      contactId: cc.contactId,
      campaignContactId: cc.id,
      rawName: cc.contact.rawName,
      phone: cc.contact.phone,
      profilePictureUrl: cc.contact.profilePictureUrl,
      unreadCount: cc.unreadCount,
      status: cc.status,
      lastMessage,
      lastMessageAt,
      lastMessageDirection,
      lastMessageStatus
    }
  })

  return { contacts, total, page: Number(page), limit: Number(limit) }
}

export async function getMessages(campaignId, contactId, { page = 1, limit = 50 }) {
  const campaignContact = await prisma.campaignContact.findFirst({
    where: { campaignId, contactId }
  })
  if (!campaignContact) return { messages: [], total: 0, hasMore: false }

  const [automated, manual] = await Promise.all([
    prisma.sendLog.findMany({ where: { campaignId, contactId, status: 'sent' } }),
    prisma.manualMessage.findMany({ where: { campaignContactId: campaignContact.id } })
  ])

  const unified = [
    ...automated.map(m => ({
      id: `sl-${m.id}`,
      type: 'automated',
      direction: 'out',
      content: m.variationUsed,
      mediaPath: null,
      mediaType: null,
      mediaCaption: null,
      status: 'sent',
      sentAt: m.sentAt,
      readAt: null,
      isAutomated: true
    })),
    ...manual.map(m => ({
      id: `mm-${m.id}`,
      type: 'manual',
      direction: m.direction,
      content: m.content,
      mediaPath: mediaUrl(m.mediaPath),
      mediaType: m.mediaType,
      mediaCaption: m.mediaCaption,
      status: m.status,
      sentAt: m.sentAt,
      readAt: m.readAt,
      isAutomated: false
    }))
  ].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt))

  const total = unified.length
  const pageNum = Number(page)
  const pageSize = Number(limit)
  const end = total - (pageNum - 1) * pageSize
  const start = Math.max(0, end - pageSize)

  return { messages: unified.slice(start, end), total, hasMore: start > 0 }
}

export async function sendManualMessage(campaignId, contactId, { content, mediaPath, mediaType, mediaCaption }) {
  const campaignContact = await prisma.campaignContact.findFirst({
    where: { campaignId, contactId },
    include: { contact: true }
  })
  if (!campaignContact) throw new Error('Contato não encontrado na campanha')

  const sock = getSocket()
  if (!sock?.user) throw new Error('WhatsApp não conectado')
  const jid = await resolveSendJid(campaignContact.contact.phone)

  let result
  if (mediaPath && mediaType) {
    const buf = readFileSync(mediaPath)
    if (mediaType === 'image') {
      result = await sock.sendMessage(jid, { image: buf, caption: mediaCaption || undefined })
    } else if (mediaType === 'document') {
      result = await sock.sendMessage(jid, { document: buf, fileName: basename(mediaPath), mimetype: 'application/octet-stream' })
    } else if (mediaType === 'audio') {
      result = await sock.sendMessage(jid, { audio: buf, mimetype: 'audio/mp4', ptt: false })
    } else if (mediaType === 'video') {
      result = await sock.sendMessage(jid, { video: buf, caption: mediaCaption || undefined })
    }
  } else if (content) {
    result = await sock.sendMessage(jid, { text: content })
  } else {
    throw new Error('Conteúdo ou mídia obrigatório')
  }

  const manualMsg = await prisma.manualMessage.create({
    data: {
      campaignContactId: campaignContact.id,
      contactId,
      direction: 'out',
      content: content || null,
      mediaPath: mediaPath || null,
      mediaType: mediaType || null,
      mediaCaption: mediaCaption || null,
      whatsappMessageId: result?.key?.id || null,
      status: 'sent'
    }
  })

  return {
    id: `mm-${manualMsg.id}`,
    type: 'manual',
    direction: 'out',
    content: manualMsg.content,
    mediaPath: mediaUrl(manualMsg.mediaPath),
    mediaType: manualMsg.mediaType,
    mediaCaption: manualMsg.mediaCaption,
    status: manualMsg.status,
    sentAt: manualMsg.sentAt,
    readAt: null,
    isAutomated: false
  }
}

export async function markConversationRead(campaignId, contactId) {
  const cc = await prisma.campaignContact.findFirst({ where: { campaignId, contactId } })
  if (!cc) return

  await prisma.campaignContact.update({
    where: { id: cc.id },
    data: { unreadCount: 0, lastReadAt: new Date() }
  })

  const agg = await prisma.campaignContact.aggregate({ _sum: { unreadCount: true } })
  const totalUnread = agg._sum.unreadCount || 0

  io?.emit('chat:unread_updated', { campaignId, contactId, unreadCount: 0, totalUnread })
}

export async function refreshContactProfilePicture(contactId) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) throw new Error('Contato não encontrado')
  return fetchAndCacheProfilePicture({ ...contact, profilePictureUpdatedAt: null })
}
