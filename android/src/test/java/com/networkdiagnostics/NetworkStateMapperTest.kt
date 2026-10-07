package com.networkdiagnostics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NetworkStateMapperTest {
  private fun snapshot(
    transports: Set<Transport> = setOf(Transport.WIFI),
    internet: Boolean = true,
    validated: Boolean = true,
    captivePortal: Boolean = false,
    notMetered: Boolean = true,
    temporarilyNotMetered: Boolean? = false,
    notSuspended: Boolean? = true,
  ) = CapabilitySnapshot(
    transports = transports,
    hasInternetCapability = internet,
    validated = validated,
    captivePortal = captivePortal,
    notMetered = notMetered,
    temporarilyNotMetered = temporarilyNotMetered,
    notSuspended = notSuspended,
  )

  @Test
  fun noActiveNetworkIsDisconnected() {
    val result = NetworkStateMapper.map(null, dataSaverRestrictsApp = false)
    assertFalse(result.connected)
    assertEquals("none", result.type)
    assertEquals(false, result.validated)
  }

  @Test
  fun validatedUnmeteredWifi() {
    val result = NetworkStateMapper.map(snapshot(), dataSaverRestrictsApp = true)
    assertEquals(
      NetworkStateResult(
        connected = true,
        type = "wifi",
        vpn = false,
        validated = true,
        captivePortal = false,
        metered = false,
        // Data Saver does not apply to unmetered networks.
        constrained = false,
      ),
      result
    )
  }

  @Test
  fun cellularIsMeteredAndDataSaverConstrains() {
    val result = NetworkStateMapper.map(
      snapshot(transports = setOf(Transport.CELLULAR), notMetered = false),
      dataSaverRestrictsApp = true
    )
    assertEquals("cellular", result.type)
    assertEquals(true, result.metered)
    assertEquals(true, result.constrained)
  }

  @Test
  fun unknownDataSaverStatusIsNullOnMeteredNetworks() {
    val result = NetworkStateMapper.map(
      snapshot(notMetered = false),
      dataSaverRestrictsApp = null
    )
    assertNull(result.constrained)
  }

  @Test
  fun temporarilyNotMeteredCountsAsUnmetered() {
    val result = NetworkStateMapper.map(
      snapshot(transports = setOf(Transport.CELLULAR), notMetered = false, temporarilyNotMetered = true),
      dataSaverRestrictsApp = true
    )
    assertEquals(false, result.metered)
    assertEquals(false, result.constrained)
  }

  @Test
  fun captivePortalIsReportedAndNotValidated() {
    val result = NetworkStateMapper.map(
      snapshot(validated = false, captivePortal = true),
      dataSaverRestrictsApp = false
    )
    assertTrue(result.connected)
    assertEquals(false, result.validated)
    assertEquals(true, result.captivePortal)
  }

  @Test
  fun validatedRequiresInternetCapability() {
    val result = NetworkStateMapper.map(
      snapshot(internet = false, validated = true),
      dataSaverRestrictsApp = false
    )
    assertEquals(false, result.validated)
  }

  @Test
  fun suspendedNetworkIsDisconnected() {
    val result = NetworkStateMapper.map(
      snapshot(transports = setOf(Transport.CELLULAR), notSuspended = false),
      dataSaverRestrictsApp = false
    )
    assertFalse(result.connected)
    assertEquals("none", result.type)
  }

  @Test
  fun suspendedUnknownBelowApi28IsTreatedAsConnected() {
    val result = NetworkStateMapper.map(snapshot(notSuspended = null), dataSaverRestrictsApp = false)
    assertTrue(result.connected)
  }

  @Test
  fun vpnOverWifiReportsWifiWithVpnFlag() {
    val result = NetworkStateMapper.map(
      snapshot(transports = setOf(Transport.VPN, Transport.WIFI)),
      dataSaverRestrictsApp = false
    )
    assertEquals("wifi", result.type)
    assertEquals(true, result.vpn)
  }

  @Test
  fun vpnWithoutUnderlyingTransportReportsVpn() {
    val result = NetworkStateMapper.map(
      snapshot(transports = setOf(Transport.VPN)),
      dataSaverRestrictsApp = false
    )
    assertEquals("vpn", result.type)
    assertEquals(true, result.vpn)
  }

  @Test
  fun transportPriority() {
    assertEquals("ethernet", NetworkStateMapper.resolveType(setOf(Transport.ETHERNET, Transport.WIFI)))
    assertEquals("wifi", NetworkStateMapper.resolveType(setOf(Transport.WIFI, Transport.CELLULAR)))
    assertEquals("cellular", NetworkStateMapper.resolveType(setOf(Transport.CELLULAR)))
    assertEquals("other", NetworkStateMapper.resolveType(setOf(Transport.OTHER, Transport.VPN)))
    assertEquals("unknown", NetworkStateMapper.resolveType(emptySet()))
  }
}
