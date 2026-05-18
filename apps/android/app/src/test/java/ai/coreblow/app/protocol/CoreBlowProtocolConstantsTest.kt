package ai.coreblow.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class CoreBlowProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", CoreBlowCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", CoreBlowCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", CoreBlowCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", CoreBlowCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", CoreBlowCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", CoreBlowCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", CoreBlowCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", CoreBlowCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", CoreBlowCapability.Canvas.rawValue)
    assertEquals("camera", CoreBlowCapability.Camera.rawValue)
    assertEquals("voiceWake", CoreBlowCapability.VoiceWake.rawValue)
    assertEquals("location", CoreBlowCapability.Location.rawValue)
    assertEquals("sms", CoreBlowCapability.Sms.rawValue)
    assertEquals("device", CoreBlowCapability.Device.rawValue)
    assertEquals("notifications", CoreBlowCapability.Notifications.rawValue)
    assertEquals("system", CoreBlowCapability.System.rawValue)
    assertEquals("photos", CoreBlowCapability.Photos.rawValue)
    assertEquals("contacts", CoreBlowCapability.Contacts.rawValue)
    assertEquals("calendar", CoreBlowCapability.Calendar.rawValue)
    assertEquals("motion", CoreBlowCapability.Motion.rawValue)
    assertEquals("callLog", CoreBlowCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", CoreBlowCameraCommand.List.rawValue)
    assertEquals("camera.snap", CoreBlowCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", CoreBlowCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", CoreBlowNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", CoreBlowNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", CoreBlowDeviceCommand.Status.rawValue)
    assertEquals("device.info", CoreBlowDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", CoreBlowDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", CoreBlowDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", CoreBlowSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", CoreBlowPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", CoreBlowContactsCommand.Search.rawValue)
    assertEquals("contacts.add", CoreBlowContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", CoreBlowCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", CoreBlowCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", CoreBlowMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", CoreBlowMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", CoreBlowCallLogCommand.Search.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.search", CoreBlowSmsCommand.Search.rawValue)
  }
}
