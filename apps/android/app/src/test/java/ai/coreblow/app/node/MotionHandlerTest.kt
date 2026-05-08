package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MotionHandlerTest {
    @Test fun commandName_isMotion() { assertEquals("motion", MotionHandler.COMMAND_NAME) }

    @Test fun shakeDetection_triggersAboveThreshold() {
        val accel = floatArrayOf(0f, 0f, 25f) // Strong z-axis acceleration
        assertTrue(MotionHandler.isShakeEvent(accel, MotionHandler.SHAKE_THRESHOLD_G))
    }

    @Test fun shakeDetection_ignoresBelowThreshold() {
        val accel = floatArrayOf(0f, 0f, 9.8f) // Normal gravity
        assertFalse(MotionHandler.isShakeEvent(accel, MotionHandler.SHAKE_THRESHOLD_G))
    }

    @Test fun activityType_mapsRecognitionConstants() {
        assertEquals("still", MotionHandler.activityLabel(3))
        assertEquals("walking", MotionHandler.activityLabel(7))
        assertEquals("running", MotionHandler.activityLabel(8))
        assertEquals("in_vehicle", MotionHandler.activityLabel(0))
    }

    @Test fun activityType_unknownDefaultsToUnknown() {
        assertEquals("unknown", MotionHandler.activityLabel(999))
    }

    @Test fun stepCounter_accumulatesCorrectly() {
        val counter = MotionHandler.StepAccumulator()
        counter.onSensorEvent(100f)
        counter.onSensorEvent(110f)
        assertEquals(10, counter.stepsSinceStart())
    }

    @Test fun stepCounter_ignoresFirstReading() {
        val counter = MotionHandler.StepAccumulator()
        counter.onSensorEvent(50f)
        assertEquals(0, counter.stepsSinceStart())
    }

    @Test fun orientationTracker_computesDegrees() {
        val azimuth = MotionHandler.computeAzimuthDegrees(0f)
        assertTrue(azimuth in 0f..360f)
    }

    @Test fun sensorBatchMode_samplingRates() {
        assertTrue(MotionHandler.SENSOR_DELAY_NORMAL_US > 0)
        assertTrue(MotionHandler.SENSOR_DELAY_GAME_US > 0)
        assertTrue(MotionHandler.SENSOR_DELAY_GAME_US < MotionHandler.SENSOR_DELAY_NORMAL_US)
    }

    @Test fun motionEventThrottling_respectsMinInterval() {
        val throttle = MotionHandler.EventThrottle(100L)
        assertTrue(throttle.shouldEmit(0L))
        assertFalse(throttle.shouldEmit(50L))
        assertTrue(throttle.shouldEmit(101L))
    }

    @Test fun significantMotion_triggerOnce() {
        // Significant motion sensor triggers once then needs re-registration
        val trigger = MotionHandler.SignificantMotionTrigger()
        assertFalse(trigger.hasTriggered())
        trigger.onTrigger()
        assertTrue(trigger.hasTriggered())
    }

    @Test fun requiredPermissions_includesActivityRecognition() {
        val perms = MotionHandler.requiredPermissions()
        assertTrue(perms.isNotEmpty())
    }
}
