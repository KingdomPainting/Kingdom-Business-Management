// ─── Theme / CSS variables ───────────────────────────────────────────────────
export const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  :root {
    --bg: #ede9de;
    --fg: #2e3557;
    --card: #ede9de;
    --border: #d6d1c3;
    --muted: #c8c2b2;
    --muted-fg: #757575;
    --primary: #d4a96a;
    --primary-fg: #0a0a0a;
    --destructive: #ef4444;
    --radius: 0.25rem;
    --shadow: 0 1px 4px rgba(0,0,0,.15);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Montserrat', sans-serif; background: var(--bg); color: var(--fg); font-size: 14px; }
  input, select, textarea { font-family: inherit; font-size: 13px; }
  button { cursor: pointer; font-family: inherit; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--muted); border-radius: 9px; }
  .est-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
  .dash-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .bk-grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
  .bk-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:768px) {
    .est-grid-2 { grid-template-columns:1fr; }
    .dash-row { grid-template-columns:1fr; }
    .bk-grid-3, .bk-grid-2 { grid-template-columns:1fr; }
    .bk-grid-3 .bk-stat-val { font-size:22px !important; }
    .bk-outer { padding:16px 12px !important; }
    .fin-grid { grid-template-columns:1fr !important; }
    .fin-grid .fin-stat-val { font-size:22px !important; }
    .fin-outer { padding:16px 12px !important; }
    .fin-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .fin-table-wrap table { min-width:600px !important; }
    .fin-pie-wrap { display:flex; justify-content:center; }
  }
`;
