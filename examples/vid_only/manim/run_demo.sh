#!/bin/bash

# Script to run Manim examples for preview (no file output)
# Usage: ./run_demo.sh file1.py [file2.py ...]
#        ./run_demo.sh directory/  (for all Python files in directory)
#        ./run_demo.sh *  (for all Python files in current directory)

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1.py> [file2.py ...]"
    echo "       $0 <directory>/ (to run all Python files in directory)"
    echo "       $0 * (to run all Python files in current directory)"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Function to run a single file
run_file() {
    local file="$1"

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

    # Get absolute path to handle subdirectories
    local abs_file=$(realpath "$file")

    echo "Running fastest demo for $file..."
    if command -v manim &> /dev/null; then
        manim render --resolution 640,360 --fps 15 --disable_caching "$abs_file"
    else
        # Try with python -m manim if manim command not found
        python -m manim render --resolution 640,360 --fps 15 --disable_caching "$abs_file"
    fi

    # Find and open the generated MP4 in web browser
    # Get the relative path from script directory and extract filename without .py extension
    local rel_file=$(realpath --relative-to="$SCRIPT_DIR" "$file")
    local filename_base="$(basename "$rel_file" .py)"
    local media_base="$SCRIPT_DIR/media/videos/$filename_base"
    local quality_dir="$media_base/360p15"

    echo "Looking for videos in: $quality_dir"

    if [[ -d "$quality_dir" ]]; then
        find "$quality_dir" -name "*.mp4" -type f -maxdepth 1 2>/dev/null | while read -r video_file; do
            echo "Opening $(basename "$video_file")..."
            if command -v wslview &> /dev/null; then
                echo "Using wslview"
                wslview "$video_file" &
            elif command -v xdg-open &> /dev/null; then
                echo "Using xdg-open"
                xdg-open "file://$video_file" &
            elif command -v open &> /dev/null; then
                echo "Using open"
                open "file://$video_file" &
            else
                echo "Could not find command to open file. Video saved to: $video_file"
            fi
        done
    else
        echo "Directory not found: $quality_dir"
    fi
    echo "Finished demo for $file"
    echo "---"
}

# Function to process a directory or file
process_argument() {
    local arg="$1"

    if [[ -d "$arg" ]]; then
        # It's a directory, find all Python files in it
        echo "Processing directory: $arg"
        find "$arg" -name "*.py" -type f | while read -r py_file; do
            run_file "$py_file"
        done
    elif [[ -f "$arg" ]]; then
        # It's a file, process it directly
        run_file "$arg"
    else
        echo "Skipping non-existent path: $arg"
    fi
}

# Process all arguments
for arg in "$@"; do
    process_argument "$arg"
done

echo "All demos complete!"