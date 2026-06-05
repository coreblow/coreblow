export type DebugProxyCertificateAuthority = {
  commonName: string;
  certPem: string;
  keyPem: string;
};

export function createDebugProxyCertificateAuthority(): DebugProxyCertificateAuthority {
  throw new Error("CoreBlow debug proxy certificate generation is not available in this build.");
}
