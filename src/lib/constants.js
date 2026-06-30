// ─── Status / label colour maps & enums ───────────────────────────────────────
export const CLIENT_STATUS={Active:'#dcfce7 text-green-700',Prospect:'#dbeafe text-blue-700',Inactive:'#f3f4f6 text-gray-600',Churned:'#fee2e2 text-red-700'};
export const STAGE_COLORS={Lead:'bg-gray-100 text-gray-600',Proposal:'bg-blue-100 text-blue-700',Scheduled:'bg-purple-100 text-purple-700',Completed:'bg-green-100 text-green-700',Archive:'bg-amber-100 text-amber-700'};
export const LABEL_COLORS={
  Residential: {bg:'#dbeafe',color:'#1d4ed8'},
  Commercial:  {bg:'#ffedd5',color:'#ea580c'},
  Exterior:    {bg:'#d1fae5',color:'#065f46'},
  Lost:        {bg:'#fee2e2',color:'#dc2626'},
};
export const TYPE_COLORS={Call:'bg-blue-100 text-blue-700',Email:'bg-purple-100 text-purple-700',Meeting:'bg-green-100 text-green-700',Note:'bg-gray-100 text-gray-600',Task:'bg-orange-100 text-orange-700'};
export const LEAD_COLORS={
  Referral:  {bg:'#ede9fe',color:'#7c3aed'},
  Repeat:    {bg:'#dbeafe',color:'#1d4ed8'},
  Google:    {bg:'#fee2e2',color:'#dc2626'},
  Site:      {bg:'#fef9c3',color:'#a16207'},
  'Home Depot':{bg:'#ffedd5',color:'#ea580c'},
  MBT:       {bg:'#ccfbf1',color:'#0f766e'},
};
export const STAGES=['Lead','Proposal','Scheduled','Completed','Archive'];
export const LEAD_SOURCES=['Referral','Repeat','Google','Site','Home Depot','MBT'];
