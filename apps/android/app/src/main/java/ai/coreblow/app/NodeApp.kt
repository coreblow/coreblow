package ai.coreblow.app

import android.app.Application
import android.os.StrictMode
import android.util.Log
import ai.coreblow.app.di.AppModule
import ai.coreblow.app.receiver.BatteryReceiver

/**
 * Application subclass for CoreBlow.
 * Initialises the DI graph, lazy-creates the NodeRuntime singleton,
 * and installs debug-mode StrictMode policies.
 */
class NodeApp : Application() {

    companion object {
        private const val TAG = "NodeApp"
    }

    val prefs: SecurePrefs by lazy { SecurePrefs(this) }

    @Volatile private var runtimeInstance: NodeRuntime? = null

    /**
     * Return the existing NodeRuntime or create one (thread-safe DCL).
     */
    fun ensureRuntime(): NodeRuntime {
        runtimeInstance?.let { return it }
        return synchronized(this) {
            runtimeInstance ?: NodeRuntime(this, prefs).also {
                runtimeInstance = it
                Log.i(TAG, "NodeRuntime created")
            }
        }
    }

    /** Peek at the runtime without forcing creation. */
    fun peekRuntime(): NodeRuntime? = runtimeInstance

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "CoreBlow starting")

        // Initialise manual DI container
        AppModule.initialize(this)

        // Register battery monitor
        BatteryReceiver.register(this)

        if (BuildConfig.DEBUG) {
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder()
                    .detectAll()
                    .penaltyLog()
                    .build(),
            )
            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder()
                    .detectAll()
                    .penaltyLog()
                    .build(),
            )
            Log.d(TAG, "StrictMode enabled (debug build)")
        }
    }
}
