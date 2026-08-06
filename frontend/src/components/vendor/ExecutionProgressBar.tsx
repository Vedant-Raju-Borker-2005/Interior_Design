'use client';

interface Props {
  progress: number;
  status: string;
}

export function ExecutionProgressBar({ progress, status }: Props) {
  const milestones = [
    { name: 'Ordered', minProgress: 10 },
    { name: 'Production', minProgress: 30 },
    { name: 'Dispatched', minProgress: 50 },
    { name: 'Delivered', minProgress: 75 },
    { name: 'Installed', minProgress: 100 },
  ];

  const isDelayed = status === 'DELAYED';

  return (
    <div className="w-full bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Execution Progress
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isDelayed ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="text-sm font-bold text-slate-700">
              {isDelayed ? 'Delayed Status Alert' : 'On Track'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-indigo-600 tracking-tight">
            {progress}%
          </span>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6 border border-slate-200/20">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isDelayed
              ? 'bg-gradient-to-r from-red-500 to-rose-600'
              : 'bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Milestones Steps */}
      <div className="grid grid-cols-5 gap-2 relative">
        {milestones.map((m, i) => {
          const completed = progress >= m.minProgress;
          return (
            <div key={i} className="flex flex-col items-center text-center group">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  completed
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-110'
                    : 'bg-slate-100 text-slate-400 border border-slate-200/50 group-hover:bg-slate-200/50 group-hover:text-slate-600'
                }`}
              >
                {completed ? '✓' : i + 1}
              </div>
              <span
                className={`mt-2.5 text-[10px] uppercase font-bold tracking-wider transition-colors duration-200 ${
                  completed ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-500'
                }`}
              >
                {m.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ExecutionProgressBar;
