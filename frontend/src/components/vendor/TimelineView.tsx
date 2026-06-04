'use client';

interface Resource {
  id: string;
  title: string;
  status: string;
  createdAt: Date | string;
  dueDate?: Date | string | null;
}

interface TimelineViewProps {
  resources: Resource[];
}

export function TimelineView({ resources }: TimelineViewProps) {
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm overflow-hidden select-none">
      <h3 className="font-bold text-slate-800 text-sm mb-6 uppercase tracking-wider">Project Timeline (Gantt)</h3>
      
      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex border-b border-slate-200 bg-slate-55">
          <div className="w-1/3 p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200">
            Design Resource / Milestone
          </div>
          <div className="w-2/3 flex">
            {weeks.map((week, idx) => (
              <div key={idx} className="flex-1 text-center p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 last:border-r-0">
                {week}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {resources.map((res, index) => {
            const spanClass =
              index % 4 === 0
                ? 'col-start-1 col-span-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'
                : index % 4 === 1
                ? 'col-start-2 col-span-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                : index % 4 === 2
                ? 'col-start-3 col-span-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                : 'col-start-1 col-span-4 bg-gradient-to-r from-teal-500 to-emerald-600 text-white';

            return (
              <div key={res.id} className="flex items-center hover:bg-slate-50/50 transition-colors">
                <div className="w-1/3 p-4 text-sm font-semibold text-slate-700 border-r border-slate-200 truncate">
                  {res.title}
                </div>
                <div className="w-2/3 p-4">
                  <div className="grid grid-cols-4 gap-2">
                    <div className={`${spanClass} text-[10px] font-bold py-1.5 px-3 rounded-xl shadow-sm truncate flex items-center justify-between`}>
                      <span>{res.status}</span>
                      <span className="opacity-75">ID: {res.id.substring(0, 4)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TimelineView;
