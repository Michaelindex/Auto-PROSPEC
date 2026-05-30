import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
})

// WhatsApp
export const getWhatsAppStatus = () => api.get('/whatsapp/status')
export const logoutWhatsApp = () => api.post('/whatsapp/logout')

// Settings
export const getSettings = () => api.get('/settings')
export const updateSettings = (data) => api.put('/settings', data)

// Contacts
export const uploadContacts = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/contacts/upload', fd)
}
export const getContacts = (params) => api.get('/contacts', { params })
export const deleteContact = (id) => api.delete(`/contacts/${id}`)

// Campaigns
export const getCampaigns = () => api.get('/campaigns')
export const getCampaign = (id) => api.get(`/campaigns/${id}`)
export const createCampaign = (formData) => api.post('/campaigns', formData)
export const updateCampaign = (id, formData) => api.put(`/campaigns/${id}`, formData)
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`)
export const startCampaign = (id) => api.post(`/campaigns/${id}/start`)
export const pauseCampaign = (id) => api.post(`/campaigns/${id}/pause`)
export const resumeCampaign = (id) => api.post(`/campaigns/${id}/resume`)
export const cancelCampaign = (id) => api.post(`/campaigns/${id}/cancel`)
export const getCampaignContacts = (id, params) => api.get(`/campaigns/${id}/contacts`, { params })
export const getCampaignLogs = (id, params) => api.get(`/campaigns/${id}/logs`, { params })
export const getCampaignReplies = (id) => api.get(`/campaigns/${id}/replies`)
export const exportLogs = (id) => `${api.defaults.baseURL}/campaigns/${id}/export/logs.csv`
export const exportErrors = (id) => `${api.defaults.baseURL}/campaigns/${id}/export/errors.csv`
export const reorderQueue = (orderedIds) => api.put('/campaigns/queue/reorder', { orderedIds })

export default api
