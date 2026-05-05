package ai.coreblow.app.model

data class Provider(
    val id: String,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)
