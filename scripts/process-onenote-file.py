from docling.document_converter import DocumentConverter
from pathlib import Path

def process_pdf_file(pdf_file, output_dir):
    """Process a PDF file with Docling and save as markdown"""

    print(f"Processing PDF file: {pdf_file}")

    # Initialize Docling converter
    converter = DocumentConverter()

    try:
        # Convert the PDF file
        print("  Converting with Docling...")
        result = converter.convert(str(pdf_file))

        # Export to markdown
        print("  Exporting to markdown...")
        markdown_content = result.document.export_to_markdown()

        # Save the markdown
        output_file = output_dir / "Albany Creek.md"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(markdown_content)

        print(f"  SUCCESS - Saved to {output_file}")
        print(f"  Length: {len(markdown_content)} characters")

        return True

    except Exception as e:
        print(f"  ERROR - {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    # Paths
    pdf_file = Path('c:/Projects/Albany Creek.pdf')
    output_dir = Path('c:/Projects/centre2/data/list')

    # Check if file exists
    if not pdf_file.exists():
        print(f"ERROR - PDF file not found: {pdf_file}")
        return

    print(f"PDF file found: {pdf_file}")
    print(f"Size: {pdf_file.stat().st_size / 1024:.1f} KB")
    print(f"Output directory: {output_dir}\n")

    # Process the file
    success = process_pdf_file(pdf_file, output_dir)

    if success:
        print("\n" + "="*60)
        print("PDF processing complete!")
        print("="*60)
    else:
        print("\nProcessing failed!")

if __name__ == '__main__':
    main()
