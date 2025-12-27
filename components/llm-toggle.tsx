interface LLMToggleProps {
  value: 'gemini' | 'groq';
  onChange: (value: 'gemini' | 'groq') => void;
  disabled?: boolean;
}

export function LLMToggle({ value, onChange, disabled = false }: LLMToggleProps) {
  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        AI Model:
      </label>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => onChange('gemini')}
          disabled={disabled}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
            value === 'gemini'
              ? 'bg-blue-600 text-white shadow-lg transform scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="text-center">
            <div className="text-lg">Google Gemini</div>
            <div className="text-xs mt-1 opacity-80">Enhanced details • 5-7s</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChange('groq')}
          disabled={disabled}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
            value === 'groq'
              ? 'bg-green-600 text-white shadow-lg transform scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-green-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="text-center">
            <div className="text-lg">Groq (Llama)</div>
            <div className="text-xs mt-1 opacity-80">Faster speed • 2-4s</div>
          </div>
        </button>
      </div>
    </div>
  );
}
