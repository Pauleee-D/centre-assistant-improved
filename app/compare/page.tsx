'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { FormattedAnswer } from '@/components/FormattedAnswer';
import { FeedbackButtons } from '@/components/FeedbackButtons';

export default function ComparePage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  // Gemini (Google) results
  const [geminiAnswer, setGeminiAnswer] = useState('');
  const [geminiSources, setGeminiSources] = useState<string[]>([]);
  const [geminiTime, setGeminiTime] = useState(0);

  // Groq results
  const [groqAnswer, setGroqAnswer] = useState('');
  const [groqSources, setGroqSources] = useState<string[]>([]);
  const [groqTime, setGroqTime] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setGeminiAnswer('');
    setGroqAnswer('');
    setGeminiSources([]);
    setGroqSources([]);

    try {
      // Call both endpoints in parallel
      const [geminiResponse, groqResponse] = await Promise.all([
        // Gemini (Google)
        (async () => {
          const start = performance.now();
          const response = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question,
              centre: 'whitlamleisurecentre'
            }),
          });
          const end = performance.now();
          setGeminiTime(Math.round(end - start));
          return response.json();
        })(),

        // Groq
        (async () => {
          const start = performance.now();
          const response = await fetch('/api/query-groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question,
              centre: 'whitlamleisurecentre'
            }),
          });
          const end = performance.now();
          setGroqTime(Math.round(end - start));
          return response.json();
        })(),
      ]);

      setGeminiAnswer(geminiResponse.answer || 'No answer received');
      setGeminiSources(geminiResponse.sources || []);

      setGroqAnswer(groqResponse.answer || 'No answer received');
      setGroqSources(groqResponse.sources || []);
    } catch (error) {
      console.error('Error:', error);
      setGeminiAnswer('Error processing request');
      setGroqAnswer('Error processing request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">LLM Performance Comparison</h1>
            <p className="text-muted-foreground">
              Compare Google Gemini vs Groq side by side
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Query Input */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about Whitlam Leisure Centre..."
              className="flex-1 px-4 py-3 border rounded-lg bg-background"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {loading ? 'Querying...' : 'Ask Question'}
            </button>
          </div>
        </form>

        {/* Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gemini (Google) */}
          <div className="border rounded-lg p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Google Gemini</h2>
              {geminiTime > 0 && (
                <span className="text-sm text-muted-foreground">
                  {geminiTime}ms
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Details:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Model: gemini-2.5-flash</li>
                  <li>Embeddings: text-embedding-004 (768-dim)</li>
                  <li>Speed: 5-7 seconds typical</li>
                  <li>Free tier: 1,500 requests/day</li>
                </ul>
              </div>

              {geminiAnswer && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Answer:</h3>
                    <FormattedAnswer answer={geminiAnswer} />
                  </div>

                  {geminiSources.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Sources ({geminiSources.length}):</h3>
                      <div className="flex flex-wrap gap-2">
                        {geminiSources.map((source: any, idx) => (
                          <a
                            key={idx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          >
                            {source.title} →
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    <FeedbackButtons
                      question={question}
                      answer={geminiAnswer}
                      system="gemini"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Groq */}
          <div className="border rounded-lg p-6 bg-card border-green-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-green-600">Groq</h2>
              {groqTime > 0 && (
                <span className="text-sm text-muted-foreground">
                  {groqTime}ms
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Details:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Model: llama-3.1-8b-instant</li>
                  <li>Embeddings: text-embedding-004 (768-dim)</li>
                  <li>Speed: 2-4 seconds typical (2-3x faster)</li>
                  <li>Free tier: 14,400 requests/day</li>
                </ul>
              </div>

              {groqAnswer && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Answer:</h3>
                    <FormattedAnswer answer={groqAnswer} />
                  </div>

                  {groqSources.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Sources ({groqSources.length}):</h3>
                      <div className="flex flex-wrap gap-2">
                        {groqSources.map((source: any, idx) => (
                          <a
                            key={idx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          >
                            {source.title} →
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    <FeedbackButtons
                      question={question}
                      answer={groqAnswer}
                      system="groq"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        {geminiAnswer && groqAnswer && (
          <div className="mt-8 border rounded-lg p-6 bg-blue-50 dark:bg-blue-950">
            <h2 className="text-2xl font-bold mb-4">Performance Comparison</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">⚡ Speed</h3>
                <p className="text-muted-foreground">
                  Groq is typically 2-3x faster than Gemini thanks to its custom LPU hardware designed for LLM inference.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">📊 Free Tier</h3>
                <p className="text-muted-foreground">
                  Groq offers 14,400 requests/day vs Gemini's 1,500 requests/day, making it more generous for testing.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🎯 Quality</h3>
                <p className="text-muted-foreground">
                  Both use the same vector search (Google embeddings + Pinecone). Answer quality depends on the LLM model.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
