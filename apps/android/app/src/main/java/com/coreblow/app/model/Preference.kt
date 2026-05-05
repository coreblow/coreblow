package com.coreblow.app.model

data class Preference(
    val id: String,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)
