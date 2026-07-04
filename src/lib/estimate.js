// ─── Estimate domain: defaults, room geometry & cost calculations ─────────────
export const SHEENS = ['Flat','Matte','Eggshell','Satin','Pearl','Semi-Gloss','TBD'];

export const DEFAULT_PAINTS = [
  {n:'Benjamin Moore - Ultra Spec',g:50,p:225},
  {n:'Benjamin Moore - Ben',g:70,p:0},
  {n:'Benjamin Moore - Aura',g:115,p:535},
  {n:'Benjamin Moore - Aura Bath & Spa',g:110,p:0},
  {n:'Benjamin Moore - Advance',g:75,p:0},
  {n:'Sherwin Williams - Promar 200',g:50,p:225},
  {n:'Sherwin Williams - Duration Home',g:70,p:350},
  {n:'Sherwin Williams - Emerald',g:80,p:400},
  {n:'Sherwin Williams - Promar 400',g:35,p:140},
  {n:'Sherwin Williams - Pro Industrial Epoxy',g:75,p:0},
];
export const DEFAULT_CEILING_PAINTS = [
  {n:'Benjamin Moore - Waterborne Ceiling',g:75,p:0},
  {n:'Benjamin Moore - Ultra Spec Ceiling',g:50,p:0},
  {n:'Sherwin Williams - ProMar Ceiling',g:45,p:0},
];
export const DEFAULT_PRIMERS = [
  {n:'Benjamin Moore - Drywall Primer',g:35,p:0},
  {n:'Benjamin Moore - Stix Primer',g:85,p:0},
  {n:'Kilz - Original Oil Primer',g:70,p:0},
  {n:'Kilz - PVA Primer',g:25,p:0},
  {n:'Kilz - 1 Primer',g:35,p:0},
  {n:'Kilz - 2 Primer',g:55,p:0},
];
export const DEFAULT_COLOURS = [
  {n:'OC-65 Chantilly Lace',h:'#f5f5f2'},{n:'OC-117 Simply White',h:'#f7f4e8'},{n:'OC-17 White Dove',h:'#f3efe3'},
  {n:'OC-20 Pale Oak',h:'#e8ddd1'},{n:'OC-15 Baby Fawn',h:'#ede3d4'},{n:'OC-52 Gray Owl',h:'#d5d6cb'},
  {n:'OC-45 Swiss Coffee',h:'#ede8dc'},{n:'OC-22 Calm',h:'#d9d5c8'},{n:'OC-150 Brilliant White',h:'#f2f2ef'},
  {n:'OC-57 White Heron',h:'#f0ece0'},{n:'AF-50 Etiquette',h:'#e8e0d3'},
  {n:'HC-172 Revere Pewter',h:'#cbc6b8'},{n:'HC-173 Edgecomb Gray',h:'#cfc9bb'},
  {n:'HC-170 Stonington Gray',h:'#b5bab6'},{n:'HC-169 Coventry Gray',h:'#9da0a0'},
  {n:'HC-166 Kendall Charcoal',h:'#74756c'},{n:'HC-165 Boothbay Gray',h:'#afb8b5'},
  {n:'HC-105 Rockport Gray',h:'#979490'},{n:'AF-100 Pashmina',h:'#d4c9ba'},
  {n:'1560 Antique Pewter',h:'#b4b5a6'},
  {n:'HC-154 Hale Navy',h:'#434c59'},{n:'HC-156 Van Deusen Blue',h:'#4a5f75'},
  {n:'HC-144 Palladian Blue',h:'#a8bebe'},{n:'2136-40 Aegean Teal',h:'#617f80'},
  {n:'2123-50 Ocean Air',h:'#92afc0'},{n:"2062-20 Gentleman's Gray",h:'#3d4a57'},
  {n:'1634 Santorini Blue',h:'#6e8fa5'},
  {n:'HC-114 Saybrook Sage',h:'#9ea98c'},{n:'HC-188 Essex Green',h:'#3d4e40'},
  {n:'HC-158 Newburg Green',h:'#4a6057'},{n:'2144-40 Soft Fern',h:'#b1be9a'},
  {n:'1495 October Mist',h:'#b9c1a9'},{n:'462 Vintage Vogue',h:'#8fa08a'},
  {n:'2041-10 Hunter Green',h:'#2e4335'},
  {n:'HC-81 Manchester Tan',h:'#c9b89a'},{n:'HC-76 Davenport Tan',h:'#c2a882'},
  {n:'HC-72 Branchport Brown',h:'#8e6e52'},{n:'HC-9 Chestertown Buff',h:'#d4bc8a'},
  {n:'1001 North Creek Brown',h:'#7a5c42'},{n:'2100-20 Leather Saddle Brown',h:'#7a5038'},
  {n:'2130-10 Black Bean Soup',h:'#3a2820'},{n:'AF-180 Wenge',h:'#4a3830'},
  {n:'AF-290 Caliente',h:'#c13030'},{n:'HC-181 Heritage Red',h:'#8c2020'},
  {n:'2000-10 Red',h:'#b82020'},{n:'2090-40 Wild Flower',h:'#b04860'},
  {n:'2092-30 Boston Brick',h:'#9a4030'},{n:'AF-300 Dinner Party',h:'#7a2020'},
  {n:'105 Terra Mauve',h:'#c27860'},
  {n:'2175-70 Peach Parfait',h:'#f0c8a8'},{n:'AF-185 Venetian Portico',h:'#c87848'},
  {n:'AF-215 Italianate',h:'#c86830'},{n:'070 Topaz',h:'#c88030'},
  {n:'2015-10 Electric Orange',h:'#e05010'},
  {n:'AF-250 Head Over Heels',h:'#e8b8b0'},{n:'1191 Love and Happiness',h:'#e0a0a0'},
  {n:'052 Conch Shell',h:'#e8c0b0'},{n:"1296 Sailor's Delight",h:'#d49090'},
  {n:'2174-60 Dream Whip',h:'#f0d0c8'},{n:'2102-70 First Light',h:'#f0d8d8'},
  {n:'1444 New Age',h:'#a090b0'},{n:'2117-60 Winter Gray',h:'#c0b8c8'},
  {n:'2070-60 Lavender Mist',h:'#c8b8d8'},{n:'2071-60 Lily Lavender',h:'#c8b0d8'},
  {n:'2116-40 Hazy Lilac',h:'#9888a8'},{n:'2117-30 Shadow',h:'#807090'},
  {n:'CSP-305 Crisp Linen',h:'#ece0c0'},{n:'HC-6 Windham Cream',h:'#ead8a0'},
  {n:'2152-50 Golden Straw',h:'#e0c878'},{n:'HC-12 Concord Ivory',h:'#deca90'},
  {n:'HC-11 Marblehead Gold',h:'#d4b860'},
  {n:'HC-190 Black',h:'#1c1c1c'},{n:'2131-10 Black Satin',h:'#2a2820'},
  {n:'2131-20 Midnight',h:'#302e28'},{n:'2120-30 Witching Hour',h:'#2c2a30'},
  {n:'1610 French Beret',h:'#302828'},{n:'2124-10 Wrought Iron',h:'#282c2c'},
];
export const DEFAULT_SW_COLOURS = [
  {n:'SW 7029 Agreeable Gray',h:'#D1CBC1'},{n:'SW 7015 Repose Gray',h:'#CCC9C0'},
  {n:'SW 7036 Accessible Beige',h:'#D3C7B0'},{n:'SW 6258 Tricorn Black',h:'#2F2F30'},
  {n:'SW 7005 Pure White',h:'#EDECE6'},{n:'SW 7006 Extra White',h:'#EEEFEA'},
  {n:'SW 7008 Alabaster',h:'#EDEADF'},{n:'SW 7004 Snowbound',h:'#EDE8E0'},
  {n:'SW 7016 Mindful Gray',h:'#BAB6AB'},{n:'SW 7012 Creamy',h:'#EFE1C6'},
  {n:'SW 7014 Eider White',h:'#E3DED7'},{n:'SW 6106 Kilim Beige',h:'#C7B296'},
  {n:'SW 6119 Antique White',h:'#F0E4CB'},{n:'SW 7043 Worldly Gray',h:'#C5BFB2'},
  {n:'SW 6385 Dover White',h:'#F0E6CE'},{n:'SW 7044 Amazing Gray',h:'#ACA99B'},
  {n:'SW 6244 Naval',h:'#2E3441'},{n:'SW 7069 Iron Ore',h:'#434343'},
  {n:'SW 7042 Shoji White',h:'#E9E0CE'},{n:'SW 7030 Anew Gray',h:'#BFB6AA'},
  {n:'SW 0055 Light French Gray',h:'#C0BFB9'},{n:'SW 7064 Passive',h:'#CCC9C2'},
  {n:'SW 6204 Sea Salt',h:'#C5D5CB'},{n:'SW 7641 Colonnade Gray',h:'#BBB5A5'},
  {n:'SW 7011 Natural Choice',h:'#E8E0D1'},{n:'SW 7035 Aesthetic White',h:'#E8DFD0'},
  {n:'SW 7631 City Loft',h:'#D2CBC0'},{n:'SW 6140 Moderate White',h:'#EADECC'},
  {n:'SW 7632 Modern Gray',h:'#C3BAAB'},{n:'SW 9166 Drift of Mist',h:'#E7E2D4'},
  {n:'SW 7010 White Duck',h:'#E5DCC8'},{n:'SW 7013 Ivory Lace',h:'#F0E8D5'},
  {n:'SW 6073 Perfect Greige',h:'#B9AE9B'},{n:'SW 7526 Maison Blanche',h:'#E8DCCA'},
  {n:'SW 6105 Divine White',h:'#E9DDCA'},{n:'SW 7638 Jogging Path',h:'#D0C9BA'},
  {n:'SW 7019 Gauntlet Gray',h:'#838078'},{n:'SW 7672 Knitting Needles',h:'#B4AFA5'},
  {n:'SW 7045 Intellectual Gray',h:'#9E998E'},{n:'SW 7648 Big Chill',h:'#CED1CE'},
  {n:'SW 7023 Requisite Gray',h:'#B5AFA3'},{n:'SW 7046 Anonymous',h:'#A49F93'},
  {n:'SW 7657 Tinsmith',h:'#BBBCBB'},{n:'SW 7009 Pearly White',h:'#EEEAD9'},
  {n:'SW 7543 Avenue Tan',h:'#C3B39D'},{n:'SW 7070 Site White',h:'#E1DCD4'},
  {n:'SW 7018 Dovetail',h:'#7D7870'},{n:'SW 6476 Glimmer',h:'#D5E1DB'},
  {n:'SW 7028 Incredible White',h:'#ECE6D9'},{n:'SW 7637 Oyster White',h:'#D9D1C2'},
];
export const DEFAULT_SUPPLIES = [
  {n:'9" Roller',p:6},{n:'18" Roller',p:22},{n:'Mini Roller',p:3},
  {n:'FrogTape 4 Pack',p:38.8},{n:'Floor Shield 36x50',p:32.3},
  {n:'CGC Sheetrock 45 11kg',p:46},{n:'Norton Sanding Sponge',p:5.6},
];
export const DEFAULT_OVERHEAD_ITEMS = [
  {n:'Salary',v:50000},{n:'Gas',v:4000},{n:'Sprayer',v:1800},{n:'Ads',v:1000},
  {n:'Company Meals',v:750},{n:'Company Insurance',v:650},{n:'Accountant',v:500},
  {n:'Mechanical',v:500},{n:'Tools',v:500},{n:'Google Workplace',v:120},{n:'Website',v:50},
];
export const DEFAULT_WORKERS = [{n:'David',r:40,active:true},{n:'René',r:30,active:true},{n:'Nicky',r:18,active:false}];
export const DEFAULT_STANDARDS = {
  walls:{1:200,2:120,3:75},
  flatCeiling:{1:150,2:90,3:55},
  stuccoCeiling:{1:80,2:50,3:35},
  removeStucco:{rate:0.75},
  baseboards:{1:100,2:60,3:40},
  crown:{1:90,2:55,3:35},
  doorFrames:{1:170,2:102,3:65},
  windows:{1:100,2:60,3:40},
  doors:{1:84,2:42,3:21},
  doorsFlat:{1:84,2:42,3:21},
  doors6Panel:{1:70,2:35,3:18},
  doorsCustom:{1:60,2:30,3:15},
};
export const DEFAULT_SETTINGS = { hourlyRate:65, labourBuffer:1.25, taxRate:13, discount:0 };

// ─── ESTIMATE HELPER FUNCTIONS ───────────────────────────────────────────────
export function newRoom(id, number){
  return {
    id, name:`Room ${number}`, length:0, width:0, height:'', irregular:false, irregularSqft:0, prepHrs:0,
    wallSegs:[{l:0},{l:0},{l:0},{l:0},{l:0},{l:0}],
    ceilSegs:[{l:0,w:0},{l:0,w:0}],
    walls:{enabled:true,coats:2}, ceiling:{enabled:false,coats:2,type:'flat',removeStucco:false},
    baseboards:{enabled:false,coats:2}, crown:{enabled:false,coats:2},
    doorFrames:{enabled:false,coats:2},
    doors:{enabled:false,flat:{count:0,coats:2},sixPanel:{count:0,coats:2},custom:{count:0,coats:2}},
    windows:{enabled:false,coats:2,dims:[{l:0,w:0}]},
    prep:{furniture:false,plastic:false,outlets:false,drywall:false,caulking:false,cleanup:false,custom:''},
    paint:{wallProduct:'',wallColour:'',wallSheen:'',ceilProduct:'',ceilColour:'',ceilSheen:'',trimProduct:'',trimColour:'',trimSheen:'',wallsPrimer:'',ceilingPrimer:'',trimPrimer:''},
    notes:'', supplies:[],
  };
}

export function roomWallSqft(room){
  if(room.irregular){
    const h = room.height||0;
    return Math.max(0,(room.wallSegs||[]).reduce((s,seg)=>s+((+seg.l)||0)*h,0)) || (room.irregularSqft||0);
  }
  return Math.max(0, 2*(room.length+room.width)*(room.height||0));
}
export function roomCeilSqft(room){
  if(room.irregular && room.ceilSegs?.length){
    const s = room.ceilSegs.reduce((t,seg)=>t+((+seg.l)||0)*((+seg.w)||0),0);
    if(s>0) return s;
  }
  return (room.length||0)*(room.width||0);
}
export function roomPerimLF(room){ return 2*((room.length||0)+(room.width||0)); }
export function roomWindowLF(room){
  if(!room.windows?.enabled) return 0;
  const dims = room.windows?.dims || [{l:0,w:0}];
  return dims.reduce((t,d)=>t+2*(((+d.l)||0)+((+d.w)||0)),0);
}
export function roomDoorCount(room){
  if(!room.doors?.enabled) return 0;
  if(typeof room.doors.count==='number') return room.doors.count;
  return (room.doors.flat?.count||0)+(room.doors.sixPanel?.count||0)+(room.doors.custom?.count||0);
}
export function roomTrimLF(room){
  const p = roomPerimLF(room);
  let lf = 0;
  if(room.baseboards?.enabled) lf += p;
  if(room.crown?.enabled) lf += p;
  if(room.doorFrames?.enabled) lf += p;
  if(room.windows?.enabled) lf += roomWindowLF(room);
  return lf;
}

export function calcRoom(room, settings){
  const std = settings._standards || DEFAULT_STANDARDS;
  const wallSqft = roomWallSqft(room);
  const ceilSqft = roomCeilSqft(room);
  const perimLF = roomPerimLF(room);
  const winLF = roomWindowLF(room);
  let hrs = 0;
  if(room.walls?.enabled && wallSqft) hrs += wallSqft / (std.walls?.[room.walls.coats] || 120);
  if(room.ceiling?.enabled && ceilSqft){
    const cstd = room.ceiling.type==='stucco' ? (std.stuccoCeiling||std.flatCeiling) : std.flatCeiling;
    hrs += ceilSqft / (cstd?.[room.ceiling.coats] || 90);
  }
  let stuccoCost = 0;
  let stuccoHrs = 0;
  if(room.ceiling?.enabled && ceilSqft && room.ceiling.removeStucco){
    stuccoHrs = ceilSqft / 28;
    stuccoCost = ceilSqft * (std.removeStucco?.rate || 0.75);
  }
  if(room.baseboards?.enabled && perimLF) hrs += perimLF / (std.baseboards?.[room.baseboards.coats] || 60);
  if(room.crown?.enabled && perimLF) hrs += perimLF / (std.crown?.[room.crown.coats] || 55);
  if(room.doorFrames?.enabled && perimLF) hrs += perimLF / (std.doorFrames?.[room.doorFrames.coats] || 102);
  if(room.doors?.enabled){
    const fl=room.doors.flat||{};const sp=room.doors.sixPanel||{};const cu=room.doors.custom||{};
    if(fl.count>0) hrs+=(fl.count*21)/(std.doorsFlat?.[fl.coats]||std.doors?.[fl.coats]||42);
    if(sp.count>0) hrs+=(sp.count*21)/(std.doors6Panel?.[sp.coats]||std.doors?.[sp.coats]||42);
    if(cu.count>0) hrs+=(cu.count*21)/(std.doorsCustom?.[cu.coats]||std.doors?.[cu.coats]||42);
  } else if(room.doors?.count > 0) hrs += (room.doors.count * 21) / (std.doors?.[room.doors.coats] || 42);
  if(room.windows?.enabled && winLF) hrs += winLF / (std.windows?.[room.windows.coats] || 60);
  hrs += (room.prepHrs || 0);
  const cost = hrs * (settings.hourlyRate || 65) * (settings.labourBuffer || 1.25) + stuccoCost;
  return { wallSqft, ceilSqft, perimLF, winLF, totalHrs: hrs + stuccoHrs, cost };
}

export function calcTotals(rooms, settings, materialCost=0){
  const labourSubtotal = rooms.reduce((s,r) => s + calcRoom(r,settings).cost, 0);
  const discounted = Math.max(0, labourSubtotal - (settings.discount||0));
  const taxAmt = discounted * ((settings.taxRate||13)/100);
  const total = discounted + taxAmt + materialCost;
  const deposit = total * 0.50;
  const balance = total - deposit; // 50% upon completion
  const midway = 0; // retained for backward compatibility with older saved estimates
  return { labourSubtotal, discounted, taxAmt, total, deposit, midway, balance, materialCost };
}

export function calcRoomLines(room, settings){
  const std = settings._standards || DEFAULT_STANDARDS;
  const lines = [];
  const rate = (settings.hourlyRate||65) * (settings.labourBuffer||1.25);
  const wallSqft = roomWallSqft(room);
  const ceilSqft = roomCeilSqft(room);
  const perimLF = roomPerimLF(room);
  const winLF = roomWindowLF(room);
  if(room.walls?.enabled && wallSqft){
    const r = std.walls?.[room.walls.coats]||120;
    const h = wallSqft/r;
    lines.push({surface:'Walls',area:Math.round(wallSqft),areaUnit:'sqft',coats:room.walls.coats,rate:r,rateLabel:'sqft/hr',hours:h,cost:h*rate});
  }
  if(room.ceiling?.enabled && ceilSqft){
    const cstd = room.ceiling.type==='stucco' ? (std.stuccoCeiling||std.flatCeiling) : std.flatCeiling;
    const r = cstd?.[room.ceiling.coats]||90;
    const h = ceilSqft/r;
    lines.push({surface:'Ceiling',area:Math.round(ceilSqft),areaUnit:'sqft',coats:room.ceiling.coats,rate:r,rateLabel:'sqft/hr',hours:h,cost:h*rate});
    if(room.ceiling.removeStucco){
      const rr = 28;
      const hh = ceilSqft / rr;
      const directCost = ceilSqft * (std.removeStucco?.rate || 0.75);
      lines.push({surface:'Remove Stucco',area:Math.round(ceilSqft),areaUnit:'sqft',coats:0,rate:rr,rateLabel:'sqft/hr',hours:hh,cost:directCost});
    }
  }
  if(room.baseboards?.enabled && perimLF){
    const r = std.baseboards?.[room.baseboards.coats]||60;
    const h = perimLF/r;
    lines.push({surface:'Baseboards',area:Math.round(perimLF),areaUnit:'lf',coats:room.baseboards.coats,rate:r,rateLabel:'lf/hr',hours:h,cost:h*rate});
  }
  if(room.crown?.enabled && perimLF){
    const r = std.crown?.[room.crown.coats]||55;
    const h = perimLF/r;
    lines.push({surface:'Crown',area:Math.round(perimLF),areaUnit:'lf',coats:room.crown.coats,rate:r,rateLabel:'lf/hr',hours:h,cost:h*rate});
  }
  if(room.doorFrames?.enabled && perimLF){
    const r = std.doorFrames?.[room.doorFrames.coats]||102;
    const h = perimLF/r;
    lines.push({surface:'Door Frames',area:Math.round(perimLF),areaUnit:'lf',coats:room.doorFrames.coats,rate:r,rateLabel:'lf/hr',hours:h,cost:h*rate});
  }
  if(room.doors?.enabled){
    const types=[['Flat',room.doors.flat,'doorsFlat'],['6 Panel',room.doors.sixPanel,'doors6Panel'],['Custom',room.doors.custom,'doorsCustom']];
    types.forEach(([label,dt,stdKey])=>{
      if(dt?.count>0){
        const r=std[stdKey]?.[dt.coats]||std.doors?.[dt.coats]||42;
        const sqft=dt.count*21;const h=sqft/r;
        lines.push({surface:`Doors - ${label} (${dt.count})`,area:sqft,areaUnit:'sqft',coats:dt.coats,rate:r,rateLabel:'sqft/hr',hours:h,cost:h*rate});
      }
    });
  } else if(room.doors?.count > 0){
    const r = std.doors?.[room.doors.coats]||42;
    const sqft = room.doors.count*21;const h = sqft/r;
    lines.push({surface:`Doors (${room.doors.count})`,area:sqft,areaUnit:'sqft',coats:room.doors.coats,rate:r,rateLabel:'sqft/hr',hours:h,cost:h*rate});
  }
  if(room.windows?.enabled && winLF){
    const r = std.windows?.[room.windows.coats]||60;
    const h = winLF/r;
    lines.push({surface:`Windows (${room.windows.dims?.length||0})`,area:Math.round(winLF),areaUnit:'lf',coats:room.windows.coats,rate:r,rateLabel:'lf/hr',hours:h,cost:h*rate});
  }
  if(room.prepHrs > 0){
    const h = room.prepHrs;
    lines.push({surface:'Prep Work',area:h,areaUnit:'hrs',coats:0,rate:1,rateLabel:'hr',hours:h,cost:h*rate});
  }
  return lines;
}

export function calcPaintCosts(rooms, allPaints, allCeilPaints, allPrimers, allColours, matBuffer){
  const colMap = {};
  const addCol = (product,colour,sheen,surface,area)=>{
    if(!product||!area) return;
    const key = `${product}·${colour||''}·${sheen||''}·${surface}`;
    if(!colMap[key]) colMap[key] = {product,colour:colour||'',sheen:sheen||'',surface,area:0};
    colMap[key].area += area;
  };
  rooms.forEach(r=>{
    const ws = roomWallSqft(r), cs = roomCeilSqft(r);
    const trimLF = roomTrimLF(r);
    // Paintable surface = area × number of coats (each coat covers the surface once)
    const perim = roomPerimLF(r);
    const trimCoated =
      (r.baseboards?.enabled ? perim*(r.baseboards.coats||2) : 0) +
      (r.crown?.enabled ? perim*(r.crown.coats||2) : 0) +
      (r.doorFrames?.enabled ? perim*(r.doorFrames.coats||2) : 0) +
      (r.windows?.enabled ? roomWindowLF(r)*(r.windows.coats||2) : 0);
    if(r.walls?.enabled && ws){
      if(r.walls.coats===3 && r.paint?.wallsPrimer){ addCol(r.paint.wallsPrimer,'','','Walls (Primer)',ws); addCol(r.paint.wallProduct,r.paint.wallColour,r.paint.wallSheen,'Walls (2 Coats)',ws*2); }
      else addCol(r.paint?.wallProduct,r.paint?.wallColour,r.paint?.wallSheen,'Walls',ws*(r.walls.coats||1));
    }
    if(r.ceiling?.enabled && cs){
      if(r.ceiling.coats===3 && r.paint?.ceilingPrimer){ addCol(r.paint.ceilingPrimer,'','','Ceiling (Primer)',cs); addCol(r.paint.ceilProduct,r.paint.ceilColour,r.paint.ceilSheen,'Ceiling (2 Coats)',cs*2); }
      else addCol(r.paint?.ceilProduct,r.paint?.ceilColour,r.paint?.ceilSheen,'Ceiling',cs*(r.ceiling.coats||1));
    }
    const hasTrim = r.baseboards?.enabled || r.crown?.enabled || r.doorFrames?.enabled || r.windows?.enabled || r.doors?.enabled || (r.windows?.count>0) || (r.doors?.count>0);
    if(hasTrim && trimLF){
      const needsPrimer = (r.baseboards?.coats===3||r.crown?.coats===3||r.doorFrames?.coats===3||r.doors?.coats===3||r.windows?.coats===3||r.doors?.flat?.coats===3||r.doors?.sixPanel?.coats===3||r.doors?.custom?.coats===3) && r.paint?.trimPrimer;
      if(needsPrimer){ addCol(r.paint.trimPrimer,'','','Trim (Primer)',trimLF); addCol(r.paint.trimProduct,r.paint.trimColour,r.paint.trimSheen,'Trim (2 Coats)',trimLF*2); }
      else addCol(r.paint?.trimProduct,r.paint?.trimColour,r.paint?.trimSheen,'Trim',trimCoated);
    }
  });
  const allProducts = [...(allPaints||[]),...(allCeilPaints||[]),...(allPrimers||[])];
  let total = 0;
  const lines = Object.values(colMap).map(cm=>{
    const sqft = cm.area;
    const pObj = allProducts.find(p=>p.n===cm.product);
    let qtyStr = '—', gallons = 0;
    if(sqft > 0){
      gallons = Math.ceil(sqft/350);
      if(sqft <= 1900){ qtyStr = gallons + ' gal'; }
      else { const pails=Math.floor(sqft/1900); const rem=sqft-pails*1900; const eg=rem>0?Math.ceil(rem/350):0; const p2=[]; if(pails>0)p2.push(pails+' pail'+(pails>1?'s':'')); if(eg>0)p2.push(eg+' gal'); qtyStr=p2.join(' + '); }
    }
    const unitPrice = pObj ? (sqft>1900 && pObj.p>0 ? pObj.p : pObj.g||pObj.p||0) : 0;
    const lineCost = unitPrice>0 ? unitPrice*gallons*matBuffer : 0;
    total += lineCost;
    const hex = cm.colour ? ((allColours||[]).find(c=>c.n===cm.colour)?.h||'#ccc') : '';
    return { ...cm, sqft, qtyStr, lineCost, hex };
  });
  return { lines, total };
}

export function calcRoomSupplyCost(room, allSupplies){
  return (room.supplies||[]).reduce((t,s)=>{
    if(!s.name) return t;
    const sup = (allSupplies||[]).find(x=>x.n===s.name);
    return t + (sup ? sup.p * ((+s.qty)||1) : 0);
  },0);
}

// Derived paint name arrays — computed from paint settings state
export const WALL_PAINTS = DEFAULT_PAINTS.map(p=>p.n);
export const TRIM_PAINTS = DEFAULT_PAINTS.map(p=>p.n);
export const CEILING_PAINTS = DEFAULT_CEILING_PAINTS.map(p=>p.n);
export const COLOURS = DEFAULT_COLOURS.map(c=>c.n);
export const CEILING_COLOURS = DEFAULT_COLOURS.map(c=>c.n);
