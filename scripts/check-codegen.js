#!/usr/bin/env node
/**
 * Runs React Native Codegen for this library (Android and iOS) into a
 * temporary directory and checks that the generated native interfaces
 * contain every method and event of the spec. No device or SDK needed.
 *
 * Usage: node scripts/check-codegen.js
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = require.resolve(
  'react-native/scripts/generate-codegen-artifacts.js',
  { paths: [root] }
);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rnnd-codegen-'));

function run(platform) {
  execFileSync(
    process.execPath,
    [
      script,
      '-p',
      root,
      '-t',
      platform,
      '-o',
      path.join(out, platform),
      '-s',
      'library',
    ],
    { stdio: 'pipe' }
  );
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return undefined;
}

const expectations = {
  android: {
    file: 'NativeNetworkDiagnosticsSpec.java',
    contains: [
      'public abstract void getNetworkState(Promise promise)',
      'public abstract void probeEndpoint(String url, String method, double timeoutMs, Promise promise)',
      'public abstract void startMonitoring()',
      'public abstract void stopMonitoring()',
      'protected final void emitOnNetworkStateChange(ReadableMap value)',
    ],
  },
  ios: {
    file: 'NetworkDiagnosticsSpec.h',
    contains: [
      '@protocol NativeNetworkDiagnosticsSpec',
      '- (void)getNetworkState:(RCTPromiseResolveBlock)resolve',
      '- (void)probeEndpoint:(NSString *)url',
      '- (void)startMonitoring;',
      '- (void)stopMonitoring;',
      '- (void)emitOnNetworkStateChange:(NSDictionary *)value;',
    ],
  },
};

let failed = false;
try {
  for (const [platform, { file, contains }] of Object.entries(expectations)) {
    run(platform);
    const generated = findFile(path.join(out, platform), file);
    if (!generated) {
      console.error(`[${platform}] ${file} was not generated`);
      failed = true;
      continue;
    }
    const source = fs.readFileSync(generated, 'utf8');
    for (const needle of contains) {
      if (!source.includes(needle)) {
        console.error(`[${platform}] missing: ${needle}`);
        failed = true;
      }
    }
    if (!failed) {
      console.log(`[${platform}] ${file} OK`);
    }
  }
} finally {
  fs.rmSync(out, { recursive: true, force: true });
  // The generator also writes React Native's own spec into node_modules when
  // run outside an app; remove it so it does not linger.
  const stray = path.join(
    path.dirname(
      require.resolve('react-native/package.json', { paths: [root] })
    ),
    'ReactAndroid',
    'build',
    'generated',
    'source',
    'codegen'
  );
  fs.rmSync(stray, { recursive: true, force: true });
}

if (failed) {
  process.exit(1);
}
console.log('Codegen check passed');
