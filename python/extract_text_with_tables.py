#!/usr/bin/env python3

import sys
import json
import argparse
import traceback
import re
from typing import List, Dict, Any, Tuple

def convert_table_to_markdown(table: List[List[str]]) -> str:
    """
    Convert a table extracted by pdfplumber into a Markdown table string.
    
    Args:
        table: A list of lists representing the table rows and columns
        
    Returns:
        Markdown formatted table as a string
    """
    if not table or not table[0]:
        return ""
    
    # Clean up cell content - remove extra whitespace, newlines
    cleaned_table = []
    for row in table:
        cleaned_row = []
        for cell in row:
            if cell is None:
                cell = ""
            else:
                # Replace multiple spaces with a single space
                cell = re.sub(r'\s+', ' ', str(cell).strip())
            cleaned_row.append(cell)
        cleaned_table.append(cleaned_row)
    
    # Get column widths for formatting
    num_cols = len(cleaned_table[0])
    
    # Create table header row
    markdown_table = "| " + " | ".join(cleaned_table[0]) + " |\n"
    
    # Create separator row
    markdown_table += "| " + " | ".join(["---"] * num_cols) + " |\n"
    
    # Create data rows
    for row in cleaned_table[1:]:
        # Ensure row has the correct number of columns
        while len(row) < num_cols:
            row.append("")
        markdown_table += "| " + " | ".join(row[:num_cols]) + " |\n"
    
    return markdown_table

def extract_text_and_tables(pdf_path: str) -> Dict[str, Any]:
    """
    Extract text and tables from a PDF file using pdfplumber.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Dictionary with extracted text and tables
    """
    try:
        import pdfplumber
    except ImportError:
        return {
            "success": False,
            "error": "pdfplumber module not installed. Install with: pip install pdfplumber",
            "instructions": "Run: pip install --user pdfplumber"
        }
    
    try:
        full_text = ""
        
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            
            for i, page in enumerate(pdf.pages):
                page_num = i + 1
                
                # Extract page text
                page_text = page.extract_text() or ""
                
                # Add page marker
                page_marker = f"\n\n[Page {page_num} of {total_pages}]\n"
                full_text += page_marker + page_text
                
                # Extract tables from the page
                tables = page.extract_tables()
                
                # If tables were found, convert them to markdown and add to the text
                if tables:
                    for table_idx, table in enumerate(tables):
                        if table and len(table) > 0:
                            table_header = f"\n\n### Extracted Table {table_idx + 1} from Page {page_num}\n\n"
                            markdown_table = convert_table_to_markdown(table)
                            
                            # Add the table to the text
                            if markdown_table:
                                full_text += table_header + markdown_table + "\n"
        
        return {
            "success": True,
            "text": full_text.strip(),
            "page_count": total_pages,
            "has_tables": True
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def process_pdf(pdf_path: str) -> Dict[str, Any]:
    """
    Process a PDF file and extract text with tables.
    
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
    
    # Extract text and tables
    return extract_text_and_tables(pdf_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract text and tables from PDF using pdfplumber")
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