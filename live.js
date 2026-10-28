/* Lớp dữ liệu trực tuyến. Nguyên tắc: không có số liệu mẫu, không suy diễn.
   Trường nào nguồn không trả về thì để null và giao diện hiện "Chưa có dữ liệu". */
const Live = (() => {
  const HV = ['https://api-finfo.vndirect.com.vn', 'https://finfo-api.vndirect.com.vn'];
  const DC = 'https://dchart-api.vndirect.com.vn', TC = 'https://apipubaws.tcbs.com.vn';
  const diag = [];                                   // nhật ký kết nối, hiển thị ở cuối trang
  const log = (n, ok, note = '') => diag.push({ n, ok, note });
  const norm = v => v > 1000 ? v / 1000 : v;         // về đơn vị nghìn đồng
  const iso = t => new Date(t * 1000).toISOString().slice(0, 10);

  async function j(u, ms = 9000) {
    const up = store.get('proxy'), T = [];
    if (up) T.push(up + (up.endsWith('=') ? encodeURIComponent(u) : u));
    T.push(u);
    if (/^https?:/.test(location.protocol)) T.push('/proxy?url=' + encodeURIComponent(u));
    let err;
    for (const t of T) {
      const c = new AbortController(), id = setTimeout(() => c.abort(), ms);
      try { const r = await fetch(t, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
      catch (e) { err = e; } finally { clearTimeout(id); }
    }
    throw err;
  }

  async function quote(code, quiet) {
    const now = Math.floor(Date.now() / 1000), from = now - 20 * 86400;
    try {
      const r = await j(`${DC}/dchart/history?resolution=D&symbol=${code}&from=${from}&to=${now}`);
      const n = r.c.length;
      if (r.s === 'ok' && n > 1) { const p = norm(r.c[n - 1]), pv = norm(r.c[n - 2]); quiet || log('Giá · VNDirect dchart', true); return { p, ch: p - pv, pc: (p / pv - 1) * 100, date: iso(r.t[n - 1]), src: 'VNDirect' }; }
    } catch (e) { quiet || log('Giá · VNDirect dchart', false, e.message); }
    for (const H of HV) {
      try {
        const [a, b] = (await j(`${H}/v4/stock_prices?sort=date&size=2&q=code:${code}`)).data;
        quiet || log('Giá · ' + H.slice(8), true);
        return { p: norm(a.close), ch: norm(a.close) - norm(b.close), pc: (a.close / b.close - 1) * 100, date: a.date, src: 'VNDirect' };
      } catch (e) { quiet || log('Giá · ' + H.slice(8), false, e.message); }
    }
    const r = await j(`${TC}/stock-insight/v1/stock/bars-long-term?ticker=${code}&type=stock&resolution=D&from=${from}&to=${now}`);
    const d = r.data, a = d[d.length - 1], b = d[d.length - 2];
    quiet || log('Giá · TCBS bars', true);
    return { p: norm(a.close), ch: norm(a.close) - norm(b.close), pc: (a.close / b.close - 1) * 100, date: String(a.tradingDate).slice(0, 10), src: 'TCBS' };
  }

  /* Lịch sử giá đóng cửa theo ngày từ 2010 */
  async function history(code) {
    const now = Math.floor(Date.now() / 1000), from = 1262304000;
    try {
      const r = await j(`${DC}/dchart/history?resolution=D&symbol=${code}&from=${from}&to=${now}`, 20000);
      if (r.s !== 'ok') throw new Error('s=' + r.s);
      log('Lịch sử giá · VNDirect dchart', true, r.t.length + ' phiên');
      return { dates: r.t.map(iso), close: r.c.map(norm) };
    } catch (e) {
      log('Lịch sử giá · VNDirect dchart', false, e.message);
      const r = await j(`${TC}/stock-insight/v1/stock/bars-long-term?ticker=${code}&type=stock&resolution=D&from=${from}&to=${now}`, 20000);
      log('Lịch sử giá · TCBS bars', true, r.data.length + ' phiên');
      return { dates: r.data.map(x => String(x.tradingDate).slice(0, 10)), close: r.data.map(x => norm(x.close)) };
    }
  }

  const pick = (o, ks) => { if (!o) return null; for (const k of ks) { const v = o[k]; if (v != null && v !== '' && !isNaN(v)) return +v; } return null; };
  const FIELDS = {   // tên trường ứng viên của TCBS cho chỉ số ngân hàng (nguồn không công bố tài liệu, nên dò nhiều tên)
    roe: ['roe'], roa: ['roa'], gm: ['grossProfitMargin'], nm: ['postTaxMargin', 'netProfitMargin'], turn: ['inventoryTurnover'],
    nim: ['nim', 'netInterestMargin'], casa: ['casa', 'casaRatio'], cof: ['cof', 'costOfFund'], cir: ['cir', 'costToIncome'],
    npl: ['badDebtRatio', 'nplRatio', 'npl', 'badLoanRatio'], prov: ['provisionOnBadDebt', 'llcr', 'provisionCoverage'],
    ldr: ['loanOnDepositRatio', 'ldr'], lg: ['creditGrowth', 'loanGrowth']
  };
  const PCT = ['roe', 'roa', 'gm', 'nm', 'nim', 'casa', 'cof', 'cir', 'npl', 'prov', 'ldr', 'lg'];
  const fixPct = a => Math.max(...a.map(v => Math.abs(v || 0))) <= 2 ? a.map(v => v == null ? null : +(v * 100).toFixed(2)) : a;

  const sortKey = o => (+o.year) * 10 + (+o.quarter || 0);
  function build(per, S) {
    const ok = o => per === 'year' || (+o.quarter >= 1 && +o.quarter <= 4);
    const key = o => per === 'year' ? String(o.year) : `${o.year}Q${o.quarter}`;
    const rows = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.filter(ok)]));
    const all = [...rows.is, ...rows.bs].filter(o => per === 'quarter' || +o.year >= 2010);
    const uniq = [...new Map(all.sort((a, b) => sortKey(a) - sortKey(b)).map(o => [key(o), o])).values()];
    const keep = per === 'year' ? uniq : uniq.slice(-34);
    const labels = keep.map(o => per === 'year' ? String(o.year) : `Q${o.quarter}.${String(o.year).slice(2)}`);
    const idx = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, new Map(v.map(o => [key(o), o]))]));
    const ks = keep.map(key);
    const ser = (src, names, f = 1) => ks.map(k => { const v = pick(idx[src].get(k), names); return v == null ? null : v * f; });
    const big = Math.max(...ser('bs', ['asset', 'totalAsset', 'totalAssets']).map(v => v || 0)) > 1e7, f = big ? 1e-9 : 1;
    const L = { labels, per };
    L.ta = ser('bs', ['asset', 'totalAsset', 'totalAssets'], f);
    L.cash = ser('bs', ['cash'], f); L.recv = ser('bs', ['shortReceivable'], f); L.inv = ser('bs', ['inventory'], f); L.fixed = ser('bs', ['fixedAsset'], f);
    L.eq = ser('bs', ['equity'], f); L.st = ser('bs', ['shortDebt'], f); L.lt = ser('bs', ['longDebt'], f);
    L.rev = ser('is', ['revenue', 'netRevenue'], f); L.np = ser('is', ['shareHolderIncome', 'postTaxProfit', 'profitAfterTax'], f);
    L.cfo = ser('cf', ['fromSale', 'operatingCashFlow'], f); L.cfi = ser('cf', ['fromInvest', 'investingCashFlow'], f); L.cff = ser('cf', ['fromFinancial', 'financingCashFlow'], f);
    for (const k in FIELDS) { let a = ser('ra', FIELDS[k]); L[k] = PCT.includes(k) ? fixPct(a) : a; }
    return L;
  }

  async function fundAll(code) {
    const fin = (k, y) => j(`${TC}/tcanalysis/v1/finance/${code}/${k}?yearly=${y}&isAll=true`, 15000);
    const names = ['incomestatement', 'balancesheet', 'cashflow', 'financialratio'], jobs = [];
    [1, 0].forEach(y => names.forEach(n => jobs.push([n, y, fin(n, y)])));
    const R = await Promise.allSettled([...jobs.map(x => x[2]), j(`${TC}/tcanalysis/v1/ticker/${code}/overview`)]);
    const rows = i => { const v = R[i].value; return R[i].status !== 'fulfilled' ? [] : Array.isArray(v) ? v : (v && v.data) || []; };
    jobs.forEach(([n, y], i) => { const r = rows(i); log(`TCBS ${n} (${y ? 'năm' : 'quý'})`, r.length > 0, r.length ? r.length + ' kỳ · trường: ' + Object.keys(r[0]).slice(0, 14).join(', ') : (R[i].reason && R[i].reason.message) || 'rỗng'); });
    const set = o => ({ is: rows(o), bs: rows(o + 1), cf: rows(o + 2), ra: rows(o + 3) });
    const Y = set(0), Q = set(4);
    if (!Y.is.length && !Y.bs.length && !Q.is.length) throw new Error('TCBS không trả dữ liệu');
    const ov = R[8].status === 'fulfilled' ? R[8].value : null;
    log('TCBS overview', !!ov, ov ? 'trường: ' + Object.keys(ov).slice(0, 14).join(', ') : '');
    const out = { year: build('year', Y), quarter: build('quarter', Q), ov };
    // TTM = tổng 4 quý gần nhất
    const q4 = r => [...r].filter(o => +o.quarter >= 1 && +o.quarter <= 4).sort((a, b) => sortKey(b) - sortKey(a)).slice(0, 4);
    const big = Math.max(...Y.bs.map(o => pick(o, ['asset', 'totalAsset']) || 0)) > 1e7 ? 1e-9 : 1;
    const sum = (r, ks) => { const q = q4(r); return q.length === 4 && q.every(o => pick(o, ks) != null) ? q.reduce((s, o) => s + pick(o, ks), 0) * big : null; };
    const lq = q4(Q.bs)[0];
    out.ttm = { np: sum(Q.is, ['shareHolderIncome', 'postTaxProfit']), rev: sum(Q.is, ['revenue', 'netRevenue']), eq: lq ? (pick(lq, ['equity']) || null) * big || null : null };
    out.sh = pick(ov, ['outstandingShare', 'issueShare']);
    out.info = { name: ov && (ov.shortName || ov.companyName), exch: ov && ov.exchange, ind: ov && ov.industry, est: ov && pick(ov, ['establishedYear']) };
    return out;
  }

  /* Mặt bằng ngân hàng: lấy chỉ số quý mới nhất của từng ngân hàng để xếp hạng */
  async function peers(list) {
    const out = {}; let i = 0;
    const w = async () => {
      while (i < list.length) {
        const c = list[i++];
        try {
          const v = await j(`${TC}/tcanalysis/v1/finance/${c}/financialratio?yearly=0&isAll=true`, 15000);
          const r = (Array.isArray(v) ? v : (v && v.data) || []).filter(o => +o.quarter >= 1 && +o.quarter <= 4).sort((a, b) => sortKey(b) - sortKey(a))[0];
          if (r) { out[c] = { _p: `Q${r.quarter}.${String(r.year).slice(2)}` }; for (const k in FIELDS) out[c][k] = pick(r, FIELDS[k]); }
        } catch (e) { /* bỏ qua ngân hàng lỗi */ }
      }
    };
    await Promise.all([w(), w(), w(), w(), w(), w()]);
    for (const k of PCT) { const vs = Object.values(out).map(o => o[k]).filter(v => v != null); if (vs.length && Math.max(...vs.map(Math.abs)) <= 2) Object.values(out).forEach(o => { if (o[k] != null) o[k] = +(o[k] * 100).toFixed(2); }); }
    log('TCBS so sánh ngành ngân hàng', Object.keys(out).length > 0, Object.keys(out).length + '/' + list.length + ' ngân hàng');
    return out;
  }

  /* PE/PB/PS lịch sử = vốn hóa theo giá lịch sử / chỉ tiêu năm tài chính liền trước (tính toán, không phải số công bố) */
  function valuation(px, Y, sh) {
    const out = { pe: { dates: [], v: [] }, pb: { dates: [], v: [] }, ps: { dates: [], v: [] } };
    const yi = y => Y.labels.indexOf(String(y)), lastY = Math.max(...Y.labels.map(Number));
    px.dates.forEach((dt, i) => {
      if (i % 5 && i !== px.dates.length - 1) return;
      const y = Math.min(+dt.slice(0, 4) - 1, lastY), k = yi(y); if (k < 0) return;
      const cap = px.close[i] * sh;
      [['pe', Y.np[k]], ['pb', Y.eq[k]], ['ps', Y.rev[k]]].forEach(([n, b]) => { if (b > 0) { out[n].dates.push(dt); out[n].v.push(cap / b); } });
    });
    return out;
  }
  return { quote, history, fundAll, peers, valuation, diag, FIELDS };
})();
