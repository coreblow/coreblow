package ai.coreblow.app.di

import android.content.Context
import ai.coreblow.app.SecurePrefs
import ai.coreblow.app.database.AppDatabase
import ai.coreblow.app.gateway.GatewayDiscovery
import ai.coreblow.app.gateway.GatewaySession
import ai.coreblow.app.node.InvokeDispatcher
import ai.coreblow.app.repository.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

// ============================================================
// AppModule — core dependencies
// ============================================================

object AppModule {
    private var _context: Context? = null
    private var _scope: CoroutineScope? = null
    private var _securePrefs: SecurePrefs? = null

    fun init(context: Context) {
        _context = context.applicationContext
        _scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        _securePrefs = SecurePrefs(context.applicationContext)
    }

    val context: Context get() = _context ?: throw IllegalStateException("AppModule not initialized")
    val scope: CoroutineScope get() = _scope ?: throw IllegalStateException("AppModule not initialized")
    val securePrefs: SecurePrefs get() = _securePrefs ?: throw IllegalStateException("AppModule not initialized")
}

// ============================================================
// DatabaseModule
// ============================================================

object DatabaseModule {
    private var _db: AppDatabase? = null

    val database: AppDatabase get() {
        return _db ?: AppDatabase.getInstance(AppModule.context).also { _db = it }
    }

    val conversationDao get() = database.conversationDao()
    val messageDao get() = database.messageDao()
    val providerDao get() = database.providerDao()
}

// ============================================================
// NetworkModule
// ============================================================

object NetworkModule {
    val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    val gatewayClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS) // No timeout for WebSocket
            .writeTimeout(15, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .pingInterval(30, TimeUnit.SECONDS)
            .build()
    }
}

// ============================================================
// ViewModelModule — ViewModel dependency providers
// ============================================================

object ViewModelModule {
    val conversationRepository: ConversationRepository by lazy { ConversationRepository(AppModule.context) }
    val messageRepository: MessageRepository by lazy { MessageRepository(AppModule.context) }
    val providerRepository: ProviderRepository by lazy { ProviderRepository(AppModule.context) }
    val settingsRepository: SettingsRepository by lazy { SettingsRepository(AppModule.context) }
    val userRepository: UserRepository by lazy { UserRepository(AppModule.context) }
}
