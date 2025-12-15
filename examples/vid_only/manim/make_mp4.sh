#!/bin/bash

# Script to render Manim examples to MP4 with organized output
# Usage: ./make_mp4.sh file1.py [file2.py ...]
#        ./make_mp4.sh *  (for all Python files)
#        ./make_mp4.sh examples/*  (recurse into subdirectories)

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1.py> [file2.py ...]"
    echo "       $0 * (to render all Python files)"
    echo "       $0 examples/* (to recurse into subdirectories)"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_BASE_DIR="$SCRIPT_DIR/outputs"

# Check if we need to activate virtual environment
VENV_ACTIVATED=false
if [[ -z "$VIRTUAL_ENV" ]]; then
    if [[ -f "$SCRIPT_DIR/venv/bin/activate" ]]; then
        echo "Activating virtual environment..."
        source "$SCRIPT_DIR/venv/bin/activate"
        VENV_ACTIVATED=true
    elif [[ -f "$SCRIPT_DIR/../venv/bin/activate" ]]; then
        echo "Activating virtual environment..."
        source "$SCRIPT_DIR/../venv/bin/activate"
        VENV_ACTIVATED=true
    else
        echo "Warning: No virtual environment found and none currently active"
    fi
else
    echo "Using existing virtual environment: $VIRTUAL_ENV"
fi

# Function to cleanup on exit
cleanup() {
    if [[ "$VENV_ACTIVATED" == "true" ]]; then
        echo "Deactivating virtual environment..."
        deactivate
    fi
}
trap cleanup EXIT

# Function to render a single file
render_file() {
    local file="$1"

    # Handle directories - find all .py files recursively, but skip certain directories
    if [[ -d "$file" ]]; then
        # Skip common non-source directories
        local dirname=$(basename "$file")
        if [[ "$dirname" == "venv" || "$dirname" == "__pycache__" || "$dirname" == ".git" || "$dirname" == "node_modules" || "$dirname" == "media" || "$dirname" == "outputs" ]]; then
            echo "Skipping directory: $file"
            return
        fi

        echo "Processing directory: $file"
        find "$file" -name "*.py" -type f | while read -r py_file; do
            render_file "$py_file"
        done
        return
    fi

    # Skip if not a Python file
    if [[ ! "$file" == *.py ]]; then
        echo "Skipping non-Python file: $file"
        return
    fi

    # Skip if file doesn't exist
    if [[ ! -f "$file" ]]; then
        echo "File not found: $file"
        return
    fi

    # Get absolute path and relative path from script directory
    local abs_file=$(realpath "$file")
    local rel_file=$(realpath --relative-to="$SCRIPT_DIR" "$file")

    # Create output directory structure for final MP4s only
    local output_dir="$OUTPUT_BASE_DIR/$(dirname "$rel_file")"
    local output_file_base="$(basename "$rel_file" .py)"

    # Create output directory if it doesn't exist
    mkdir -p "$output_dir"

    echo "Rendering $file to outputs/${rel_file%.*}.mp4..."

    # Render normally (media files go to default media/ folder)
    # Use -a flag to render all scenes automatically without prompting
    # Use -qh for high quality 1080p output
    if command -v manim &> /dev/null; then
        manim render -qh -a "$abs_file"
    else
        # Try with python -m manim if manim command not found
        python -m manim render -qh -a "$abs_file"
    fi

    # Copy files from the exact quality we rendered (-qh = 1080p60)
    local media_base="$SCRIPT_DIR/media/videos/$(basename "$rel_file" .py)"
    local quality_dir="$media_base/1080p60"

    if [[ -d "$quality_dir" ]]; then
        echo "Copying from quality: 1080p60"
        find "$quality_dir" -name "*.mp4" -type f -maxdepth 1 2>/dev/null | while read -r video_file; do
            local scene_name=$(basename "$video_file" .mp4)

            # Create filename with space + scene name format
            local final_output="$output_dir/${output_file_base} ${scene_name}.mp4"

            # Copy (overwrite if exists)
            cp "$video_file" "$final_output"
            echo "✓ Created: outputs/${rel_file%.*} ${scene_name}.mp4"
        done
    else
        echo "No 1080p60 video files found for $file"
    fi

    echo "Finished rendering $file"
    echo "---"
}

# Process all arguments
for arg in "$@"; do
    # Handle glob patterns that might include directories
    if [[ "$arg" == *"*"* ]]; then
        # Let the shell expand the glob, then process each result
        for expanded in $arg; do
            if [[ -e "$expanded" ]]; then
                render_file "$expanded"
            fi
        done
    else
        render_file "$arg"
    fi
done

echo "All rendering complete! Check the outputs/ directory for your MP4 files."