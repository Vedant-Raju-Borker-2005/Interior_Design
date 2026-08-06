'use client'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import clsx from 'clsx'

const BHK_OPTIONS = [
  {
    id: '1BHK',
    label: '1 BHK',
    desc: 'Studio & compact living',
    rooms: 4,
    icon: '🛏️',
    priceFrom: '2.9L',
  },
  {
    id: '2BHK',
    label: '2 BHK',
    desc: 'Perfect for couples & small families',
    rooms: 6,
    icon: '🏠',
    priceFrom: '4.8L',
  },
  {
    id: '3BHK',
    label: '3 BHK',
    desc: 'Spacious family home',
    rooms: 8,
    icon: '🏡',
    priceFrom: '6.8L',
  },
  {
    id: '4BHK',
    label: '4 BHK',
    desc: 'Large family residence',
    rooms: 10,
    icon: '🏘️',
    priceFrom: '9.5L',
  },
  {
    id: '5BHK',
    label: '5 BHK',
    desc: 'Luxury villa & bungalow',
    rooms: 13,
    icon: '🏰',
    priceFrom: '14L',
  },
]

interface Props {
  selected?: string
  onSelect: (bhk: string) => void
}

export default function BhkSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {BHK_OPTIONS.map((opt, i) => (
        <motion.button
          key={opt.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          onClick={() => onSelect(opt.id)}
          className={clsx(
            'relative p-5 rounded-2xl border-2 text-left transition-all duration-200 group',
            selected === opt.id
              ? 'border-indigo-500 bg-indigo-50 shadow-glow-indigo'
              : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-card'
          )}
        >
          {selected === opt.id && (
            <div className="absolute top-3 right-3">
              <CheckCircle className="w-5 h-5 text-indigo-600 fill-indigo-100" />
            </div>
          )}
          <div className="text-3xl mb-2">{opt.icon}</div>
          <div
            className={clsx(
              'text-xl font-bold mb-1',
              selected === opt.id ? 'text-indigo-700' : 'text-slate-800'
            )}
          >
            {opt.label}
          </div>
          <div className="text-xs text-slate-500 mb-2 leading-tight">{opt.desc}</div>
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400">{opt.rooms} rooms</span>
            <span className="text-xs font-semibold text-indigo-500">from ₹{opt.priceFrom}</span>
          </div>
        </motion.button>
      ))}
    </div>
  )
}
