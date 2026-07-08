// frontend/src/js/pages/verification.js
requireAuth();

function verificationPage() {
  return {
    verifications: [],
    filters: { is_correct: '' },

    async init() {
      await this.loadVerifications();
    },

    async loadVerifications() {
      try {
        let query = '?limit=50';
        if (this.filters.is_correct !== '') query += `&is_correct=${this.filters.is_correct}`;
        const data = await API.get('/api/verifications' + query);
        this.verifications = data.verifications;
      } catch (err) {
        console.error('Failed to load verifications:', err);
      }
    },
  };
}
