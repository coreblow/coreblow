/** CoreBlow — Bonjour Ciao (shutdown) */
import { getDefaultDiscovery } from './bonjour-discovery.js';
export function ciaoBonjourServices(): void { getDefaultDiscovery().clear(); }
