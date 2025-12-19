import React from 'react';

export function formatAnswer(answer: string): React.ReactElement[] {
  // Split by double newlines to separate paragraphs
  const paragraphs = answer.split('\n\n');

  return paragraphs.map((para, idx) => {
    // Check if it's a list item (starts with - or •)
    if (para.trim().startsWith('-') || para.trim().startsWith('•')) {
      const items = para.split('\n').filter(line => line.trim());
      return (
        <ul key={idx} className="list-disc list-inside space-y-1 ml-4">
          {items.map((item, i) => (
            <li key={i}>{item.replace(/^[-•]\s*/, '')}</li>
          ))}
        </ul>
      );
    }

    // Check if it's a numbered list
    if (/^\d+\./.test(para.trim())) {
      const items = para.split('\n').filter(line => line.trim());
      return (
        <ol key={idx} className="list-decimal list-inside space-y-1 ml-4">
          {items.map((item, i) => (
            <li key={i}>{item.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ol>
      );
    }

    // Check if it's a heading (contains : at the end)
    if (para.includes(':') && para.split(':')[1].trim().length === 0) {
      return (
        <h4 key={idx} className="font-semibold text-base mt-4 mb-2">
          {para.replace(':', '')}
        </h4>
      );
    }

    // Regular paragraph
    return (
      <p key={idx} className="leading-relaxed">
        {para}
      </p>
    );
  });
}
