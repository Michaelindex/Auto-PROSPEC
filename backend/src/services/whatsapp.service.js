import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { rmSync, existsSync } from 'fs'
import logger from '../utils/logger.js'
import prisma from '../prisma/client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = resolve(__dirname, '../../data/auth')

let sock = null
let io = null
let reconnectTimer = null
let isConnecting = false
let currentQR = null
let connectedPhone = null

export function setSocketIO(socketIO) {
  io = socketIO
}

export function getSocket() {
  return sock
}

export function getStatus() {
  return {
    connected: !!(sock && sock.user),
    phone: connectedPhone,
    qr: currentQR
  }
}

async function onMessage(messages) {
  for (const msg of messages) {
    // Log bruto ANTES de qualquer filtro — mostra toda mensagem que chega do WhatsApp
    logger.info({
      remoteJid: msg.key?.remoteJid,
      senderPn: msg.key?.senderPn || null,
      senderLid: msg.key?.senderLid || null,
      participant: msg.key?.participant || null,
      fromMe: msg.key?.fromMe,
      pushName: msg.pushName || null,
      hasMessage: !!msg.message
    }, '[chat] >>> Mensagem BRUTA recebida do WhatsApp')

    // Only process real incoming DM messages
    if (!msg.message || msg.key.fromMe) continue

    // O WhatsApp passou a entregar DMs como @lid (sem o número). O telefone real
    // vem em key.senderPn. Resolvemos o JID de telefone a partir do que estiver disponível.
    const pnJid =
      msg.key?.remoteJid?.endsWith('@s.whatsapp.net') ? msg.key.remoteJid :
      msg.key?.senderPn?.endsWith('@s.whatsapp.net') ? msg.key.senderPn :
      null

    if (!pnJid) {
      logger.warn({ remoteJid: msg.key?.remoteJid }, '[chat] Mensagem IGNORADA — sem telefone resolvível (grupo ou @lid sem senderPn)')
      continue
    }

    try {
      const phone = '+' + pnJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
      const fromName = msg.pushName || null
      const content =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '[mídia]'
      const whatsappMsgId = msg.key?.id || null

      logger.info({ phone, whatsappMsgId }, '[chat] Mensagem recebida')

      // Find active campaign contact for existing reply tracking
      const activeCampaignContact = await prisma.campaignContact.findFirst({
        where: {
          contact: { phone },
          status: { in: ['in_progress', 'completed', 'pending'] },
          campaign: { status: { in: ['running', 'pausing', 'paused'] } }
        },
        include: { campaign: true }
      })

      const campaignId = activeCampaignContact?.campaignId || null

      await prisma.incomingMessage.create({
        data: { fromPhone: phone, fromName, content, campaignId }
      })

      if (activeCampaignContact) {
        await prisma.campaignContact.update({
          where: { id: activeCampaignContact.id },
          data: { repliedAt: new Date(), status: 'replied' }
        })
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { repliedCount: { increment: 1 } }
        })
        io?.emit('campaign:reply_received', {
          campaignId,
          contactId: activeCampaignContact.contactId,
          phone,
          content,
          receivedAt: new Date().toISOString()
        })
      }

      // Respostas module: update unread + save ManualMessage for ALL campaign contacts
      const allCampaignContacts = await prisma.campaignContact.findMany({
        where: { contact: { phone } }
      })

      logger.info({ phone, count: allCampaignContacts.length }, '[chat] CampaignContacts encontrados')

      for (const cc of allCampaignContacts) {
        const [updatedCC, manualMsg] = await Promise.all([
          prisma.campaignContact.update({
            where: { id: cc.id },
            data: { unreadCount: { increment: 1 } },
            select: { unreadCount: true }
          }),
          prisma.manualMessage.create({
            data: {
              campaignContactId: cc.id,
              contactId: cc.contactId,
              direction: 'in',
              content,
              whatsappMessageId: whatsappMsgId,
              status: 'sent'
            }
          })
        ])

        io?.emit('chat:new_message', {
          campaignId: cc.campaignId,
          contactId: cc.contactId,
          message: {
            id: `mm-${manualMsg.id}`,
            type: 'manual',
            direction: 'in',
            content,
            mediaPath: null,
            mediaType: null,
            mediaCaption: null,
            status: 'sent',
            sentAt: manualMsg.sentAt.toISOString(),
            isAutomated: false
          },
          unreadCount: updatedCC.unreadCount
        })
      }

      if (allCampaignContacts.length > 0) {
        const agg = await prisma.campaignContact.aggregate({ _sum: { unreadCount: true } })
        io?.emit('chat:unread_updated', { totalUnread: agg._sum.unreadCount || 0 })
      }
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, '[chat] Erro ao processar mensagem recebida')
    }
  }
}

export async function connectWhatsApp() {
  if (isConnecting) return
  isConnecting = true

  try {
    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger: logger.child({ name: 'baileys' }),
      browser: ['WhatsApp Campaign Sender', 'Chrome', '120.0']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        currentQR = qr
        io?.emit('whatsapp:qr', { qr })
        logger.info('QR code gerado')
      }

      if (connection === 'open') {
        currentQR = null
        connectedPhone = sock.user?.id?.split(':')[0] || null
        isConnecting = false
        logger.info({ phone: connectedPhone }, 'WhatsApp conectado')
        io?.emit('whatsapp:connected', { phone: connectedPhone })
      }

      if (connection === 'close') {
        isConnecting = false
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
        const shouldReconnect = reason !== DisconnectReason.loggedOut

        logger.info({ reason }, 'Conexão encerrada')
        connectedPhone = null
        io?.emit('whatsapp:disconnected', { reason: String(reason) })

        if (reason === DisconnectReason.loggedOut) {
          await logout()
        } else if (shouldReconnect) {
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(() => connectWhatsApp(), 5000)
        }
      }
    })

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type === 'notify') onMessage(messages).catch(err =>
        logger.error({ err: err.message }, '[chat] Falha não tratada em onMessage')
      )
    })

    sock.ev.on('message-receipt.update', async updates => {
      try {
        for (const { key, receipt } of updates) {
          if (!key?.id || !receipt) continue
          // Baileys 6.x uses timestamps instead of a .type field
          const status =
            (receipt.readTimestamp || receipt.playedTimestamp) ? 'read' :
            receipt.deliveryTimestamp ? 'delivered' : null
          if (!status) continue
          try {
            const msg = await prisma.manualMessage.findFirst({
              where: { whatsappMessageId: key.id, direction: 'out' }
            })
            if (!msg) continue
            const updateData = { status }
            if (status === 'delivered' && !msg.deliveredAt) updateData.deliveredAt = new Date()
            if (status === 'read' && !msg.readAt) updateData.readAt = new Date()
            await prisma.manualMessage.update({ where: { id: msg.id }, data: updateData })
            io?.emit('chat:message_status', {
              messageId: `mm-${msg.id}`,
              campaignContactId: msg.campaignContactId,
              status,
              deliveredAt: updateData.deliveredAt?.toISOString(),
              readAt: updateData.readAt?.toISOString()
            })
          } catch (err) {
            logger.warn({ err: err.message }, 'Erro ao processar receipt de mensagem')
          }
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Erro no handler message-receipt.update')
      }
    })
  } catch (err) {
    isConnecting = false
    logger.error(err, 'Erro ao conectar WhatsApp')
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => connectWhatsApp(), 10000)
  }
}

export async function logout() {
  try {
    if (sock) {
      await sock.logout().catch(() => {})
      sock = null
    }
    if (existsSync(AUTH_DIR)) {
      rmSync(AUTH_DIR, { recursive: true, force: true })
    }
    connectedPhone = null
    currentQR = null
    io?.emit('whatsapp:disconnected', { reason: 'logout' })
    logger.info('Logout realizado')
  } catch (err) {
    logger.error(err, 'Erro ao fazer logout')
  }
}

export async function sendTextMessage(jid, text) {
  if (!sock) throw new Error('WhatsApp não conectado — sock é null')
  if (!sock.user) throw new Error('WhatsApp não autenticado — sock.user é null')
  logger.info({ jid, textLength: text.length }, '[WA] Enviando mensagem de texto')
  try {
    const result = await sock.sendMessage(jid, { text })
    logger.info({ jid, msgId: result?.key?.id }, '[WA] Mensagem de texto enviada com sucesso')
    return result
  } catch (err) {
    logger.error({ jid, err: err.message, stack: err.stack }, '[WA] ERRO ao enviar mensagem de texto')
    throw err
  }
}

export async function sendImageMessage(jid, imageBuffer, caption, mimetype = 'image/jpeg') {
  if (!sock) throw new Error('WhatsApp não conectado — sock é null')
  if (!sock.user) throw new Error('WhatsApp não autenticado — sock.user é null')
  logger.info({ jid, captionLength: caption?.length, imageSize: imageBuffer.length }, '[WA] Enviando imagem')
  try {
    const result = await sock.sendMessage(jid, { image: imageBuffer, caption, mimetype })
    logger.info({ jid, msgId: result?.key?.id }, '[WA] Imagem enviada com sucesso')
    return result
  } catch (err) {
    logger.error({ jid, err: err.message, stack: err.stack }, '[WA] ERRO ao enviar imagem')
    throw err
  }
}

export async function setPresenceTyping(jid, durationMs) {
  if (!sock || !sock.user) return
  logger.debug({ jid, durationMs }, '[WA] Simulando digitação')
  try {
    await sock.sendPresenceUpdate('composing', jid)
    await new Promise(r => setTimeout(r, durationMs))
    await sock.sendPresenceUpdate('paused', jid)
  } catch (err) {
    logger.warn({ jid, err: err.message }, '[WA] Erro ao simular digitação (não crítico)')
  }
}

export async function checkOnWhatsApp(phone) {
  if (!sock || !sock.user) {
    logger.warn({ phone }, '[WA] checkOnWhatsApp: sock não disponível')
    return true
  }
  try {
    const jid = phone.replace('+', '') + '@s.whatsapp.net'
    logger.info({ phone, jid }, '[WA] Verificando se número está no WhatsApp')
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    const check = sock.onWhatsApp(jid)
    const [result] = await Promise.race([check, timeout])
    const exists = result?.exists || false
    logger.info({ phone, exists }, '[WA] Resultado da verificação do número')
    return exists
  } catch (err) {
    logger.warn({ phone, err: err.message }, '[WA] checkOnWhatsApp falhou — assumindo que existe')
    return true
  }
}
