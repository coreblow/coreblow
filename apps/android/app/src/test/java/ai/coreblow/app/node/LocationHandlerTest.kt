package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LocationHandlerTest {
    @Test fun commandName_isLocation() { assertEquals("location", LocationHandler.COMMAND_NAME) }

    @Test fun parseLocationResponse_extractsCoordinates() {
        val json = """{"latitude":37.7749,"longitude":-122.4194,"accuracy":10.0,"timestamp":"2026-01-01T00:00:00Z"}"""
        val loc = LocationHandler.parseLocationResponse(json)
        assertNotNull(loc)
        assertEquals(37.7749, loc!!.latitude, 0.001)
        assertEquals(-122.4194, loc.longitude, 0.001)
    }

    @Test fun parseLocationResponse_handlesOptionalAltitude() {
        val json = """{"latitude":0.0,"longitude":0.0,"accuracy":5.0,"altitude":100.5}"""
        val loc = LocationHandler.parseLocationResponse(json)
        assertEquals(100.5, loc?.altitude ?: 0.0, 0.1)
    }

    @Test fun locationMode_mapsStrings() {
        assertEquals(LocationHandler.Mode.HighAccuracy, LocationHandler.parseMode("high_accuracy"))
        assertEquals(LocationHandler.Mode.Balanced, LocationHandler.parseMode("balanced"))
        assertEquals(LocationHandler.Mode.LowPower, LocationHandler.parseMode("low_power"))
    }

    @Test fun locationMode_unknownDefaultsToBalanced() {
        assertEquals(LocationHandler.Mode.Balanced, LocationHandler.parseMode("unknown"))
        assertEquals(LocationHandler.Mode.Balanced, LocationHandler.parseMode(null))
    }

    @Test fun isValidCoordinate_latitude() {
        assertTrue(LocationHandler.isValidLatitude(0.0))
        assertTrue(LocationHandler.isValidLatitude(90.0))
        assertTrue(LocationHandler.isValidLatitude(-90.0))
        assertFalse(LocationHandler.isValidLatitude(91.0))
        assertFalse(LocationHandler.isValidLatitude(-91.0))
    }

    @Test fun isValidCoordinate_longitude() {
        assertTrue(LocationHandler.isValidLongitude(0.0))
        assertTrue(LocationHandler.isValidLongitude(180.0))
        assertTrue(LocationHandler.isValidLongitude(-180.0))
        assertFalse(LocationHandler.isValidLongitude(181.0))
    }

    @Test fun requiredPermissions_includesLocation() {
        val perms = LocationHandler.requiredPermissions()
        assertTrue(perms.isNotEmpty())
    }

    @Test fun parseLocationResponse_extractsAccuracy() {
        val json = """{"latitude":0.0,"longitude":0.0,"accuracy":15.5}"""
        val loc = LocationHandler.parseLocationResponse(json)
        assertEquals(15.5, loc!!.accuracy, 0.1)
    }

    @Test fun parseLocationResponse_extractsSpeed() {
        val json = """{"latitude":0.0,"longitude":0.0,"accuracy":5.0,"speed":2.5}"""
        val loc = LocationHandler.parseLocationResponse(json)
        assertEquals(2.5, loc?.speed ?: 0.0, 0.1)
    }

    @Test fun parseLocationResponse_extractsHeading() {
        val json = """{"latitude":0.0,"longitude":0.0,"accuracy":5.0,"heading":270.0}"""
        val loc = LocationHandler.parseLocationResponse(json)
        assertEquals(270.0, loc?.heading ?: 0.0, 0.1)
    }

    @Test fun distanceBetween_samePoint_isZero() {
        val d = LocationHandler.distanceBetween(37.7749, -122.4194, 37.7749, -122.4194)
        assertEquals(0.0, d, 0.1)
    }

    @Test fun distanceBetween_knownPoints_isReasonable() {
        // SF to LA is roughly 559 km
        val d = LocationHandler.distanceBetween(37.7749, -122.4194, 34.0522, -118.2437)
        assertTrue(d > 500_000.0) // > 500km in meters
        assertTrue(d < 700_000.0) // < 700km
    }
}
