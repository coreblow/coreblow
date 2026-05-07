package ai.coreblow.app

/**
 * Transient HUD state shown when the camera captures or records.
 */
enum class CameraHudKind {
    Photo,
    Recording,
    Success,
    Error,
}

data class CameraHudState(
    val token: Long,
    val kind: CameraHudKind,
    val message: String,
)
