#!/bin/bash
set -euo pipefail

# CoreBlow Android — Startup Benchmark
# Usage: ./scripts/perf-startup-benchmark.sh

cd "$(dirname "$0")/.."

echo "Running startup benchmarks..."
./gradlew :benchmark:connectedBenchmarkAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.class=com.coreblow.benchmark.StartupBenchmark \
    "$@"

echo "Done. Results in benchmark/build/outputs/connected_android_test_additional_output/"
