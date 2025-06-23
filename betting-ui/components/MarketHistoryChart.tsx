import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  LinearScale,
  CategoryScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import axios from 'axios';

ChartJS.register(LineElement, LinearScale, CategoryScale, PointElement, Tooltip, Legend, Filler);

interface HistoryPoint {
  t: number; // timestamp (ms)
  p_yes: number;
  p_no: number;
}

interface OutcomeInfo {
  title: string;
  tokenId: string;
}

interface Props {
  outcomes: OutcomeInfo[]; // expects two entries YES/NO order
  simple?: boolean; // compact mode for embedding
}

export default function MarketHistoryChart({ outcomes, simple = false }: Props) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState<'1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'>('1D');

  // Define secondsBack & fidelity per range for optimal rendering
  const rangeConfig: Record<typeof range, { secondsBack: number; fidelity: number; labelFmt: 'time' | 'date' }> = {
    '1H': { secondsBack: 3600, fidelity: 1, labelFmt: 'time' },
    '6H': { secondsBack: 21600, fidelity: 2, labelFmt: 'time' },
    '1D': { secondsBack: 86400, fidelity: 5, labelFmt: 'time' },
    '1W': { secondsBack: 604800, fidelity: 30, labelFmt: 'date' },
    '1M': { secondsBack: 2592000, fidelity: 120, labelFmt: 'date' },
    'ALL': { secondsBack: 157680000, fidelity: 1440, labelFmt: 'date' }, // 5y
  } as const;

  useEffect(() => {
    const fetchHistory = async () => {
      const clobBase = process.env.NODE_ENV === 'development' ? '/api/proxy/clob' : 'https://clob.polymarket.com';

      // Early return if we don't have two outcome token IDs yet (rare but defensive)
      if (outcomes.length < 2) return;

      const tokenYes = outcomes[0].tokenId;
      const tokenNo = outcomes[1].tokenId;

      // Build request params. For broader ranges, the CLOB API prefers the `interval` shortcut (1h,1d,1w,1m,max).
      const { secondsBack, fidelity } = rangeConfig[range];
      const nowSec = Math.floor(Date.now() / 1000);

      const rangeToInterval: Record<typeof range, string> = {
        '1H': '1h',
        '6H': '6h',
        '1D': '1d',
        '1W': '1w',
        '1M': '1m',
        'ALL': 'max',
      } as const;

      const fetchSeries = async (tokenId: string) => {
        const params: any = { market: tokenId, fidelity };

        // For ALL / 1M / etc, rely on interval; for finer ranges stick with explicit timestamps to avoid server-side rounding.
        if (range === '1H' || range === '6H') {
          params.startTs = nowSec - secondsBack;
          params.endTs = nowSec;
        } else {
          params.interval = rangeToInterval[range];
        }

        const res = await axios.get(`${clobBase}/prices-history`, { params, timeout: 10000 });
        return (res.data.history || []) as { t: number; p: number }[];
      };

      try {
        const [seriesYes, seriesNo] = await Promise.all([fetchSeries(tokenYes), fetchSeries(tokenNo)]);

        // merge by index (API guarantees same length)
        const merged: HistoryPoint[] = seriesYes.map((pt, idx) => ({
          t: pt.t * 1000, // convert s → ms
          p_yes: pt.p,
          p_no: seriesNo[idx]?.p ?? null,
        }));

        console.log('📈 CLOB history fetched', merged.length, 'fidelity', fidelity);
        setPoints(merged);
      } catch (err: any) {
        console.warn('❌ Failed CLOB history', err.response?.status || err.message);
      }
    };

    fetchHistory();
  }, [range, outcomes]);

  // transform for chart
  const labelFmt = rangeConfig[range].labelFmt;
  const labels = points.map(p => {
    const d = new Date(p.t);
    return labelFmt === 'time' ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString();
  });
  const data = {
    labels,
    datasets: [
      {
        label: outcomes[0]?.title || 'YES',
        data: points.map(p => p.p_yes * 100),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        tension: 0.3,
        fill: true,
        spanGaps: true,
        borderWidth: 2,
      },
      {
        label: outcomes[1]?.title || 'NO',
        data: points.map(p => p.p_no * 100),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239,68,68,0.1)',
        tension: 0.3,
        fill: true,
        spanGaps: true,
        borderWidth: 2,
      },
    ],
  };

  // Dynamically determine y-axis bounds so that the graph focuses on the visible range
  const allYValues = points
    .flatMap(p => [p.p_yes * 100, p.p_no * 100])
    .filter(v => v !== null && !Number.isNaN(v));

  const computedMin = allYValues.length ? Math.min(...allYValues) : 0;
  const computedMax = allYValues.length ? Math.max(...allYValues) : 100;

  // Add a small padding and keep inside 0-100 bounds
  const yMin = Math.max(0, Math.floor(computedMin - 5));
  const yMax = Math.min(100, Math.ceil(computedMax + 5));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 8,
          autoSkip: true,
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          callback: (v: any) => v + '%',
          maxTicksLimit: 6,
        },
        min: yMin,
        max: yMax,
        grid: {
          color: '#E5E7EB', // Tailwind gray-200 for lighter grid lines
          borderDash: [4, 4],
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    animation: false,
    layout: {
      padding: {
        bottom: 28, // extra space for x-axis labels
        top: 12,
      },
    },
  } as const;

  return (
    <div className={`${simple ? '' : 'bg-white rounded-lg shadow-md border border-gray-200 mt-6'} pt-4 pb-6 px-4 h-64 sm:h-80 md:h-96`}>
      {!simple && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">📈 Price History</h3>
          <div className="flex gap-1 text-xs font-medium">
            {(['1H','6H','1D','1W','1M','ALL'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 rounded ${range===r?'bg-blue-600 text-white':'bg-gray-200 text-gray-700'}`}
              >{r}</button>
            ))}
          </div>
        </div>
      )}

      {simple && (
        <div className="flex justify-end mb-2 text-xs font-medium gap-1">
          {(['1H','6H','1D','1W','1M','ALL'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 rounded ${range===r?'bg-blue-600 text-white':'bg-gray-200 text-gray-700'}`}
            >{r}</button>
          ))}
        </div>
      )}

      {simple && (
        <div className="flex gap-4 text-xs font-medium mb-2">
          <div className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full inline-block" style={{background:'#3B82F6'}}></span>Yes</div>
          <div className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full inline-block" style={{background:'#EF4444'}}></span>No</div>
        </div>
      )}

      {!simple && (
        <div className="flex gap-4 text-xs font-medium mb-2">
          <div className="flex items-center gap-1"><span className="w-4 h-1.5 rounded-full inline-block" style={{background:'#3B82F6'}}></span>Yes</div>
          <div className="flex items-center gap-1"><span className="w-4 h-1.5 rounded-full inline-block" style={{background:'#EF4444'}}></span>No</div>
        </div>
      )}

      <div className="relative w-full h-full">
        <Line data={data} options={options} />
      </div>
    </div>
  );
} 