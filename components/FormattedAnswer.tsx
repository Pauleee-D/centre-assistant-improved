import React from 'react';

export function FormattedAnswer({ answer }: { answer: string }) {
  // Process the answer text to add formatting
  const formatText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let currentList: string[] = [];
    let listType: 'bullet' | 'number' | null = null;

    // Parse inline markdown (bold, italic) - defined before flushList
    const parseInlineMarkdown = (text: string) => {
      const parts: (string | React.ReactElement)[] = [];
      let currentIndex = 0;
      let keyCounter = 0;

      // Regex to match **bold** or *italic*
      const markdownRegex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
      let match;

      while ((match = markdownRegex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > currentIndex) {
          parts.push(text.substring(currentIndex, match.index));
        }

        // Add formatted text
        if (match[2]) {
          // **bold**
          parts.push(<strong key={`bold-${keyCounter++}`}>{match[2]}</strong>);
        } else if (match[3]) {
          // *italic*
          parts.push(<em key={`italic-${keyCounter++}`}>{match[3]}</em>);
        }

        currentIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (currentIndex < text.length) {
        parts.push(text.substring(currentIndex));
      }

      return parts.length > 0 ? parts : text;
    };

    const flushList = (index: number) => {
      if (currentList.length > 0) {
        if (listType === 'bullet') {
          elements.push(
            <ul key={`list-${index}`} className="list-disc list-inside space-y-2 my-3 ml-4">
              {currentList.map((item, i) => (
                <li key={i} className="leading-relaxed">{parseInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        } else if (listType === 'number') {
          elements.push(
            <ol key={`list-${index}`} className="list-decimal list-inside space-y-2 my-3 ml-4">
              {currentList.map((item, i) => (
                <li key={i} className="leading-relaxed">{parseInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }
        currentList = [];
        listType = null;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushList(index);
        return;
      }

      // Check for bullet points (-, *, •)
      const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) {
        if (listType !== 'bullet') {
          flushList(index);
          listType = 'bullet';
        }
        currentList.push(bulletMatch[1]);
        return;
      }

      // Check for numbered lists (1., 2., etc.)
      const numberMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (numberMatch) {
        if (listType !== 'number') {
          flushList(index);
          listType = 'number';
        }
        currentList.push(numberMatch[1]);
        return;
      }

      // Check for section headers (line ending with :)
      if (trimmed.endsWith(':')) {
        flushList(index);
        elements.push(
          <h4 key={`heading-${index}`} className="font-semibold text-base mt-4 mb-2">
            {trimmed.slice(0, -1)}
          </h4>
        );
        return;
      }

      // Regular text
      flushList(index);
      elements.push(
        <p key={`p-${index}`} className="leading-relaxed mb-3">
          {parseInlineMarkdown(trimmed)}
        </p>
      );
    });

    flushList(lines.length);
    return elements;
  };

  return (
    <div className="text-sm bg-muted p-6 rounded-lg">
      {formatText(answer)}
    </div>
  );
}
