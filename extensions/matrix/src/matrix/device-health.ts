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

const COREBLOW_DEVICE_NAME_PREFIX = "CoreBlow ";

export function isCoreBlowManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(COREBLOW_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const coreBlowDevices = devices.filter((device) =>
    isCoreBlowManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleCoreBlowDevices: coreBlowDevices.filter((device) => !device.current),
    currentCoreBlowDevices: coreBlowDevices.filter((device) => device.current),
  };
}
