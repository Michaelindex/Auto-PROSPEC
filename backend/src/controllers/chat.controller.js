import * as chatService from '../services/chat.service.js'

export async function getSummary(req, res) {
  try {
    res.json(await chatService.getChatSummary())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function getCampaignContacts(req, res) {
  try {
    const { campaignId } = req.params
    const { page, limit } = req.query
    res.json(await chatService.getCampaignContacts(campaignId, { page, limit }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function getMessages(req, res) {
  try {
    const { campaignId, contactId } = req.params
    const { page, limit } = req.query
    res.json(await chatService.getMessages(campaignId, contactId, { page, limit }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function sendMessage(req, res) {
  try {
    const { campaignId, contactId } = req.params
    const content = req.body.content || null
    const mediaCaption = req.body.mediaCaption || null
    const mediaPath = req.file ? req.file.path : null
    const mediaType = req.file ? resolveMediaType(req.file.mimetype) : null

    if (!content && !mediaPath) {
      return res.status(400).json({ error: 'Conteúdo ou mídia obrigatório' })
    }

    const message = await chatService.sendManualMessage(campaignId, contactId, {
      content, mediaPath, mediaType, mediaCaption
    })
    res.json({ message })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function markAsRead(req, res) {
  try {
    const { campaignId, contactId } = req.params
    await chatService.markConversationRead(campaignId, contactId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function refreshProfilePicture(req, res) {
  try {
    const url = await chatService.refreshContactProfilePicture(req.params.id)
    res.json({ profilePictureUrl: url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

function resolveMediaType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('video/')) return 'video'
  if (mimetype.startsWith('audio/')) return 'audio'
  return 'document'
}
