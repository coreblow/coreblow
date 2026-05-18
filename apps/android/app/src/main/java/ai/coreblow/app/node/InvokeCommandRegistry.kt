package ai.coreblow.app.node

import ai.coreblow.app.protocol.CoreBlowCalendarCommand
import ai.coreblow.app.protocol.CoreBlowCanvasA2UICommand
import ai.coreblow.app.protocol.CoreBlowCanvasCommand
import ai.coreblow.app.protocol.CoreBlowCameraCommand
import ai.coreblow.app.protocol.CoreBlowCapability
import ai.coreblow.app.protocol.CoreBlowCallLogCommand
import ai.coreblow.app.protocol.CoreBlowContactsCommand
import ai.coreblow.app.protocol.CoreBlowDeviceCommand
import ai.coreblow.app.protocol.CoreBlowLocationCommand
import ai.coreblow.app.protocol.CoreBlowMotionCommand
import ai.coreblow.app.protocol.CoreBlowNotificationsCommand
import ai.coreblow.app.protocol.CoreBlowPhotosCommand
import ai.coreblow.app.protocol.CoreBlowSmsCommand
import ai.coreblow.app.protocol.CoreBlowSystemCommand

data class NodeRuntimeFlags(
  val cameraEnabled: Boolean,
  val locationEnabled: Boolean,
  val sendSmsAvailable: Boolean,
  val readSmsAvailable: Boolean,
  val callLogAvailable: Boolean,
  val voiceWakeEnabled: Boolean,
  val motionActivityAvailable: Boolean,
  val motionPedometerAvailable: Boolean,
  val debugBuild: Boolean,
)

enum class InvokeCommandAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SendSmsAvailable,
  ReadSmsAvailable,
  CallLogAvailable,
  MotionActivityAvailable,
  MotionPedometerAvailable,
  DebugBuild,
}

enum class NodeCapabilityAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  CallLogAvailable,
  VoiceWakeEnabled,
  MotionAvailable,
}

data class NodeCapabilitySpec(
  val name: String,
  val availability: NodeCapabilityAvailability = NodeCapabilityAvailability.Always,
)

data class InvokeCommandSpec(
  val name: String,
  val requiresForeground: Boolean = false,
  val availability: InvokeCommandAvailability = InvokeCommandAvailability.Always,
)

object InvokeCommandRegistry {
  val capabilityManifest: List<NodeCapabilitySpec> =
    listOf(
      NodeCapabilitySpec(name = CoreBlowCapability.Canvas.rawValue),
      NodeCapabilitySpec(name = CoreBlowCapability.Device.rawValue),
      NodeCapabilitySpec(name = CoreBlowCapability.Notifications.rawValue),
      NodeCapabilitySpec(name = CoreBlowCapability.System.rawValue),
      NodeCapabilitySpec(
        name = CoreBlowCapability.Camera.rawValue,
        availability = NodeCapabilityAvailability.CameraEnabled,
      ),
      NodeCapabilitySpec(
        name = CoreBlowCapability.Sms.rawValue,
        availability = NodeCapabilityAvailability.SmsAvailable,
      ),
      NodeCapabilitySpec(
        name = CoreBlowCapability.VoiceWake.rawValue,
        availability = NodeCapabilityAvailability.VoiceWakeEnabled,
      ),
      NodeCapabilitySpec(
        name = CoreBlowCapability.Location.rawValue,
        availability = NodeCapabilityAvailability.LocationEnabled,
      ),
      NodeCapabilitySpec(name = CoreBlowCapability.Photos.rawValue),
      NodeCapabilitySpec(name = CoreBlowCapability.Contacts.rawValue),
      NodeCapabilitySpec(name = CoreBlowCapability.Calendar.rawValue),
      NodeCapabilitySpec(
        name = CoreBlowCapability.Motion.rawValue,
        availability = NodeCapabilityAvailability.MotionAvailable,
      ),
      NodeCapabilitySpec(
        name = CoreBlowCapability.CallLog.rawValue,
        availability = NodeCapabilityAvailability.CallLogAvailable,
      ),
    )

  val all: List<InvokeCommandSpec> =
    listOf(
      InvokeCommandSpec(
        name = CoreBlowCanvasCommand.Present.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = CoreBlowCanvasCommand.Hide.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = CoreBlowCanvasCommand.Navigate.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = CoreBlowCanvasCommand.Eval.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = CoreBlowCanvasCommand.Snapshot.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = CoreBlowCanvasA2UICommand.Push.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = CoreBlowCanvasA2UICommand.PushJSONL.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = CoreBlowCanvasA2UICommand.Reset.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = CoreBlowSystemCommand.Notify.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowCameraCommand.List.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = CoreBlowCameraCommand.Snap.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = CoreBlowCameraCommand.Clip.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = CoreBlowLocationCommand.Get.rawValue,
        availability = InvokeCommandAvailability.LocationEnabled,
      ),
      InvokeCommandSpec(
        name = CoreBlowDeviceCommand.Status.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowDeviceCommand.Info.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowDeviceCommand.Permissions.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowDeviceCommand.Health.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowNotificationsCommand.List.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowNotificationsCommand.Actions.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowPhotosCommand.Latest.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowContactsCommand.Search.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowContactsCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowCalendarCommand.Events.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowCalendarCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = CoreBlowMotionCommand.Activity.rawValue,
        availability = InvokeCommandAvailability.MotionActivityAvailable,
      ),
      InvokeCommandSpec(
        name = CoreBlowMotionCommand.Pedometer.rawValue,
        availability = InvokeCommandAvailability.MotionPedometerAvailable,
      ),
      InvokeCommandSpec(
        name = CoreBlowSmsCommand.Send.rawValue,
        availability = InvokeCommandAvailability.SendSmsAvailable,
      ),
      InvokeCommandSpec(
        name = CoreBlowSmsCommand.Search.rawValue,
        availability = InvokeCommandAvailability.ReadSmsAvailable,
      ),
      InvokeCommandSpec(
        name = CoreBlowCallLogCommand.Search.rawValue,
        availability = InvokeCommandAvailability.CallLogAvailable,
      ),
      InvokeCommandSpec(
        name = "debug.logs",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
      InvokeCommandSpec(
        name = "debug.ed25519",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
    )

  private val byNameInternal: Map<String, InvokeCommandSpec> = all.associateBy { it.name }

  fun find(command: String): InvokeCommandSpec? = byNameInternal[command]

  fun advertisedCapabilities(flags: NodeRuntimeFlags): List<String> {
    return capabilityManifest
      .filter { spec ->
        when (spec.availability) {
          NodeCapabilityAvailability.Always -> true
          NodeCapabilityAvailability.CameraEnabled -> flags.cameraEnabled
          NodeCapabilityAvailability.LocationEnabled -> flags.locationEnabled
          NodeCapabilityAvailability.SmsAvailable -> flags.sendSmsAvailable || flags.readSmsAvailable
          NodeCapabilityAvailability.CallLogAvailable -> flags.callLogAvailable
          NodeCapabilityAvailability.VoiceWakeEnabled -> flags.voiceWakeEnabled
          NodeCapabilityAvailability.MotionAvailable -> flags.motionActivityAvailable || flags.motionPedometerAvailable
        }
      }
      .map { it.name }
  }

  fun advertisedCommands(flags: NodeRuntimeFlags): List<String> {
    return all
      .filter { spec ->
        when (spec.availability) {
          InvokeCommandAvailability.Always -> true
          InvokeCommandAvailability.CameraEnabled -> flags.cameraEnabled
          InvokeCommandAvailability.LocationEnabled -> flags.locationEnabled
          InvokeCommandAvailability.SendSmsAvailable -> flags.sendSmsAvailable
          InvokeCommandAvailability.ReadSmsAvailable -> flags.readSmsAvailable
          InvokeCommandAvailability.CallLogAvailable -> flags.callLogAvailable
          InvokeCommandAvailability.MotionActivityAvailable -> flags.motionActivityAvailable
          InvokeCommandAvailability.MotionPedometerAvailable -> flags.motionPedometerAvailable
          InvokeCommandAvailability.DebugBuild -> flags.debugBuild
        }
      }
      .map { it.name }
  }
}
