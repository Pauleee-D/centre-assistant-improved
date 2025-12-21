import os
import re
from pathlib import Path

def clean_markdown(content):
    """Clean markdown content by removing images, timestamps, and excessive whitespace"""

    # Remove base64 encoded images
    content = re.sub(r'!\[Image\]\(data:image/[^)]+\)', '', content)

    # Remove standalone image tags
    content = re.sub(r'!\[\]\([^)]+\)', '', content)

    # Remove timestamp patterns like "Thursday,December 01,2022 12:43 PM"
    content = re.sub(r'\w+,\w+\s+\d+,\d{4}\s+\d+:\d+\s+[AP]M', '', content)

    # Remove excessive blank lines (more than 2 consecutive)
    content = re.sub(r'\n{3,}', '\n\n', content)

    # Remove lines that are just whitespace
    lines = content.split('\n')
    cleaned_lines = [line.rstrip() for line in lines]
    content = '\n'.join(cleaned_lines)

    # Remove trailing whitespace at end of file
    content = content.strip()

    return content

def main():
    # Path to the markdown files
    data_dir = Path('c:/Projects/centre2/data/list')

    # Get all markdown files
    md_files = list(data_dir.glob('*.md'))

    print(f"Found {len(md_files)} markdown files to clean")

    for md_file in md_files:
        print(f"Cleaning: {md_file.name}")

        # Read the file
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Clean the content
        cleaned_content = clean_markdown(content)

        # Write back to file
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(cleaned_content)

        print(f"  - Cleaned {md_file.name}")

    print(f"\nAll {len(md_files)} files have been cleaned!")

if __name__ == '__main__':
    main()
