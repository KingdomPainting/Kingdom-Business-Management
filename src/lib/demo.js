// ─── Demo account (fully in-memory, isolated from the real database) ──────────
import { newRoom } from './estimate';
import { genId, now } from './format';

let DEMO_DB = null;
export function resetDemoStore(){ DEMO_DB = buildDemoSeed(); }
export function ensureDemo(){ if(!DEMO_DB) DEMO_DB = buildDemoSeed(); return DEMO_DB; }

// ─── Sample documents (so the client portal demo has quotes/contracts to view) ──
const GOLD = '#C4922A';
const fmtMoney = n => '$'+(n||0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
function demoDocHead(title){
  return `<div style="font-family:Montserrat,Georgia,sans-serif;color:#1a1714">`
    +`<p style="font-size:12px;font-weight:700;color:${GOLD};letter-spacing:1.5px;margin-bottom:2px">KINGDOM PAINTING INC.</p>`
    +`<h1 style="font-size:26px;font-weight:700;margin:0 0 18px">${title}</h1>`;
}
function demoQuoteHtml(name,project,total){
  return demoDocHead('QUOTE')
    +`<p><strong>Client:</strong> ${name}</p><p><strong>Project:</strong> ${project}</p>`
    +`<hr style="border:none;border-top:1px solid #e0dbd0;margin:16px 0"/>`
    +`<p style="font-size:12px;color:#555;margin-bottom:10px">Interior painting — walls, ceilings, trim &amp; baseboards. Includes surface prep, patching, priming and two finish coats in premium low-VOC paint.</p>`
    +`<table style="width:100%;border-collapse:collapse;font-size:12px;margin:12px 0"><tr><td style="padding:6px 0;border-bottom:1px solid #eee">Labour &amp; Materials</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${fmtMoney(total/1.13)}</td></tr><tr><td style="padding:6px 0;border-bottom:1px solid #eee">Labour HST (13%)</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${fmtMoney(total-total/1.13)}</td></tr><tr><td style="padding:8px 0;font-weight:700">Total Estimate</td><td style="padding:8px 0;font-weight:700;text-align:right;color:${GOLD}">${fmtMoney(total)}</td></tr></table>`
    +`<p style="font-size:11px;color:#888;margin-top:16px">Sample quote for demonstration purposes.</p></div>`;
}
function demoContractHtml(name,project,total){
  const dep=total*0.35, mid=total*0.35, fin=total-dep-mid;
  return demoDocHead('CONTRACT')
    +`<p><strong>Client:</strong> ${name}</p><p><strong>Project:</strong> ${project}</p>`
    +`<hr style="border:none;border-top:1px solid #e0dbd0;margin:16px 0"/>`
    +`<p style="font-size:13px;font-weight:700;color:${GOLD};margin:20px 0 8px">Payment Terms</p>`
    +`<p style="font-size:12px;line-height:1.8">35% Deposit — ${fmtMoney(dep)}<br/>35% Halfway Payment — ${fmtMoney(mid)}<br/>30% Final Payment — ${fmtMoney(fin)}<br/><strong>Total: ${fmtMoney(total)}</strong></p>`
    +`<p style="font-size:11px;color:#666;margin-top:8px">Different payment terms can be discussed.</p>`
    +`<p style="font-size:13px;font-weight:700;color:${GOLD};margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid ${GOLD}">Signatures</p>`
    +`<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;font-size:11px">`
    +`<div><p style="font-weight:600;margin-bottom:6px">Client Signature</p><div id="client-sig-box" style="border:1px solid #ccc;border-radius:6px;background:#fafafa;min-height:110px;padding:6px;text-align:center"><!--CLIENT_SIGNATURE_SLOT--></div><p style="color:#888;margin-top:4px">${name}</p></div>`
    +`<div><p style="font-weight:600;margin-bottom:6px">Contractor Signature</p><div id="contractor-sig-box" style="border:1px solid #ccc;border-radius:6px;background:#fafafa;min-height:110px;padding:6px;text-align:center"><!--CONTRACTOR_SIGNATURE_SLOT--></div><p style="color:#888;margin-top:4px">David Truong, Kingdom Painting Inc.</p></div>`
    +`</div></div>`;
}
function demoInvoiceHtml(name,project,total){
  return demoDocHead('INVOICE')
    +`<p><strong>Bill To:</strong> ${name}</p><p><strong>Project:</strong> ${project}</p>`
    +`<hr style="border:none;border-top:1px solid #e0dbd0;margin:16px 0"/>`
    +`<table style="width:100%;border-collapse:collapse;font-size:12px"><tr><td style="padding:8px 0;font-weight:700">Amount Due</td><td style="padding:8px 0;font-weight:700;text-align:right;color:${GOLD}">${fmtMoney(total)}</td></tr></table>`
    +`<p style="font-size:11px;color:#16a34a;font-weight:600;margin-top:12px">Paid in full — thank you!</p></div>`;
}
function demoSchedule(total){
  const dep=Math.round(total*0.35*100)/100, mid=Math.round(total*0.35*100)/100;
  return [{label:'Deposit',amount:dep},{label:'Halfway Payment',amount:mid},{label:'Final Payment',amount:Math.round((total-dep-mid)*100)/100}];
}

export function buildDemoSeed(){
  const contacts=[
    {id:'dc1',fullName:'Sarah Mitchell',email:'sarah.mitchell@example.com',phone:'(416) 555-0142',jobTitle:'Homeowner',address:'88 Maple Crescent, Toronto, ON',notes:'Prefers low-VOC paints. Has two cats.',created_at:'2026-01-15T10:00:00Z'},
    {id:'dc2',fullName:'James Chen',email:'james.chen@example.com',phone:'(647) 555-0188',jobTitle:'Homeowner',address:'12 Birchwood Ave, Markham, ON',notes:'Repeat enquiries — price sensitive.',created_at:'2026-02-02T10:00:00Z'},
    {id:'dc3',fullName:'Priya Patel',email:'priya.patel@example.com',phone:'(905) 555-0119',jobTitle:'Homeowner',address:'45 Sunnybrook Rd, Richmond Hill, ON',notes:'Whole-home repaint. Flexible on schedule.',created_at:'2026-02-20T10:00:00Z'},
    {id:'dc4',fullName:'Robert Thompson',email:'r.thompson@example.com',phone:'(416) 555-0173',jobTitle:'Homeowner',address:'301 Lakeshore Blvd, Toronto, ON',notes:'Basement finishing project.',created_at:'2026-03-10T10:00:00Z'},
    {id:'dc5',fullName:'Emily Rodriguez',email:'emily.r@example.com',phone:'(289) 555-0150',jobTitle:'Homeowner',address:'77 Oakridge Dr, Vaughan, ON',notes:'Kitchen + living room. Wants it done before July.',created_at:'2026-04-05T10:00:00Z'},
    {id:'dc6',fullName:'Mark Davidson',email:'mark@davidsonpm.example.com',phone:'(416) 555-0126',jobTitle:'Property Manager',address:'500 King St W, Toronto, ON',notes:'Davidson Property Management — multiple unit turnovers.',created_at:'2026-04-28T10:00:00Z'},
  ];
  const deals=[
    {id:'dd1',dealName:'Mitchell Master Bedroom Repaint',contact:'dc1',value:3200,stage:'Lead',leadSource:'Google',labels:[],progress:0,rooms:[{name:'Master Bedroom',done:false},{name:'Walk-in Closet',done:false}],created_at:'2026-06-10T10:00:00Z'},
    {id:'dd2',dealName:'Chen Hallway & Stairwell',contact:'dc2',value:2450,stage:'Lead',leadSource:'Site',labels:[],progress:0,rooms:[{name:'Hallway',done:false},{name:'Stairwell',done:false}],created_at:'2026-06-15T10:00:00Z'},
    {id:'dd3',dealName:'Patel Whole Home Interior',contact:'dc3',value:14800,stage:'Proposal',leadSource:'Referral',labels:[],progress:0,quote_date:'2026-06-12',rooms:[{name:'Living Room',done:false},{name:'Kitchen',done:false},{name:'Master Bedroom',done:false},{name:'Bedroom 2',done:false},{name:'Bedroom 3',done:false},{name:'Bathrooms',done:false}],quote_html:demoQuoteHtml('Priya Patel','Whole Home Interior',14800),contract_html:demoContractHtml('Priya Patel','Whole Home Interior',14800),payment_schedule:demoSchedule(14800).map((b,i)=>i===0?{...b,paid:true}:b),invoicePaid:0,created_at:'2026-05-28T10:00:00Z'},
    {id:'dd4',dealName:'Thompson Basement Finishing',contact:'dc4',value:8900,stage:'Proposal',leadSource:'Home Depot',labels:[],progress:0,quote_date:'2026-06-08',rooms:[{name:'Rec Room',done:false},{name:'Office',done:false},{name:'Bathroom',done:false}],created_at:'2026-05-20T10:00:00Z'},
    {id:'dd5',dealName:'Rodriguez Kitchen & Living',contact:'dc5',value:6750,stage:'Scheduled',leadSource:'Referral',referralName:'dc1',labels:[],progress:40,startDate:'2026-06-25',startTime:'08:30',endDate:'2026-06-27',endTime:'17:00',rooms:[{name:'Kitchen',done:true},{name:'Living Room',done:false},{name:'Dining Room',done:false}],quote_html:demoQuoteHtml('Emily Rodriguez','Kitchen & Living Room',6750),contract_html:demoContractHtml('Emily Rodriguez','Kitchen & Living Room',6750),contract_signed_html:demoContractHtml('Emily Rodriguez','Kitchen & Living Room',6750).replace('<!--CLIENT_SIGNATURE_SLOT-->','<span style="display:block;font-size:10px;color:#555;margin-top:36px">Electronically signed by <strong>emily.r@example.com</strong> on June 20, 2026</span>'),contract_signed_at:'2026-06-20T14:30:00Z',payment_schedule:demoSchedule(6750),invoicePaid:2362.50,created_at:'2026-05-15T10:00:00Z'},
    {id:'dd6',dealName:'Davidson Unit 204 Turnover',contact:'dc6',value:4300,stage:'Scheduled',leadSource:'Referral',referralName:'dc1',labels:[],progress:0,startDate:'2026-07-02',startTime:'09:00',endDate:'2026-07-03',endTime:'17:00',rooms:[{name:'Bedroom',done:false},{name:'Living Area',done:false},{name:'Bathroom',done:false}],created_at:'2026-06-01T10:00:00Z'},
    {id:'dd7',dealName:'Mitchell Exterior Trim',contact:'dc1',value:5600,stage:'Completed',leadSource:'Referral',labels:[],progress:100,invoicePaid:5600,materials:920,wages:2100,rooms:[{name:'Front Trim',done:true},{name:'Garage Door',done:true},{name:'Rear Fascia',done:true}],quote_html:demoQuoteHtml('Sarah Mitchell','Exterior Trim',5600),invoice_html:demoInvoiceHtml('Sarah Mitchell','Exterior Trim',5600),created_at:'2026-05-12T10:00:00Z'},
    {id:'dd8',dealName:'Patel Office Accent Walls',contact:'dc3',value:3950,stage:'Completed',leadSource:'Repeat',labels:[],progress:100,invoicePaid:2000,materials:480,wages:1300,rooms:[{name:'Office',done:true},{name:'Reception',done:true}],created_at:'2026-06-03T10:00:00Z'},
    {id:'dd9',dealName:'Chen Garage Repaint',contact:'dc2',value:1800,stage:'Archive',leadSource:'Site',labels:['Lost'],progress:0,rooms:[{name:'Garage',done:false}],created_at:'2026-04-18T10:00:00Z'},
  ];
  const activities=[
    {id:'da1',type:'Task',title:'Follow up with Sarah on bedroom quote',details:'Send revised quote with low-VOC option.',dueDate:'2026-06-24',dueTime:'10:00',contactId:'dc1',dealId:'dd1',priority:'high',completed:false,subtasks:[{title:'Prepare quote PDF',completed:true},{title:'Email client',completed:false}],date:'2026-06-24T10:00:00Z'},
    {id:'da2',type:'Task',title:'Site visit — Patel residence',details:'Measure all rooms for whole-home quote.',dueDate:'2026-06-26',dueTime:'13:00',contactId:'dc3',dealId:'dd3',priority:'medium',completed:false,subtasks:[],date:'2026-06-26T13:00:00Z'},
    {id:'da3',type:'Call',title:'Call James re: stairwell colours',details:'Discuss Benjamin Moore options.',dueDate:'2026-06-23',dueTime:'15:30',contactId:'dc2',dealId:'dd2',priority:'medium',completed:false,subtasks:[],date:'2026-06-23T15:30:00Z'},
    {id:'da4',type:'Task',title:'Order paint for Rodriguez kitchen',details:'2 gallons Cloud White, 1 gallon Hale Navy.',dueDate:'2026-06-24',dueTime:'08:00',contactId:'dc5',dealId:'dd5',priority:'high',completed:false,subtasks:[{title:'Confirm quantities',completed:true},{title:'Place Home Depot order',completed:false}],date:'2026-06-24T08:00:00Z'},
    {id:'da5',type:'Task',title:'Send final invoice to Mitchell',details:'Exterior trim project complete.',dueDate:'2026-06-20',dueTime:'09:00',contactId:'dc1',dealId:'dd7',priority:'low',completed:true,subtasks:[],date:'2026-06-20T09:00:00Z'},
  ];
  // One saved estimate with a valid room structure
  const er1=newRoom('der1',1);er1.name='Living Room';er1.length=16;er1.width=14;er1.height=9;er1.ceiling={enabled:true,coats:2,type:'flat',removeStucco:false};er1.baseboards={enabled:true,coats:2};
  const er2=newRoom('der2',2);er2.name='Kitchen';er2.length=12;er2.width=10;er2.height=9;er2.baseboards={enabled:true,coats:2};
  const estimateState=JSON.stringify({rooms:[er1,er2],roomCounter:2,changeItems:[],changeCounter:0,client:{name:'Priya Patel',email:'priya.patel@example.com',phone:'(905) 555-0119',address:'45 Sunnybrook Rd, Richmond Hill, ON'},selectedDealId:'dd3'});
  const estimates=[
    {id:'de1',user_id:'demo-user',title:'Patel Whole Home Interior - Priya Patel',client_name:'Priya Patel',client_email:'priya.patel@example.com',client_phone:'(905) 555-0119',addr1:'45 Sunnybrook Rd, Richmond Hill, ON',updated_at:'2026-06-12T10:00:00Z',state:estimateState},
  ];
  const bookkeeping=[
    {id:'bk3',date:'2026-05-28',type:'expense',category:'Materials',description:'Benjamin Moore paint — Patel job',amount:480,vendor:'Home Depot'},
    {id:'bk4',date:'2026-05-25',type:'expense',category:'Materials',description:'Primer + caulking — Mitchell exterior',amount:320,vendor:'Dulux Store'},
    {id:'bk5',date:'2026-06-10',type:'expense',category:'Subcontractor',description:'Helper — Rodriguez kitchen prep',amount:650,vendor:'Mike Santos'},
    {id:'bk6',date:'2026-06-05',type:'expense',category:'Gas / Mileage',description:'Site visits — Markham & Richmond Hill',amount:85,vendor:'Petro Canada'},
    {id:'bk7',date:'2026-06-12',type:'expense',category:'Supplies',description:'Drop cloths, tape, rollers',amount:145,vendor:'Home Depot'},
    {id:'bk8',date:'2026-06-01',type:'expense',category:'Insurance',description:'Monthly liability insurance',amount:210,vendor:'Aviva'},
    {id:'bk9',date:'2026-05-15',type:'expense',category:'Gas / Mileage',description:'Fuel — week of May 12',amount:72,vendor:'Shell'},
    {id:'bk10',date:'2026-06-15',type:'expense',category:'Marketing',description:'Google Ads — June first half',amount:350,vendor:'Google'},
  ];
  return { contacts, deals, activities, estimates, bookkeeping, paint_settings:[], project_notifications:[], _invoiceSeq:1000 };
}

export async function demoFetch(path, method='GET', body=null){
  const db = ensureDemo();
  const qi = path.indexOf('?');
  const base = (qi>=0?path.slice(0,qi):path).replace('/rest/v1/','');
  const query = qi>=0 ? path.slice(qi+1) : '';
  // RPC endpoints
  if(base.startsWith('rpc/')){
    const fn = base.slice(4);
    if(fn==='get_client_deals') return db.deals.slice();
    if(fn==='check_portal_user') return false;
    if(fn==='next_invoice_number'){ db._invoiceSeq+=1; return db._invoiceSeq; }
    if(fn==='save_signed_contract'){
      const d = db.deals.find(x=>x.id===body?.deal_id);
      if(d){ d.contract_signed_html = body.signed_html; d.contract_signed_at = now(); }
      return null;
    }
    return null; // send_room_notification, etc → no-op
  }
  const coll = db[base];
  const idMatch = query.match(/id=eq\.([^&]+)/);
  const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
  if(method==='GET'){
    if(!Array.isArray(coll)) return [];
    return id ? coll.filter(x=>x.id===id) : coll.slice();
  }
  if(method==='POST'){
    if(base==='paint_settings') return null; // upsert no-op
    const rows = Array.isArray(body) ? body : [body];
    const out = rows.map(r=>({ id:genId(), created_at:now(), ...r }));
    if(Array.isArray(coll)) coll.unshift(...out);
    return out;
  }
  if(method==='PATCH'){
    if(Array.isArray(coll) && id){
      let updated=null;
      for(let i=0;i<coll.length;i++){ if(coll[i].id===id){ coll[i]={...coll[i],...body}; updated=coll[i]; } }
      return updated ? [updated] : [];
    }
    return [];
  }
  if(method==='DELETE'){
    if(Array.isArray(coll)){
      if(id) db[base]=coll.filter(x=>x.id!==id);
      else if(/user_id=eq\./.test(query)) db[base]=[]; // delete-all
    }
    return [];
  }
  return null;
}
