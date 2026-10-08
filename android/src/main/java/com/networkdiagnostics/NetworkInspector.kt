package com.networkdiagnostics

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build

/**
 * Reads the active network's capabilities from ConnectivityManager and
 * converts them into a [CapabilitySnapshot]. No network I/O.
 *
 * Requires android.permission.ACCESS_NETWORK_STATE (a normal, install-time
 * permission declared in this library's manifest).
 */
class NetworkInspector(context: Context) {
  private val connectivityManager: ConnectivityManager? =
    context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

  val isAvailable: Boolean
    get() = connectivityManager != null

  /** Current state of the default network. */
  fun currentState(): NetworkStateResult {
    val cm = connectivityManager ?: return NetworkStateMapper.DISCONNECTED
    val network = cm.activeNetwork ?: return NetworkStateMapper.DISCONNECTED
    val capabilities = cm.getNetworkCapabilities(network)
      ?: return NetworkStateMapper.DISCONNECTED
    return stateFor(capabilities)
  }

  /** State for capabilities delivered by a NetworkCallback. */
  fun stateFor(capabilities: NetworkCapabilities): NetworkStateResult =
    NetworkStateMapper.map(snapshotOf(capabilities), dataSaverRestrictsApp())

  /**
   * Data Saver status for this app. RESTRICT_BACKGROUND_STATUS_ENABLED means
   * Data Saver is on and the app is not allow-listed.
   */
  private fun dataSaverRestrictsApp(): Boolean? {
    val cm = connectivityManager ?: return null
    return try {
      cm.restrictBackgroundStatus == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED
    } catch (e: SecurityException) {
      null
    }
  }

  companion object {
    fun snapshotOf(caps: NetworkCapabilities): CapabilitySnapshot {
      val transports = buildSet {
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) add(Transport.WIFI)
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) add(Transport.CELLULAR)
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) add(Transport.ETHERNET)
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) add(Transport.VPN)
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH)) add(Transport.OTHER)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
          caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI_AWARE)
        ) {
          add(Transport.OTHER)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1 &&
          caps.hasTransport(NetworkCapabilities.TRANSPORT_LOWPAN)
        ) {
          add(Transport.OTHER)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
          caps.hasTransport(NetworkCapabilities.TRANSPORT_USB)
        ) {
          add(Transport.OTHER)
        }
      }
      return CapabilitySnapshot(
        transports = transports,
        hasInternetCapability = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET),
        validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED),
        captivePortal = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL),
        notMetered = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED),
        temporarilyNotMetered = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_TEMPORARILY_NOT_METERED)
        } else {
          null
        },
        notSuspended = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_SUSPENDED)
        } else {
          null
        },
      )
    }
  }
}
