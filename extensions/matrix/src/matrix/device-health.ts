export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleCoreBlowDevices: MatrixManagedDeviceInfo[];
  currentCoreBlowDevices: MatrixManagedDeviceInfo[];
};

const OPENCLAW_DEVICE_NAME_PREFIX = "CoreBlow ";

export function isCoreBlowManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(OPENCLAW_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const openClawDevices = devices.filter((device) =>
    isCoreBlowManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleCoreBlowDevices: openClawDevices.filter((device) => !device.current),
    currentCoreBlowDevices: openClawDevices.filter((device) => device.current),
  };
}
