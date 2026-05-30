import { create } from 'zustand'

export const useCampaignsStore = create((set, get) => ({
  campaigns: [],
  loading: false,

  setCampaigns: (campaigns) => set({ campaigns }),

  updateCampaign: (campaignId, data) => set(state => ({
    campaigns: state.campaigns.map(c =>
      c.id === campaignId ? { ...c, ...data } : c
    )
  })),

  removeCampaign: (campaignId) => set(state => ({
    campaigns: state.campaigns.filter(c => c.id !== campaignId)
  })),

  addCampaign: (campaign) => set(state => ({
    campaigns: [campaign, ...state.campaigns]
  })),

  setLoading: (loading) => set({ loading })
}))
