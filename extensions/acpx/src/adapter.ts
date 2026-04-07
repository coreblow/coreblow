/**
 * Acpx Channel Adapter
 */
export class AcpxAdapter {
  private connected = false;

  async connect() {
    this.connected = true;
    return this;
  }

  async disconnect() {
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }

  async send(channelId: string, message: string) {
    if (!this.connected) throw new Error('Not connected');
    return { channelId, sent: true };
  }

  async fetchMessages(channelId: string, limit = 50) {
    return [];
  }
}
