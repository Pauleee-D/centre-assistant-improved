'use client';

import { useState } from 'react';

interface FeedbackButtonsProps {
  question: string;
  answer: string;
  system: 'original' | 'improved';
}

export function FeedbackButtons({ question, answer, system }: FeedbackButtonsProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRating = async (newRating: 'positive' | 'negative') => {
    setRating(newRating);
    setShowComment(true);
  };

  const handleSubmit = async () => {
    if (!rating) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answer,
          rating,
          comment: comment.trim() || undefined,
          system,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setShowComment(false);
          setComment('');
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setShowComment(false);
    setSubmitted(true);
    setTimeout(() => {
      setComment('');
    }, 2000);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <span>✓ Thank you for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Was this helpful?</span>
        <button
          onClick={() => handleRating('positive')}
          disabled={rating !== null}
          className={`p-2 rounded transition-colors ${
            rating === 'positive'
              ? 'bg-green-100 text-green-600'
              : 'hover:bg-muted text-muted-foreground'
          } disabled:cursor-not-allowed`}
          title="Helpful"
        >
          👍
        </button>
        <button
          onClick={() => handleRating('negative')}
          disabled={rating !== null}
          className={`p-2 rounded transition-colors ${
            rating === 'negative'
              ? 'bg-red-100 text-red-600'
              : 'hover:bg-muted text-muted-foreground'
          } disabled:cursor-not-allowed`}
          title="Not helpful"
        >
          👎
        </button>
      </div>

      {showComment && (
        <div className="space-y-2 animate-in slide-in-from-top-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional: Tell us more about your experience..."
            className="w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            <button
              onClick={handleSkip}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-sm border rounded hover:bg-muted disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
