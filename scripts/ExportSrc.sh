#!/bin/bash

# Configuration
SEARCH_DIR="${1:-src}"  # Default to 'src', or use first argument
OUTPUT_FILE="project_context.txt"

# Clear/Create the output file
> "$OUTPUT_FILE"

echo "Exporting files from '$SEARCH_DIR' into '$OUTPUT_FILE'..."

# Find all files, excluding hidden files (like .DS_Store or .git)
# -type f: look for files only
# -not -path '*/.*': ignore hidden files
find "$SEARCH_DIR" -type f -not -path '*/.*' | while read -r file; do
    echo "Processing: $file"
    
    # Write the formatted header to the output file
    echo "================================================================================" >> "$OUTPUT_FILE"
    echo "FILE PATH: $file" >> "$OUTPUT_FILE"
    echo "================================================================================" >> "$OUTPUT_FILE"
    
    # Dump the file content
    cat "$file" >> "$OUTPUT_FILE"
    
    # Add a few newlines for separation
    echo -e "\n\n" >> "$OUTPUT_FILE"
done

echo "Done! Context saved to $OUTPUT_FILE"