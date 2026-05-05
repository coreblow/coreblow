package ai.coreblow.app.model

data class Attachment(
    val id: String,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)
