/**
 * Stub for @whiskeysockets/baileys
 * Used by extensions/whatsapp — stubbed for unit tests that
 * transitively import the WhatsApp session module.
 */
export const makeWASocket = () => ({});
export const DisconnectReason = {};
export const fetchLatestBaileysVersion = async () => ({ version: [2, 2413, 1] });
export const useMultiFileAuthState = async () => ({
  state: {},
  saveCreds: async () => {},
});
export const proto = {};
export const WAProto = {};
export const Browsers = { ubuntu: () => ['CoreBlow', 'Chrome', '114.0.0'] };
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const generateMessageID = () => 'stub-msg-id';
export const jidNormalizedUser = (jid: string) => jid;
export const isJidGroup = (jid: string) => jid.endsWith('@g.us');
export const isJidUser = (jid: string) => jid.endsWith('@s.whatsapp.net');
export const isJidStatusBroadcast = (jid: string) => jid === 'status@broadcast';
export const getContentType = () => 'conversation';
export const downloadMediaMessage = async () => Buffer.from('');
export default makeWASocket;
