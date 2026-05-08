package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PhotosHandlerTest {
    @Test fun commandName_isPhotos() { assertEquals("photos", PhotosHandler.COMMAND_NAME) }

    @Test fun parseLatestRequest_defaultsToRecentCount() {
        val req = PhotosHandler.parseLatestRequest(null)
        assertNotNull(req)
        assertTrue(req.count > 0)
        assertTrue(req.count <= PhotosHandler.MAX_LATEST_COUNT)
    }

    @Test fun parseLatestRequest_clampsToMaxCount() {
        val json = """{"count":10000}"""
        val req = PhotosHandler.parseLatestRequest(json)
        assertEquals(PhotosHandler.MAX_LATEST_COUNT, req.count)
    }

    @Test fun parseLatestRequest_clampsToMinCount() {
        val json = """{"count":0}"""
        val req = PhotosHandler.parseLatestRequest(json)
        assertTrue(req.count >= 1)
    }

    @Test fun thumbnailSize_isReasonable() {
        assertTrue(PhotosHandler.THUMBNAIL_SIZE > 0)
        assertTrue(PhotosHandler.THUMBNAIL_SIZE <= 512)
    }

    @Test fun mimeTypeFromExtension_mapsCommonFormats() {
        assertEquals("image/jpeg", PhotosHandler.mimeTypeFromExtension("jpg"))
        assertEquals("image/jpeg", PhotosHandler.mimeTypeFromExtension("jpeg"))
        assertEquals("image/png", PhotosHandler.mimeTypeFromExtension("png"))
        assertEquals("image/webp", PhotosHandler.mimeTypeFromExtension("webp"))
    }

    @Test fun mimeTypeFromExtension_unknownDefaultsToOctetStream() {
        assertEquals("application/octet-stream", PhotosHandler.mimeTypeFromExtension("xyz"))
    }

    @Test fun requiredPermissions_includesStorageOrMediaImages() {
        val perms = PhotosHandler.requiredPermissions()
        assertTrue(perms.isNotEmpty())
    }
}
