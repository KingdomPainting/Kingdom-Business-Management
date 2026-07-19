// ─── Receipt OCR / analysis via Claude vision ─────────────────────────────────
// Takes a captured receipt image (data URL) and extracts the vendor (title at
// the top of the receipt), the date, and the total amount.

// dataUrl looks like: data:image/jpeg;base64,/9j/4AAQ...
function splitDataUrl(dataUrl){
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl||'');
  if(!m) return null;
  return { media_type: m[1], data: m[2] };
}

// Returns { vendor, date, amount } or null on failure.
// - vendor: the business name / title at the top of the receipt
// - date:   ISO YYYY-MM-DD
// - amount: number (the receipt total)
export async function analyzeReceipt(dataUrl){
  const img = splitDataUrl(dataUrl);
  if(!img) return null;
  try{
    const resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:400,
        system:'You are a receipt-scanning assistant. Read the receipt image and return ONLY a JSON object. No markdown, no prose.',
        messages:[{
          role:'user',
          content:[
            { type:'image', source:{ type:'base64', media_type:img.media_type, data:img.data } },
            { type:'text', text:
              'Extract these fields from this receipt and return ONLY JSON with exactly these keys:\n'+
              '{"vendor": string, "date": "YYYY-MM-DD", "amount": number}\n'+
              '- vendor: the store/business name printed as the title at the top of the receipt.\n'+
              '- date: the transaction date on the receipt, formatted YYYY-MM-DD.\n'+
              '- amount: the final TOTAL amount (the number beside the word "Total"; if several totals exist use the grand total / amount paid). Numeric only, no currency symbol.\n'+
              'If a field cannot be read, use null for it.'
            }
          ]
        }]
      })
    });
    if(!resp.ok) return null;
    const data = await resp.json();
    if(data.error) return null;
    let text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
    // strip code fences if the model added them
    text = text.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if(i<0||j<0) return null;
    const parsed = JSON.parse(text.slice(i,j+1));
    let amount = parsed.amount;
    if(typeof amount === 'string') amount = parseFloat(amount.replace(/[^0-9.]/g,''));
    return {
      vendor: parsed.vendor ? String(parsed.vendor).trim() : '',
      date: parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : '',
      amount: (typeof amount === 'number' && !isNaN(amount)) ? amount : '',
    };
  }catch(e){ console.warn('Receipt analysis error:', e.message); return null; }
}
