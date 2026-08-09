// ─── Formatting & misc utilities ─────────────────────────────────────────────
export const cn = (...cls) => cls.filter(Boolean).join(" ");
export const fmtCAD = n => (n ?? 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
export const fmtUSD = n => `$${(n ?? 0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function genId(){ return Math.random().toString(36).slice(2,10); }
export function now(){ return new Date().toISOString(); }

// Generate all dates between two date strings inclusive
export function dateRange(startDate, endDate){
  if(!startDate) return [];
  const dates=[];
  const cur=new Date(startDate+'T12:00:00');
  const end=new Date((endDate||startDate)+'T12:00:00');
  while(cur<=end){
    dates.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate()+1);
  }
  return dates;
}

export function fmtDateLabel(dateStr){
  return new Date(dateStr+'T12:00:00').toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
}
