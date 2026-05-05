package ai.coreblow.app.node

import org.junit.Assert.*
import org.junit.Test

class CanvasActionTrustTest {
    @Test fun `render-html is allowed`() = assertEquals(ai.coreblow.app.node.handlers.CanvasActionTrust.ALLOW, ai.coreblow.app.node.handlers.CanvasActionTrustEvaluator.evaluate("render-html"))
    @Test fun `show-toast is allowed`() = assertTrue(ai.coreblow.app.node.handlers.CanvasActionTrustEvaluator.isSafe("show-toast"))
    @Test fun `navigate-url requires prompt`() = assertEquals(ai.coreblow.app.node.handlers.CanvasActionTrust.PROMPT, ai.coreblow.app.node.handlers.CanvasActionTrustEvaluator.evaluate("navigate-url"))
    @Test fun `execute-js is denied`() = assertEquals(ai.coreblow.app.node.handlers.CanvasActionTrust.DENY, ai.coreblow.app.node.handlers.CanvasActionTrustEvaluator.evaluate("execute-js"))
    @Test fun `unknown action defaults to prompt`() = assertEquals(ai.coreblow.app.node.handlers.CanvasActionTrust.PROMPT, ai.coreblow.app.node.handlers.CanvasActionTrustEvaluator.evaluate("unknown-action"))
    @Test fun `isSafe false for denied`() = assertFalse(ai.coreblow.app.node.handlers.CanvasActionTrustEvaluator.isSafe("execute-js"))
}
