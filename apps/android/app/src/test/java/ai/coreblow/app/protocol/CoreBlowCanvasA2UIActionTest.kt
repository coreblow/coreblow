package ai.coreblow.app.protocol

import ai.coreblow.app.node.handlers.CanvasActionTrust
import ai.coreblow.app.node.handlers.CanvasActionTrustEvaluator
import org.junit.Assert.*
import org.junit.Test

class CoreBlowCanvasA2UIActionTest {
    @Test fun `set-title is safe`() = assertTrue(CanvasActionTrustEvaluator.isSafe("set-title"))
    @Test fun `update-badge is safe`() = assertTrue(CanvasActionTrustEvaluator.isSafe("update-badge"))
    @Test fun `download-file requires prompt`() = assertEquals(CanvasActionTrust.PROMPT, CanvasActionTrustEvaluator.evaluate("download-file"))
    @Test fun `screenshot requires prompt`() = assertEquals(CanvasActionTrust.PROMPT, CanvasActionTrustEvaluator.evaluate("screenshot"))
    @Test fun `access-storage is denied`() = assertEquals(CanvasActionTrust.DENY, CanvasActionTrustEvaluator.evaluate("access-storage"))
    @Test fun `modify-settings is denied`() = assertEquals(CanvasActionTrust.DENY, CanvasActionTrustEvaluator.evaluate("modify-settings"))
}
