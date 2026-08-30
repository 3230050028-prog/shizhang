import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { categoryColors } from '../data'

interface SpendingChartProps {
  data: Array<{ name: string; value: number }>
  expense: number
  formatMoney: (value: number) => string
}

export default function SpendingChart({ data, expense, formatMoney }: SpendingChartProps) {
  return (
    <div className="chart-layout">
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3} isAnimationActive={false}>
              {data.map((item) => <Cell key={item.name} fill={categoryColors[item.name] ?? '#8d9b92'} />)}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="chart-center"><small>总支出</small><b>{formatMoney(expense)}</b></div>
      </div>
      <div className="chart-legend">
        {data.slice(0, 5).map((item) => (
          <div key={item.name}><span><i style={{ background: categoryColors[item.name] ?? '#8d9b92' }} />{item.name}</span><b>{expense ? Math.round((item.value / expense) * 100) : 0}%</b></div>
        ))}
      </div>
    </div>
  )
}
