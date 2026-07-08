// frontend/src/js/pages/campaigns.js
requireAuth();

function campaignsPage() {
  return {
    campaigns: [],
    showForm: false,
    form: {
      name: '',
      advertiser: '',
      start_date: '',
      end_date: '',
      verification_enabled: false,
    },

    async init() {
      await this.loadCampaigns();
    },

    async loadCampaigns() {
      try {
        const data = await API.get('/api/campaigns');
        this.campaigns = data.campaigns;
      } catch (err) {
        console.error('Failed to load campaigns:', err);
      }
    },

    async createCampaign() {
      try {
        await API.post('/api/campaigns', this.form);
        this.showForm = false;
        this.form = { name: '', advertiser: '', start_date: '', end_date: '', verification_enabled: false };
        await this.loadCampaigns();
      } catch (err) {
        alert('Error al crear campana');
      }
    },
  };
}
