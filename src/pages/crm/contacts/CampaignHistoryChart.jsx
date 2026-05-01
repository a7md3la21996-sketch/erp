import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Horizontal bar chart for the contact's campaign interaction history.
 * Lives in its own file so the recharts vendor chunk only loads when the
 * Data tab is actually opened — the surrounding ContactDrawer used to import
 * recharts statically, pulling ~92kb (brotli) onto every contact open.
 */
export default function CampaignHistoryChart({ chartData, isRTL }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: '#6B8DB5' }} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
          formatter={(value, name, props) => [value, props.payload.fullName]}
        />
        <Bar dataKey={isRTL ? 'تفاعلات' : 'Interactions'} fill="#4A7AAB" radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
