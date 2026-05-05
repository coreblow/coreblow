package com.coreblow.app.model

data class User(
    val id: String,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)
