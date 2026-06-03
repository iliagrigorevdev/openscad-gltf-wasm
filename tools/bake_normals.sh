#!/bin/bash

# Default values
RES=2048
DISTANCE=0.05
MARGIN=16
BLENDER_CMD="blender"

# Get the directory of this bash script to locate the python script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PYTHON_SCRIPT="$SCRIPT_DIR/bake_normals.py"

# Help menu function
show_help() {
    echo "Usage: ./bake_normals.sh --high <high.glb> --low <low.glb> --out <output.glb> [options]"
    echo ""
    echo "Required Arguments:"
    echo "  --high <file>       Path to the High-Poly GLTF/GLB file"
    echo "  --low <file>        Path to the Low-Poly GLTF/GLB file (No UVs required)"
    echo "  --out <file>        Path to save the resulting GLB/GLTF model"
    echo ""
    echo "Optional Arguments:"
    echo "  --res <int>         Resolution of the normal map (Default: 2048)"
    echo "  --distance <float>  Max ray distance/cage extrusion (Default: 0.05)"
    echo "  --margin <int>      Bleed margin in pixels (Default: 16)"
    echo "  --blender <path>    Custom path to blender executable (Default: 'blender')"
    echo "  -h, --help          Show this help message"
}

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --high) HIGH="$2"; shift ;;
        --low) LOW="$2"; shift ;;
        --out) OUT="$2"; shift ;;
        --res) RES="$2"; shift ;;
        --distance) DISTANCE="$2"; shift ;;
        --margin) MARGIN="$2"; shift ;;
        --blender) BLENDER_CMD="$2"; shift ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown parameter passed: $1"; show_help; exit 1 ;;
    esac
    shift
done

# Validate required arguments
if [ -z "$HIGH" ] || [ -z "$LOW" ] || [ -z "$OUT" ]; then
    echo "Error: --high, --low, and --out are required arguments."
    echo ""
    show_help
    exit 1
fi

# Print execution summary
echo "========================================"
echo " Starting UV Unwrapping & Baking Process"
echo "========================================"
echo " High Poly : $HIGH"
echo " Low Poly  : $LOW"
echo " Output GLB: $OUT"
echo " Resolution: ${RES}x${RES}"
echo " Ray Dist  : $DISTANCE"
echo "========================================"

# Execute Blender in background mode (-b) running the python script (-P)
"$BLENDER_CMD" -b -P "$PYTHON_SCRIPT" -- \
    --high "$HIGH" \
    --low "$LOW" \
    --out "$OUT" \
    --res "$RES" \
    --distance "$DISTANCE" \
    --margin "$MARGIN"

BLENDER_EXIT_CODE=$?

# Check if Blender exited successfully AND if the output file actually exists
if [ $BLENDER_EXIT_CODE -eq 0 ] && [ -f "$OUT" ]; then
    echo "========================================"
    echo " Success! Model saved to: $OUT"
    echo "========================================"
else
    echo "========================================"
    echo " Error: Bake failed or output file was not created."
    echo "========================================"
    exit 1
fi
