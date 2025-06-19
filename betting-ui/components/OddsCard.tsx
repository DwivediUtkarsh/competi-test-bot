import React from 'react';

interface OddsCardProps {
  title: string;
  probability: number; // expressed as 0-1
  accentColor: 'green' | 'red' | 'blue' | 'yellow';
  onClick?: () => void;
  selected?: boolean;
}

const accentMap = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    bar: 'bg-green-500',
    hover: 'hover:bg-green-100 hover:border-green-300',
    selected: 'ring-green-500 bg-green-100 border-green-400'
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    bar: 'bg-red-500',
    hover: 'hover:bg-red-100 hover:border-red-300',
    selected: 'ring-red-500 bg-red-100 border-red-400'
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    bar: 'bg-blue-500',
    hover: 'hover:bg-blue-100 hover:border-blue-300',
    selected: 'ring-blue-500 bg-blue-100 border-blue-400'
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    bar: 'bg-yellow-500',
    hover: 'hover:bg-yellow-100 hover:border-yellow-300',
    selected: 'ring-yellow-500 bg-yellow-100 border-yellow-400'
  }
};

export default function OddsCard({ title, probability, accentColor, onClick, selected }: OddsCardProps) {
  const accent = accentMap[accentColor];
  const percentage = (probability * 100).toFixed(1);

  return (
    <button
      onClick={onClick}
      className={`
        relative p-6 rounded-xl border-2 shadow-lg transition-all duration-200 w-full text-left
        cursor-pointer transform hover:scale-105 hover:shadow-xl
        ${selected 
          ? `ring-4 ring-offset-2 ${accent.selected} shadow-xl scale-105` 
          : `${accent.bg} ${accent.border} ${accent.hover} hover:shadow-xl`
        }
        ${accent.text}
        active:scale-95
        focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-blue-500
      `}
    >
      {/* Click to bet indicator */}
      <div className="absolute top-2 right-2">
        <div className={`w-3 h-3 rounded-full ${selected ? 'bg-blue-500' : 'bg-gray-300'} transition-colors`} />
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <span className="font-bold text-xl mb-1">{title}</span>
          <span className="text-xs uppercase tracking-wide font-medium opacity-75">
            {selected ? 'Selected' : 'Click to bet'}
          </span>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black">{percentage}%</span>
          <div className="text-xs opacity-75 mt-1">
            {selected ? '✓ Ready' : 'Probability'}
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div
          className={`${accent.bar} h-full transition-all duration-300 shadow-sm`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {/* Bet indicator */}
      <div className="mt-4 text-center">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-all ${
          selected 
            ? 'bg-blue-100 text-blue-800 border border-blue-300' 
            : 'bg-white/70 text-gray-600 border border-gray-300'
        }`}>
          {selected ? '🎯 Selected for Betting' : '👆 Tap to Select'}
        </span>
      </div>
    </button>
  );
} 