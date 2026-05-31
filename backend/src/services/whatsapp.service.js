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
    if (!msg.message || msg.key.fromMe) continue
    if (isJidBroadcast(msg.key.remoteJid)) continue

    const phone = '+' + msg.key.remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    const fromName = msg.pushName || null
    const content =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      '[mídia]'

    logger.info({ phone, content }, 'Mensagem recebida')

    // Find if phone is in any active campaign
    const campaignContact = await prisma.campaignContact.findFirst({
      where: {
        contact: { phone },
        status: { in: ['in_progress', 'completed', 'pending'] },
        campaign: { status: { in: ['running', 'pausing', 'paused'] } }
      },
      include: { campaign: true }
    })

    const campaignId = campaignContact?.campaignId || null

    await prisma.incomingMessage.create({
      data: { fromPhone: phone, fromName, content, campaignId }
    })

    if (campaignContact) {
      await prisma.campaignContact.update({
        where: { id: campaignContact.id },
        data: { repliedAt: new Date(), status: 'replied' }
      })

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { repliedCount: { increment: 1 } }
      })

      io?.emit('campaign:reply_received', {
        campaignId,
        contactId: campaignContact.contactId,
        phone,
        content,
        receivedAt: new Date().toISOString()
      })
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

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') await onMessage(messages)
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
