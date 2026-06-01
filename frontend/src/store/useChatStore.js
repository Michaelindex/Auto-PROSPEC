import { create } from 'zustand'

export const useChatStore = create((set, get) => ({
  totalUnread: 0,
  campaignsSummary: [],
  // contacts: { [campaignId]: { [contactId]: contactData } }
  contacts: {},
  // messages: { [`${campaignId}-${contactId}`]: message[] }
  messages: {},
  hasMore: {},

  setTotalUnread: (totalUnread) => set({ totalUnread }),

  setCampaignsSummary: (campaigns) => set({
    campaignsSummary: campaigns,
    totalUnread: campaigns.reduce((sum, c) => sum + c.unreadCount, 0)
  }),

  updateCampaignUnread: (campaignId, unreadCount) => set(state => ({
    campaignsSummary: state.campaignsSummary.map(c =>
      c.campaignId === campaignId ? { ...c, unreadCount } : c
    )
  })),

  setContacts: (campaignId, contacts) => set(state => ({
    contacts: {
      ...state.contacts,
      [campaignId]: Object.fromEntries(contacts.map(c => [c.contactId, c]))
    }
  })),

  updateContactUnread: (campaignId, contactId, unreadCount) => set(state => ({
    contacts: {
      ...state.contacts,
      [campaignId]: {
        ...state.contacts[campaignId],
        [contactId]: { ...state.contacts[campaignId]?.[contactId], unreadCount }
      }
    }
  })),

  updateContactLastMessage: (campaignId, contactId, message) => set(state => ({
    contacts: {
      ...state.contacts,
      [campaignId]: {
        ...state.contacts[campaignId],
        [contactId]: {
          ...state.contacts[campaignId]?.[contactId],
          lastMessage: message.content || `[${message.mediaType || 'mídia'}]`,
          lastMessageAt: message.sentAt,
          lastMessageDirection: message.direction,
          lastMessageStatus: message.status
        }
      }
    }
  })),

  setMessages: (key, messages, hasMore = false) => set(state => ({
    messages: { ...state.messages, [key]: messages },
    hasMore: { ...state.hasMore, [key]: hasMore }
  })),

  appendMessage: (key, message) => set(state => ({
    messages: {
      ...state.messages,
      [key]: [...(state.messages[key] || []), message]
    }
  })),

  prependMessages: (key, messages, hasMore = false) => set(state => ({
    messages: {
      ...state.messages,
      [key]: [...messages, ...(state.messages[key] || [])]
    },
    hasMore: { ...state.hasMore, [key]: hasMore }
  })),

  updateMessageStatus: (key, messageId, statusData) => set(state => ({
    messages: {
      ...state.messages,
      [key]: (state.messages[key] || []).map(m =>
        m.id === messageId ? { ...m, ...statusData } : m
      )
    }
  }))
}))
