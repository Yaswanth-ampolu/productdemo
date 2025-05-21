#!/bin/bash

# Initialize variables
PYTHON_VERSION="python3.9"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="${SCRIPT_DIR}/venv"
REQUIREMENTS="${SCRIPT_DIR}/requirements.txt"
EXTRACT_SCRIPT="${SCRIPT_DIR}/extract_text.py"

# Print script header
echo "==============================================="
echo "PDF Text Extraction - Virtual Environment Setup"
echo "==============================================="
echo ""

# Check if we're in the right directory
if [[ $(basename "${SCRIPT_DIR}") != "python" ]]; then
    echo "Warning: This script should be run from the 'python' directory"
    echo "Current directory: ${SCRIPT_DIR}"
    echo ""
fi

# Check if Python 3.9 is installed
if ! command -v $PYTHON_VERSION &> /dev/null
then
    echo "Error: $PYTHON_VERSION is not installed or not in PATH"
    echo "Please install Python 3.9 and try again"
    exit 1
fi

# Check if venv module is available
$PYTHON_VERSION -c "import venv" &> /dev/null
if [ $? -ne 0 ]; then
    echo "Error: Python venv module is not available"
    echo "Please install python3.9-venv package if needed"
    echo "Example: apt-get install python3.9-venv (Debian/Ubuntu)"
    echo "Example: yum install python3.9-venv (RHEL/CentOS)"
    exit 1
fi

# Create requirements.txt if it doesn't exist
if [ ! -f "$REQUIREMENTS" ]; then
    echo "requirements.txt not found, creating it..."
    cat > "$REQUIREMENTS" << EOL
pdfplumber==0.9.0
Pillow>=9.0.0
Wand>=0.6.7
cryptography>=38.0.0
EOL
    echo "Created requirements.txt with necessary dependencies"
fi

# Create extract_text.py if it doesn't exist
if [ ! -f "$EXTRACT_SCRIPT" ]; then
    echo "extract_text.py not found, creating it..."
    cat > "$EXTRACT_SCRIPT" << 'EOL'
#!/usr/bin/env python3.9

import sys
import json
import argparse
import traceback

def extract_text_with_pdfplumber(pdf_path):
    """
    Extract text from a PDF file using pdfplumber with page markers.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Dictionary with text content and metadata
    """
    try:
        try:
            import pdfplumber
        except ImportError:
            return {
                "success": False,
                "error": "pdfplumber module not installed. Install with: pip install pdfplumber",
                "instructions": "Run: pip install --user pdfplumber"
            }
        
        full_text = ""
        page_texts = []
        
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            
            for i, page in enumerate(pdf.pages):
                page_num = i + 1
                page_text = page.extract_text()
                
                if page_text:
                    # Add page marker at the beginning of each page
                    marked_text = f"\n\n[Page {page_num} of {total_pages}]\n{page_text}"
                    full_text += marked_text
                    page_texts.append({
                        "page_num": page_num,
                        "text": page_text
                    })
        
        return {
            "success": True,
            "text": full_text.strip(),
            "page_count": total_pages,
            "pages": page_texts
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def process_pdf(pdf_path):
    """
    Process a PDF file and extract text.
    
    This function is a wrapper that handles errors and ensures valid JSON output.
    """
    if not pdf_path or not pdf_path.lower().endswith('.pdf'):
        return {
            "success": False,
            "error": f"Invalid PDF file: {pdf_path}"
        }
    
    try:
        # Try to access the file
        with open(pdf_path, 'rb') as f:
            # Just check if we can open it
            pass
    except Exception as e:
        return {
            "success": False,
            "error": f"Could not access PDF file: {str(e)}"
        }
    
    # Extract text using pdfplumber
    return extract_text_with_pdfplumber(pdf_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract text from PDF using pdfplumber")
    parser.add_argument("pdf_path", help="Path to the PDF file")
    
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "PDF path argument is required"
        }))
        sys.exit(1)
    
    args = parser.parse_args()
    
    # Process the PDF and get the result
    result = process_pdf(args.pdf_path)
    
    # Print JSON output to stdout for Node.js to capture
    print(json.dumps(result))
EOL
    chmod +x "$EXTRACT_SCRIPT"
    echo "Created extract_text.py script"
fi

# Remove existing venv if it exists
if [ -d "$VENV_PATH" ]; then
    echo "Removing existing virtual environment..."
    rm -rf "$VENV_PATH"
    echo "Done!"
fi

# Create new virtual environment
echo "Creating new virtual environment with $PYTHON_VERSION..."
$PYTHON_VERSION -m venv "$VENV_PATH"
if [ $? -ne 0 ]; then
    echo "Error: Failed to create virtual environment"
    exit 1
fi
echo "Virtual environment created successfully!"

# Activate virtual environment and install requirements
echo "Installing required packages..."
source "$VENV_PATH/bin/activate"

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install requirements
if [ -f "$REQUIREMENTS" ]; then
    echo "Installing packages from requirements.txt..."
    pip install -r "$REQUIREMENTS"
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install required packages"
        exit 1
    fi
else
    echo "Error: requirements.txt not found at $REQUIREMENTS"
    exit 1
fi

# Print success message
echo ""
echo "Installation complete!"
echo "Virtual environment location: $VENV_PATH"
echo ""
echo "To activate the virtual environment, run:"
echo "  source $VENV_PATH/bin/activate"
echo ""
echo "Update your config.ini with this interpreter path:"
echo "  interpreter = ./python/venv/bin/python"

# Deactivate virtual environment
deactivate 