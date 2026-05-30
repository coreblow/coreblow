import { configureFsSafePython } from "./fs-pinned-write-helper.js";

const hasPythonModeOverride =
  process.env.FS_SAFE_PYTHON_MODE != null || process.env.COREBLOW_FS_SAFE_PYTHON_MODE != null;

if (!hasPythonModeOverride) {
  configureFsSafePython({ mode: "off" });
}
