package com.networkdiagnostics

/**
 * Pure mapping from an OS capability snapshot to the values exposed to JS.
 *
 * This file deliberately has no android.* imports so it can be unit tested
 * on the JVM without Robolectric or a device.
 */

/** Transports we distinguish. Mirrors NetworkCapabilities.TRANSPORT_*. */
enum class Transport {
  WIFI,
  CELLULAR,
  ETHERNET,
  VPN,
  OTHER,
}

/**
 * Plain-data copy of the parts of NetworkCapabilities we use.
 * Nullable fields mean "this API level cannot tell us".
 */
data class CapabilitySnapshot(
  val transports: Set<Transport>,
  /** NET_CAPABILITY_INTERNET */
  val hasInternetCapability: Boolean,
  /** NET_CAPABILITY_VALIDATED */
  val validated: Boolean,
  /** NET_CAPABILITY_CAPTIVE_PORTAL */
  val captivePortal: Boolean,
  /** NET_CAPABILITY_NOT_METERED */
  val notMetered: Boolean,
  /** NET_CAPABILITY_TEMPORARILY_NOT_METERED, API 30+, null below. */
  val temporarilyNotMetered: Boolean?,
  /** NET_CAPABILITY_NOT_SUSPENDED, API 28+, null below. */
  val notSuspended: Boolean?,
)

/** Values sent to JS. Null means the key is omitted (unknown on this device). */
data class NetworkStateResult(
  val connected: Boolean,
  val type: String,
  val vpn: Boolean?,
  val validated: Boolean?,
  val captivePortal: Boolean?,
  val metered: Boolean?,
  val constrained: Boolean?,
)

object NetworkStateMapper {
  const val TYPE_WIFI = "wifi"
  const val TYPE_CELLULAR = "cellular"
  const val TYPE_ETHERNET = "ethernet"
  const val TYPE_VPN = "vpn"
  const val TYPE_OTHER = "other"
  const val TYPE_UNKNOWN = "unknown"
  const val TYPE_NONE = "none"

  val DISCONNECTED = NetworkStateResult(
    connected = false,
    type = TYPE_NONE,
    vpn = false,
    validated = false,
    captivePortal = false,
    metered = null,
    constrained = null,
  )

  /**
   * @param snapshot capabilities of the active (default) network, or null when
   *   there is no active network.
   * @param dataSaverRestrictsApp true when Data Saver is on and this app is not
   *   allow-listed (ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED),
   *   null when unknown.
   */
  fun map(snapshot: CapabilitySnapshot?, dataSaverRestrictsApp: Boolean?): NetworkStateResult {
    if (snapshot == null) {
      return DISCONNECTED
    }
    // A suspended network (for example cellular during a voice call on some
    // devices) cannot carry traffic right now.
    if (snapshot.notSuspended == false) {
      return DISCONNECTED
    }

    val metered = !(snapshot.notMetered || snapshot.temporarilyNotMetered == true)
    // Data Saver only applies to metered networks.
    val constrained = when {
      !metered -> false
      dataSaverRestrictsApp == null -> null
      else -> dataSaverRestrictsApp
    }

    return NetworkStateResult(
      connected = true,
      type = resolveType(snapshot.transports),
      vpn = snapshot.transports.contains(Transport.VPN),
      validated = snapshot.hasInternetCapability && snapshot.validated,
      captivePortal = snapshot.captivePortal,
      metered = metered,
      constrained = constrained,
    )
  }

  /**
   * Picks the physical transport. A VPN usually runs on top of Wi-Fi or
   * cellular; when the OS also lists that transport we report it and expose
   * the VPN via the separate `vpn` flag.
   */
  fun resolveType(transports: Set<Transport>): String = when {
    transports.contains(Transport.ETHERNET) -> TYPE_ETHERNET
    transports.contains(Transport.WIFI) -> TYPE_WIFI
    transports.contains(Transport.CELLULAR) -> TYPE_CELLULAR
    transports.contains(Transport.OTHER) -> TYPE_OTHER
    transports.contains(Transport.VPN) -> TYPE_VPN
    else -> TYPE_UNKNOWN
  }
}
