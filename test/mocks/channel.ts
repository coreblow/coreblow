export class MockChannel { async send(msg: string) { return { sent: true }; } async receive() { return { content: 'mock' }; } }
