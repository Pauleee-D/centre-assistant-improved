'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { FormattedAnswer } from '@/components/FormattedAnswer';

export default function ComparePage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  // Original RAG results
  const [originalAnswer, setOriginalAnswer] = useState('');
  const [originalSources, setOriginalSources] = useState<string[]>([]);
  const [originalTime, setOriginalTime] = useState(0);

  // Improved RAG results
  const [improvedAnswer, setImprovedAnswer] = useState('');
  const [improvedSources, setImprovedSources] = useState<string[]>([]);
  const [improvedTime, setImprovedTime] = useState(0);
  const [improvedDebug, setImprovedDebug] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setOriginalAnswer('');
    setImprovedAnswer('');
    setOriginalSources([]);
    setImprovedSources([]);
    setImprovedDebug(null);

    try {
      // Call both endpoints in parallel
      const [originalResponse, improvedResponse] = await Promise.all([
        // Original RAG
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
          setOriginalTime(Math.round(end - start));
          return response.json();
        })(),

        // Improved RAG
        (async () => {
          const start = performance.now();
          const response = await fetch('/api/query-improved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question,
              centre: 'whitlamleisurecentre'
            }),
          });
          const end = performance.now();
          setImprovedTime(Math.round(end - start));
          return response.json();
        })(),
      ]);

      setOriginalAnswer(originalResponse.answer || 'No answer received');
      setOriginalSources(originalResponse.sources || []);

      setImprovedAnswer(improvedResponse.answer || 'No answer received');
      setImprovedSources(improvedResponse.sources || []);
      setImprovedDebug(improvedResponse.debug || null);
    } catch (error) {
      console.error('Error:', error);
      setOriginalAnswer('Error processing request');
      setImprovedAnswer('Error processing request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">RAG System Comparison</h1>
            <p className="text-muted-foreground">
              Compare the original and improved RAG systems side by side
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
          {/* Original RAG */}
          <div className="border rounded-lg p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Original RAG</h2>
              {originalTime > 0 && (
                <span className="text-sm text-muted-foreground">
                  {originalTime}ms
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Features:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Simple vector similarity search</li>
                  <li>Top-K retrieval (K=10)</li>
                  <li>Basic filtering by centre</li>
                  <li>Direct LLM generation</li>
                </ul>
              </div>

              {originalAnswer && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Answer:</h3>
                    <FormattedAnswer answer={originalAnswer} />
                  </div>

                  {originalSources.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Sources ({originalSources.length}):</h3>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {originalSources.map((source, idx) => (
                          <li key={idx}>{source}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Improved RAG */}
          <div className="border rounded-lg p-6 bg-card border-green-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-green-600">Improved RAG</h2>
              {improvedTime > 0 && (
                <span className="text-sm text-muted-foreground">
                  {improvedTime}ms
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Features:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>✅ Query expansion (multiple phrasings)</li>
                  <li>✅ Multi-query retrieval (K=15 per query)</li>
                  <li>✅ Result deduplication</li>
                  <li>✅ Cohere reranking (top 5)</li>
                  <li>✅ Enhanced context building</li>
                </ul>
              </div>

              {improvedDebug && (
                <div className="bg-muted p-3 rounded text-xs">
                  <h3 className="font-semibold mb-1">Debug Info:</h3>
                  <div className="space-y-1 text-muted-foreground">
                    <div>Query Expansion: {improvedDebug.queryExpansion ? '✅' : '❌'}</div>
                    <div>Reranking: {improvedDebug.reranking ? '✅' : '❌'}</div>
                    <div>Total Results: {improvedDebug.totalResults}</div>
                    <div>Filtered: {improvedDebug.filteredResults}</div>
                    <div>Final: {improvedDebug.finalResults}</div>
                  </div>
                </div>
              )}

              {improvedAnswer && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Answer:</h3>
                    <FormattedAnswer answer={improvedAnswer} />
                  </div>

                  {improvedSources.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Sources ({improvedSources.length}):</h3>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {improvedSources.map((source, idx) => (
                          <li key={idx}>{source}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Improvement Summary */}
        {originalAnswer && improvedAnswer && (
          <div className="mt-8 border rounded-lg p-6 bg-blue-50 dark:bg-blue-950">
            <h2 className="text-2xl font-bold mb-4">Key Improvements</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">🔍 Better Retrieval</h3>
                <p className="text-muted-foreground">
                  Query expansion generates alternative phrasings to catch more relevant documents.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🎯 Smarter Ranking</h3>
                <p className="text-muted-foreground">
                  Cohere reranking reorders results by semantic relevance, not just vector similarity.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">📊 More Context</h3>
                <p className="text-muted-foreground">
                  Multi-query retrieval surfaces more diverse, relevant information for better answers.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
