#import "NetworkDiagnostics.h"

// Swift generated header. Its path depends on whether the pod is built as a
// framework (use_frameworks!) or as a static library.
#if __has_include("NetworkDiagnostics/NetworkDiagnostics-Swift.h")
#import "NetworkDiagnostics/NetworkDiagnostics-Swift.h"
#else
#import "NetworkDiagnostics-Swift.h"
#endif

@implementation NetworkDiagnostics {
  NetworkDiagnosticsImpl *_impl;
}

- (instancetype)init
{
  if (self = [super init]) {
    _impl = [NetworkDiagnosticsImpl new];
  }
  return self;
}

+ (NSString *)moduleName
{
  return @"NetworkDiagnostics";
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)getNetworkState:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [_impl getNetworkState:^(NSDictionary<NSString *, id> *state) {
    resolve(state);
  }
      reject:^(NSString *code, NSString *message) {
        reject(code, message, nil);
      }];
}

- (void)probeEndpoint:(NSString *)url
               method:(NSString *)method
            timeoutMs:(double)timeoutMs
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  // Network failures are reported in the resolved value, never as rejections.
  [_impl probe:url
          method:method
       timeoutMs:timeoutMs
         resolve:^(NSDictionary<NSString *, id> *result) {
           resolve(result);
         }];
}

- (void)startMonitoring
{
  __weak NetworkDiagnostics *weakSelf = self;
  [_impl startMonitoring:^(NSDictionary<NSString *, id> *state) {
    NetworkDiagnostics *strongSelf = weakSelf;
    if (strongSelf != nil) {
      [strongSelf emitOnNetworkStateChange:state];
    }
  }];
}

- (void)stopMonitoring
{
  [_impl stopMonitoring];
}

- (void)invalidate
{
  [_impl stopMonitoring];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeNetworkDiagnosticsSpecJSI>(params);
}

@end
