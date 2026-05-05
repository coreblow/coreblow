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
}
