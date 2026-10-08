import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useNetworkDiagnostics,
  type NetworkDiagnostics,
} from 'react-native-network-diagnostics';

/**
 * Public connectivity-check endpoint operated by Google (returns HTTP 204).
 * Used here only when you tap "Use sample endpoint". The library itself has
 * no default endpoint and never contacts a server you did not configure.
 */
const SAMPLE_ENDPOINT = 'https://clients3.google.com/generate_204';

const TYPE_LABELS: Record<NetworkDiagnostics['type'], string> = {
  wifi: 'Wi-Fi',
  cellular: 'Cellular',
  ethernet: 'Ethernet',
  vpn: 'VPN',
  other: 'Other',
  unknown: 'Unknown',
  none: 'None',
};

function yesNo(value: boolean | undefined): string {
  if (value === undefined) {
    return 'Not available on this platform';
  }
  return value ? 'Yes' : 'No';
}

function ms(value: number | undefined): string {
  return value === undefined ? 'Not measured' : `${value} ms`;
}

export default function App() {
  const [endpointInput, setEndpointInput] = useState('');
  const [endpoint, setEndpoint] = useState<string | undefined>(undefined);
  const [monitor, setMonitor] = useState(false);

  const { diagnostics, loading, error, refresh } = useNetworkDiagnostics({
    endpoint,
    timeoutMs: 5000,
    monitor,
  });

  const applyEndpoint = (value: string) => {
    const trimmed = value.trim();
    setEndpointInput(trimmed);
    setEndpoint(trimmed.length > 0 ? trimmed : undefined);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        Network Diagnostics
      </Text>

      <Text style={styles.label}>Endpoint (optional, https only)</Text>
      <TextInput
        style={styles.input}
        value={endpointInput}
        onChangeText={setEndpointInput}
        onSubmitEditing={() => applyEndpoint(endpointInput)}
        placeholder="https://api.example.com/health"
        placeholderTextColor="#999"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        testID="endpoint-input"
      />
      <View style={styles.row}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => applyEndpoint(SAMPLE_ENDPOINT)}
        >
          <Text style={styles.secondaryButtonText}>Use sample endpoint</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => applyEndpoint('')}
        >
          <Text style={styles.secondaryButtonText}>No endpoint</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Text>Monitor network changes</Text>
        <Switch value={monitor} onValueChange={setMonitor} />
      </View>

      {error ? (
        <Section title="Error">
          <Row label="Code" value={error.code} />
          <Text style={styles.errorText}>{error.message}</Text>
        </Section>
      ) : null}

      {diagnostics ? (
        <>
          <Section title="Connection">
            <Row
              label="Status"
              value={diagnostics.connected ? 'Connected' : 'Disconnected'}
            />
            <Row label="Type" value={TYPE_LABELS[diagnostics.type]} />
            <Row label="VPN" value={yesNo(diagnostics.vpn)} />
          </Section>

          <Section title="Internet">
            <Row
              label="Validated (OS)"
              value={yesNo(diagnostics.internet.validated)}
            />
            <Row
              label="Captive Portal (OS)"
              value={yesNo(diagnostics.internet.captivePortal)}
            />
            {diagnostics.endpoint ? (
              <>
                <Row
                  label="Endpoint reachable"
                  value={diagnostics.endpoint.reachable ? 'Yes' : 'No'}
                />
                <Row
                  label="HTTP status"
                  value={
                    diagnostics.endpoint.statusCode !== undefined
                      ? String(diagnostics.endpoint.statusCode)
                      : '-'
                  }
                />
                {diagnostics.endpoint.error ? (
                  <Row label="Error" value={diagnostics.endpoint.error.code} />
                ) : null}
              </>
            ) : (
              <Text style={styles.hint}>
                No endpoint configured: no request was sent.
              </Text>
            )}
          </Section>

          <Section title="Conditions">
            <Row
              label="Metered"
              value={yesNo(diagnostics.conditions.metered)}
            />
            <Row
              label="Constrained"
              value={yesNo(diagnostics.conditions.constrained)}
            />
          </Section>

          <Section title="Latency">
            <Row label="HTTPS" value={ms(diagnostics.latency.httpsMs)} />
            <Row label="DNS" value={ms(diagnostics.latency.dnsMs)} />
            <Row label="TCP" value={ms(diagnostics.latency.tcpConnectMs)} />
            <Row label="TLS" value={ms(diagnostics.latency.tlsHandshakeMs)} />
          </Section>

          <Section title="Quality">
            <Text style={styles.quality} testID="quality">
              {diagnostics.quality.toUpperCase()}
            </Text>
          </Section>
        </>
      ) : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => {
          refresh();
        }}
        disabled={loading}
        accessibilityRole="button"
        testID="run-diagnostics"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Run Diagnostics</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.divider} />
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Explicit light background: the phone's dark theme otherwise paints the
  // window dark behind the default dark text.
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  input: {
    color: '#111',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 8,
  },
  rowLabel: { color: '#333' },
  rowValue: { fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  hint: { color: '#777', fontStyle: 'italic' },
  errorText: { color: '#b00020' },
  quality: { fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  button: {
    marginTop: 28,
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1f6feb',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  secondaryButtonText: { color: '#1f6feb' },
});
