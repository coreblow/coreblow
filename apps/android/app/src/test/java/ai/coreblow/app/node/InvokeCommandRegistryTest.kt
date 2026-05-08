package ai.coreblow.app.node

import ai.coreblow.app.gateway.CoreBlowProtocol
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {

    @Test
    fun `all flags disabled returns minimal capabilities`() {
        val flags = NodeRuntimeFlags()
        val caps = InvokeCommandRegistry.availableCapabilities(flags)
        assertTrue(caps.contains(CoreBlowProtocol.CAP_DEVICE))
        assertTrue(caps.contains(CoreBlowProtocol.CAP_SYSTEM))
        assertTrue(caps.contains(CoreBlowProtocol.CAP_CONTACTS))
        assertFalse(caps.contains(CoreBlowProtocol.CAP_CAMERA))
        assertFalse(caps.contains(CoreBlowProtocol.CAP_LOCATION))
        assertFalse(caps.contains(CoreBlowProtocol.CAP_VOICE_WAKE))
    }

    @Test
    fun `camera enabled adds camera capability`() {
        val flags = NodeRuntimeFlags(cameraEnabled = true)
        assertTrue(InvokeCommandRegistry.availableCapabilities(flags).contains(CoreBlowProtocol.CAP_CAMERA))
    }

    @Test
    fun `location enabled adds location capability`() {
        val flags = NodeRuntimeFlags(locationEnabled = true)
        assertTrue(InvokeCommandRegistry.availableCapabilities(flags).contains(CoreBlowProtocol.CAP_LOCATION))
    }

    @Test
    fun `voice wake enabled adds voice-wake capability`() {
        val flags = NodeRuntimeFlags(voiceWakeEnabled = true)
        assertTrue(InvokeCommandRegistry.availableCapabilities(flags).contains(CoreBlowProtocol.CAP_VOICE_WAKE))
    }

    @Test
    fun `all flags enabled returns all capabilities`() {
        val flags = NodeRuntimeFlags(
            cameraEnabled = true, locationEnabled = true,
            sendSmsAvailable = true, readSmsAvailable = true,
            callLogAvailable = true, voiceWakeEnabled = true,
            motionActivityAvailable = true, notificationsAvailable = true,
            debugBuild = true,
        )
        val caps = InvokeCommandRegistry.availableCapabilities(flags)
        assertTrue(caps.size >= 13)
    }

    @Test
    fun `commands contain namespace dot command format`() {
        val flags = NodeRuntimeFlags(debugBuild = true)
        val cmds = InvokeCommandRegistry.availableCommands(flags)
        cmds.forEach { cmd ->
            assertTrue("Command must be namespace.command: $cmd", cmd.contains("."))
        }
    }

    @Test
    fun `debug commands only available in debug build`() {
        val release = InvokeCommandRegistry.availableCommands(NodeRuntimeFlags(debugBuild = false))
        val debug = InvokeCommandRegistry.availableCommands(NodeRuntimeFlags(debugBuild = true))
        assertFalse(release.any { it.startsWith("debug.") })
        assertTrue(debug.any { it.startsWith("debug.") })
    }

    @Test
    fun `device commands always available`() {
        val cmds = InvokeCommandRegistry.availableCommands(NodeRuntimeFlags())
        assertTrue(cmds.contains("device.get-info"))
        assertTrue(cmds.contains("device.get-battery"))
        assertTrue(cmds.contains("device.get-storage"))
    }

    // ── OC-parity: motion subcommand gating ─────────────

    @Test
    fun `motion activity available without pedometer only includes activity command`() {
        val cmds = InvokeCommandRegistry.availableCommands(NodeRuntimeFlags(
            motionActivityAvailable = true, motionPedometerAvailable = false,
        ))
        assertTrue(cmds.contains("motion.get-activity"))
        assertFalse(cmds.contains("motion.get-pedometer"))
    }

    @Test
    fun `motion pedometer available without activity only includes pedometer command`() {
        val cmds = InvokeCommandRegistry.availableCommands(NodeRuntimeFlags(
            motionActivityAvailable = false, motionPedometerAvailable = true,
        ))
        assertFalse(cmds.contains("motion.get-activity"))
        assertTrue(cmds.contains("motion.get-pedometer"))
    }

    @Test
    fun `motion capability present when either motion path available`() {
        val activityOnly = InvokeCommandRegistry.availableCapabilities(NodeRuntimeFlags(motionActivityAvailable = true))
        val pedometerOnly = InvokeCommandRegistry.availableCapabilities(NodeRuntimeFlags(motionPedometerAvailable = true))
        assertTrue(activityOnly.contains(CoreBlowProtocol.CAP_MOTION))
        assertTrue(pedometerOnly.contains(CoreBlowProtocol.CAP_MOTION))
    }

    // ── OC-parity: SMS send/read split ──────────────────

    @Test
    fun `sms read only includes search but not send`() {
        val cmds = InvokeCommandRegistry.availableCommands(NodeRuntimeFlags(readSmsAvailable = true))
        assertTrue(cmds.contains("sms.search"))
        assertFalse(cmds.contains("sms.send"))
    }

    @Test
    fun `sms send only includes send but not search`() {
        val cmds = InvokeCommandRegistry.availableCommands(NodeRuntimeFlags(sendSmsAvailable = true))
        assertTrue(cmds.contains("sms.send"))
        assertFalse(cmds.contains("sms.search"))
    }

    @Test
    fun `sms capability present when either sms path available`() {
        val readOnly = InvokeCommandRegistry.availableCapabilities(NodeRuntimeFlags(readSmsAvailable = true))
        val sendOnly = InvokeCommandRegistry.availableCapabilities(NodeRuntimeFlags(sendSmsAvailable = true))
        assertTrue(readOnly.contains(CoreBlowProtocol.CAP_SMS))
        assertTrue(sendOnly.contains(CoreBlowProtocol.CAP_SMS))
    }

    // ── OC-parity: call log gating ──────────────────────

    @Test
    fun `call log commands excluded when unavailable`() {
        val cmds = InvokeCommandRegistry.availableCommands(NodeRuntimeFlags(callLogAvailable = false))
        assertFalse(cmds.contains("callLog.search"))
    }

    @Test
    fun `call log capability excluded when unavailable`() {
        val caps = InvokeCommandRegistry.availableCapabilities(NodeRuntimeFlags(callLogAvailable = false))
        assertFalse(caps.contains(CoreBlowProtocol.CAP_CALL_LOG))
    }

    @Test
    fun `call log capability included when available`() {
        val caps = InvokeCommandRegistry.availableCapabilities(NodeRuntimeFlags(callLogAvailable = true))
        assertTrue(caps.contains(CoreBlowProtocol.CAP_CALL_LOG))
    }

    // ── OC-parity: core commands always present ─────────

    @Test
    fun `core capabilities always include canvas device notifications system`() {
        val caps = InvokeCommandRegistry.availableCapabilities(NodeRuntimeFlags())
        val coreSet = setOf(CoreBlowProtocol.CAP_CANVAS, CoreBlowProtocol.CAP_DEVICE, CoreBlowProtocol.CAP_NOTIFICATIONS, CoreBlowProtocol.CAP_SYSTEM)
        coreSet.forEach { cap -> assertTrue("Missing core capability: $cap", caps.contains(cap)) }
    }

    @Test
    fun `optional capabilities absent by default`() {
        val caps = InvokeCommandRegistry.availableCapabilities(NodeRuntimeFlags())
        val optionalSet = setOf(CoreBlowProtocol.CAP_CAMERA, CoreBlowProtocol.CAP_LOCATION, CoreBlowProtocol.CAP_SMS, CoreBlowProtocol.CAP_CALL_LOG, CoreBlowProtocol.CAP_VOICE_WAKE, CoreBlowProtocol.CAP_MOTION)
        optionalSet.forEach { cap -> assertFalse("Unexpected optional capability: $cap", caps.contains(cap)) }
    }

    // ── Helpers ──────────────────────────────────────────

    private fun NodeRuntimeFlags(
        cameraEnabled: Boolean = false, locationEnabled: Boolean = false,
        sendSmsAvailable: Boolean = false, readSmsAvailable: Boolean = false,
        callLogAvailable: Boolean = false, voiceWakeEnabled: Boolean = false,
        motionActivityAvailable: Boolean = false, motionPedometerAvailable: Boolean = false,
        notificationsAvailable: Boolean = true, debugBuild: Boolean = false,
    ) = ai.coreblow.app.node.NodeRuntimeFlags(
        cameraEnabled = cameraEnabled, locationEnabled = locationEnabled,
        sendSmsAvailable = sendSmsAvailable, readSmsAvailable = readSmsAvailable,
        callLogAvailable = callLogAvailable, voiceWakeEnabled = voiceWakeEnabled,
        motionActivityAvailable = motionActivityAvailable, motionPedometerAvailable = motionPedometerAvailable,
        notificationsAvailable = notificationsAvailable, debugBuild = debugBuild,
    )
}
