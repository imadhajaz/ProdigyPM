"""
PDF Parser Service - Extract text from PDF files
"""
import io
import logging
from typing import Optional, Dict
import pdfplumber

logger = logging.getLogger(__name__)


class PDFParser:
    """Service for parsing PDF files and extracting text"""
    
    @staticmethod
    def extract_text(pdf_content: bytes) -> Dict[str, any]:
        """
        Extract text from PDF file content.
        
        Args:
            pdf_content: PDF file content as bytes
            
        Returns:
            Dictionary with extracted text and metadata:
            {
                "text": str,           # Full extracted text
                "page_count": int,     # Number of pages
                "char_count": int,     # Character count
                "word_count": int,     # Word count
                "pages": [str, ...]    # Text per page
            }
        """
        try:
            # Create file-like object from bytes
            pdf_file = io.BytesIO(pdf_content)
            
            # Extract text using pdfplumber
            full_text = ""
            pages_text = []
            page_count = 0
            
            with pdfplumber.open(pdf_file) as pdf:
                page_count = len(pdf.pages)
                logger.info(f"Processing PDF with {page_count} pages")
                
                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            pages_text.append(page_text)
                            full_text += f"\n\n--- Page {page_num} ---\n\n{page_text}"
                        else:
                            logger.warning(f"No text found on page {page_num}")
                            pages_text.append("")
                    except Exception as e:
                        logger.error(f"Error extracting text from page {page_num}: {e}")
                        pages_text.append("")
            
            # Calculate statistics
            char_count = len(full_text)
            word_count = len(full_text.split()) if full_text else 0
            
            logger.info(f"Extracted {char_count} characters, {word_count} words from {page_count} pages")
            
            return {
                "text": full_text.strip(),
                "page_count": page_count,
                "char_count": char_count,
                "word_count": word_count,
                "pages": pages_text
            }
            
        except Exception as e:
            logger.error(f"Failed to extract text from PDF: {e}")
            raise ValueError(f"PDF parsing failed: {str(e)}")
    
    @staticmethod
    def extract_text_summary(pdf_content: bytes, max_chars: int = 1000) -> str:
        """
        Extract a summary/preview of text from PDF (first N characters).
        
        Args:
            pdf_content: PDF file content as bytes
            max_chars: Maximum characters to extract (default: 1000)
            
        Returns:
            String with text preview
        """
        result = PDFParser.extract_text(pdf_content)
        text = result["text"]
        
        if len(text) <= max_chars:
            return text
        
        # Truncate and add ellipsis
        return text[:max_chars] + "..."
    
    @staticmethod
    def extract_metadata(pdf_content: bytes) -> Dict[str, any]:
        """
        Extract metadata from PDF file.
        
        Args:
            pdf_content: PDF file content as bytes
            
        Returns:
            Dictionary with PDF metadata
        """
        try:
            pdf_file = io.BytesIO(pdf_content)
            
            with pdfplumber.open(pdf_file) as pdf:
                metadata = {
                    "page_count": len(pdf.pages),
                    "metadata": pdf.metadata or {}
                }
                
                # Try to get document info
                if pdf.metadata:
                    metadata.update({
                        "title": pdf.metadata.get("Title", ""),
                        "author": pdf.metadata.get("Author", ""),
                        "subject": pdf.metadata.get("Subject", ""),
                        "creator": pdf.metadata.get("Creator", ""),
                        "producer": pdf.metadata.get("Producer", ""),
                        "creation_date": pdf.metadata.get("CreationDate", ""),
                        "modification_date": pdf.metadata.get("ModDate", "")
                    })
                
                return metadata
                
        except Exception as e:
            logger.error(f"Failed to extract PDF metadata: {e}")
            return {
                "page_count": 0,
                "metadata": {},
                "error": str(e)
            }

