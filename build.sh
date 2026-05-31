#!/bin/bash
# SINGULARITY GARDEN — Linux build script
set -e

BUILD_TYPE=${1:-Release}
BUILD_DIR="build/linux_${BUILD_TYPE,,}"

echo "╔══════════════════════════════════╗"
echo "║  SINGULARITY GARDEN — BUILD      ║"
echo "║  Type: $BUILD_TYPE               "
echo "╚══════════════════════════════════╝"

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

cmake ../.. \
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON

cmake --build . --parallel $(nproc)

echo ""
echo "✓ Build complete: $BUILD_DIR/singularity_garden"
echo "  Run: ./$BUILD_DIR/singularity_garden"
