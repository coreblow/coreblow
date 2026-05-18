package ai.coreblow.app.node

import ai.coreblow.app.protocol.CoreBlowCalendarCommand
import ai.coreblow.app.protocol.CoreBlowCameraCommand
import ai.coreblow.app.protocol.CoreBlowCallLogCommand
import ai.coreblow.app.protocol.CoreBlowCapability
import ai.coreblow.app.protocol.CoreBlowContactsCommand
import ai.coreblow.app.protocol.CoreBlowDeviceCommand
import ai.coreblow.app.protocol.CoreBlowLocationCommand
import ai.coreblow.app.protocol.CoreBlowMotionCommand
import ai.coreblow.app.protocol.CoreBlowNotificationsCommand
import ai.coreblow.app.protocol.CoreBlowPhotosCommand
import ai.coreblow.app.protocol.CoreBlowSmsCommand
import ai.coreblow.app.protocol.CoreBlowSystemCommand
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      CoreBlowCapability.Canvas.rawValue,
      CoreBlowCapability.Device.rawValue,
      CoreBlowCapability.Notifications.rawValue,
      CoreBlowCapability.System.rawValue,
      CoreBlowCapability.Photos.rawValue,
      CoreBlowCapability.Contacts.rawValue,
      CoreBlowCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      CoreBlowCapability.Camera.rawValue,
      CoreBlowCapability.Location.rawValue,
      CoreBlowCapability.Sms.rawValue,
      CoreBlowCapability.CallLog.rawValue,
      CoreBlowCapability.VoiceWake.rawValue,
      CoreBlowCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      CoreBlowDeviceCommand.Status.rawValue,
      CoreBlowDeviceCommand.Info.rawValue,
      CoreBlowDeviceCommand.Permissions.rawValue,
      CoreBlowDeviceCommand.Health.rawValue,
      CoreBlowNotificationsCommand.List.rawValue,
      CoreBlowNotificationsCommand.Actions.rawValue,
      CoreBlowSystemCommand.Notify.rawValue,
      CoreBlowPhotosCommand.Latest.rawValue,
      CoreBlowContactsCommand.Search.rawValue,
      CoreBlowContactsCommand.Add.rawValue,
      CoreBlowCalendarCommand.Events.rawValue,
      CoreBlowCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      CoreBlowCameraCommand.Snap.rawValue,
      CoreBlowCameraCommand.Clip.rawValue,
      CoreBlowCameraCommand.List.rawValue,
      CoreBlowLocationCommand.Get.rawValue,
      CoreBlowMotionCommand.Activity.rawValue,
      CoreBlowMotionCommand.Pedometer.rawValue,
      CoreBlowSmsCommand.Send.rawValue,
      CoreBlowSmsCommand.Search.rawValue,
      CoreBlowCallLogCommand.Search.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          callLogAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          callLogAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          callLogAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(CoreBlowMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(CoreBlowMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )

    assertTrue(readOnlyCommands.contains(CoreBlowSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(CoreBlowSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(CoreBlowSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(CoreBlowSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )

    assertTrue(readOnlyCapabilities.contains(CoreBlowCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(CoreBlowCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(CoreBlowCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(CoreBlowCapability.CallLog.rawValue))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    callLogAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      callLogAvailable = callLogAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(actual: List<String>, expected: Set<String>) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(actual: List<String>, forbidden: Set<String>) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
