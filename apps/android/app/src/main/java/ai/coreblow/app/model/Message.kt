package ai.coreblow.app.model

data class Message(
    val id: String,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)
