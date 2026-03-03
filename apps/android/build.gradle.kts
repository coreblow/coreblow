plugins {
    id("com.android.application") version "8.2.0"
    id("org.jetbrains.kotlin.android") version "1.9.22"
}

android {
    namespace = "com.coreblow.app"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.coreblow.app"
        minSdk = 26
        targetSdk = 34
    }
}
