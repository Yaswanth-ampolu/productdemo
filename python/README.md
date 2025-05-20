# Python PDF Text Extraction

This directory contains the Python components for enhanced PDF text extraction using `pdfplumber`.

## Contents

- `extract_text.py` - Python script for extracting text from PDFs with layout preservation
- `requirements.txt` - List of Python dependencies
- `installvenv.sh` - Script to set up the Python 3.9 virtual environment
- `test_extraction.sh` - Script to verify installation and test extraction functionality
- `venv/` - Python virtual environment directory (created by installvenv.sh)

## Setup Instructions

1. Make sure Python 3.9 is installed on your system:
   ```bash
   python3.9 --version
   ```

2. Run the installation script to create the virtual environment:
   ```bash
   # You can run it from any directory
   ./python/installvenv.sh
   ```
   
   This script will:
   - Create the Python virtual environment
   - Install all required dependencies
   - Create `extract_text.py` if it doesn't exist
   - Create `requirements.txt` if it doesn't exist

3. After installation, the config.ini is already updated with the relative path:
   ```ini
   [python]
   interpreter = ./python/venv/bin/python
   ```
   
   Using a relative path allows the configuration to work regardless of where the project is installed.

## Testing the Installation

After setting up the environment, you can verify it works correctly using the test script:

```bash
# Basic verification (tests if pdfplumber is installed correctly)
./python/test_extraction.sh

# Full test with PDF extraction (provide a PDF file path)
./python/test_extraction.sh /path/to/sample.pdf
```

## Manual Setup (if installvenv.sh fails)

If the automated script fails, you can set up the environment manually:

```bash
# Create virtual environment
cd python
python3.9 -m venv venv

# Activate the environment
source venv/bin/activate

# Update pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

## Testing the Script Directly

You can test the PDF extraction script directly:

```bash
# Activate the virtual environment
source python/venv/bin/activate

# Run the script on a PDF file
python python/extract_text.py /path/to/your/document.pdf
```

The script will output JSON with the extracted text and metadata.

## Troubleshooting

If you encounter any issues:

1. Make sure Python 3.9 is installed and accessible
2. Check that all dependencies were installed correctly
3. Verify the paths in config.ini are correct
4. Run the test script to verify the installation
5. Check script permissions (should be executable) 