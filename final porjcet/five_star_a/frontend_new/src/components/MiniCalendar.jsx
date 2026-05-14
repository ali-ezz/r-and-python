import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function MiniCalendar({ onDayClick }) {
  const { tasks } = useAppStore()
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

  const taskDays = useMemo(() => {
    const set = new Set()
    if (Array.isArray(tasks)) {
      tasks.forEach(t => {
        if (t.due_date) {
          const d = new Date(t.due_date)
          if (!isNaN(d.getTime())) set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
        }
      })
    }
    return set
  }, [tasks])

  const prevMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), [])
  const nextMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), [])

  const handleDayClick = useCallback((day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDay(day)
    onDayClick?.(dateStr, day)
  }, [year, month, onDayClick])

  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startPad = first.getDay()
    const totalDays = last.getDate()
    const result = []
    for (let i = 0; i < startPad; i++) result.push({ day: '', key: `pad-${i}` })
    for (let d = 1; d <= totalDays; d++) {
      const key = `${year}-${month}-${d}`
      result.push({ day: d, key, isToday: key === todayKey, hasTask: taskDays.has(key), isSelected: d === selectedDay })
    }
    while (result.length % 7 !== 0) result.push({ day: '', key: `pad-end-${result.length}` })
    return result
  }, [year, month, todayKey, taskDays, selectedDay])

  const monthName = viewDate.toLocaleString('default', { month: 'short', year: 'numeric' })

  return (
    <div className="flex flex-col h-full w-full p-1">
      {/* Month Nav */}
      <div className="flex items-center justify-between py-2 flex-shrink-0">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{monthName}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Calendar Grid - fills remaining space */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2 flex-shrink-0">
          {DAYS.map(d => (
            <div key={d} className="text-[10px] font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{d}</div>
          ))}
        </div>

        {/* Day Cells - fills all remaining space evenly */}
        <div className="grid grid-cols-7 gap-1 text-center flex-1 content-start auto-rows-fr">
          {cells.map(c => (
            <button
              key={c.key}
              onClick={() => c.day && handleDayClick(c.day)}
              className="relative rounded flex items-center justify-center transition-colors hover:bg-white/10 w-full h-full aspect-square"
              style={{
                color: c.isSelected ? 'white' : c.isToday ? 'var(--bg-deepest)' : c.hasTask ? 'var(--accent-solid)' : 'var(--text-muted)',
                background: c.isSelected ? 'var(--error)' : c.isToday ? 'var(--accent-gradient)' : 'transparent',
                fontWeight: c.isToday || c.hasTask ? 600 : 400,
                fontSize: 'clamp(10px, 1.5vw, 14px)',
              }}
              title={c.hasTask && c.day ? 'Tasks due' : ''}
            >
              {c.day}
              {c.hasTask && !c.isToday && !c.isSelected && (
                <span className="absolute bottom-[2px] w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-solid)' }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
