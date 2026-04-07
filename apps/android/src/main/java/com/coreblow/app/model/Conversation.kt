package com.coreblow.app.model

data class Conversation(
    val id: String,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)
