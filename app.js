/* ================= Tiện ích ================= */
const $ = s => document.querySelector(s);
const fmt = (n, d = 2) => n == null || isNaN(n) ? '–' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: d });
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
};
const C = { ink: '#0e2b4d', or: '#ef7d00', gr: '#1fae63', rd: '#e5484d', bl: '#3b8fe0', am: '#f2b84b', pu: '#6a35b3', gy: '#b9bcc2', lg: '#e3e5e9', dg: '#7d838c', tk: '#17c3a0', bk: '#111' };
const BANKS = ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'STB', 'HDB', 'TPB', 'SHB', 'VIB', 'SSB', 'LPB', 'MSB', 'OCB', 'EIB', 'NAB', 'ABB', 'BAB', 'BVB', 'KLB', 'NVB', 'PGB', 'SGB', 'VAB', 'VBB'];
const lastv = a => { if (a) for (let i = a.length - 1; i >= 0; i--) if (a[i] != null && !isNaN(a[i])) return a[i]; return null; };
const cnt = a => a ? a.filter(v => v != null && !isNaN(v)).length : 0;
const has = (...a) => a.every(x => cnt(x) >= 2);
const dv = (a, b) => a != null && b ? +(a / b * 100).toFixed(2) : null;
const yoy = (a, lag) => a.map((v, i) => i >= lag && v != null && a[i - lag] > 0 ? +((v / a[i - lag] - 1) * 100).toFixed(1) : null);
const cagr = a => { let i = a.length - 1; while (i >= 0 && a[i] == null) i--; const s = a[i - 5]; return i >= 5 && s > 0 && a[i] > 0 ? (Math.pow(a[i] / s, 1 / 5) - 1) * 100 : null; };
const grade = (x, g, a) => x == null ? null : x >= g ? ['Tốt', 'g'] : x >= a ? ['Trung tính', 'a'] : ['Yếu', 'r'];

const ST = { code: '', per: 'year', rng: 365, m: {}, F: null, hist: null, V: null, usr: null, peers: null, bank: false, tok: 0, timer: null, cards: [] };

/* ================= Biểu đồ ================= */
Chart.defaults.font.family = "'Be Vietnam Pro',sans-serif";
Chart.defaults.color = '#66758a';
Chart.defaults.animation = { duration: 450, easing: 'easeOutCubic' };
const CH = {};
const bar = (label, data, color, o = {}) => ({ type: 'bar', label, data, backgroundColor: color, borderRadius: 2, maxBarThickness: 36, unit: ' tỷ đồng', ...o });
const line = (label, data, color, o = {}) => ({ type: 'line', label, data, borderColor: color, backgroundColor: color, borderWidth: 2.4, pointRadius: 0, pointHoverRadius: 5, tension: .25, spanGaps: true, unit: '%', ...o });
function kill(id) { if (CH[id]) { CH[id].destroy(); delete CH[id]; } }
function mk(id, type, labels, ds, o = {}) {
  kill(id);
  const radar = type === 'radar';
  CH[id] = new Chart(document.getElementById(id), {
    type, data: { labels, datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: radar ? 'nearest' : 'index', intersect: false },
      plugins: {
        legend: { display: !radar, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { padding: 10, callbacks: { label: o.tip || (c => ` ${c.dataset.label}: ${fmt(c.parsed.y)}${c.dataset.unit || ''}`) } }
      },
      scales: radar ? { r: { min: 0, max: 100, ticks: { stepSize: 25, backdropColor: 'transparent' }, pointLabels: { font: { size: 12 } } } } : {
        x: { stacked: !!o.stack, grid: { display: false }, ticks: { maxTicksLimit: o.xt || 16, maxRotation: 60 } },
        y: { stacked: !!o.stack, title: { display: !!o.yt, text: o.yt }, ...(o.y || {}) },
        y1: { display: ds.some(d => d.yAxisID === 'y1'), position: 'right', grid: { drawOnChartArea: false }, title: { display: !!o.y1t, text: o.y1t }, ...(o.y1 || {}) }
      }
    }
  });
}
const pctTick = { ticks: { callback: v => v + '%' } };

/* ================= Danh sách thẻ biểu đồ ================= */
const NOSRC = 'Nguồn TCBS không trả về chỉ tiêu này cho mã đang xem.';
const USRONLY = 'Nguồn mở không công bố số liệu này. Hãy điền số liệu thật từ báo cáo tài chính vào bank-data.json.';
const ua = () => { const a = ST.usr && ST.usr.asset && ST.usr.asset[ST.code]; return a && a.labels && a.labels.length ? a : null; };
const fin = L => L && L.labels.length;

const CARDS = [
  { id: 'c_assets', k: 'n', t: 'Tài sản (tỷ đồng)', msg: NOSRC,
    v: L => { const r = dv(lastv(L.recv), lastv(L.ta)); return r == null ? null : r < 10 ? ['An toàn', 'g'] : r < 20 ? ['Trung tính', 'a'] : ['Rủi ro', 'r']; },
    draw: L => { if (!fin(L) || !has(L.ta, L.cash)) return null;
      const oth = L.ta.map((t, i) => t == null ? null : Math.max(t - (L.cash[i] || 0) - (L.recv[i] || 0) - (L.inv[i] || 0) - (L.fixed[i] || 0), 0));
      mk('c_assets', 'bar', L.labels, [bar('Tiền & tương đương', L.cash, C.dg, { stack: 's' }), bar('Các khoản phải thu', L.recv, C.bl, { stack: 's' }), bar('Hàng tồn kho, ròng', L.inv, C.am, { stack: 's' }),
        bar('Tài sản cố định', L.fixed, C.gr, { stack: 's' }), bar('Khác (phần còn lại)', oth, C.gy, { stack: 's' }), line('Khoản phải thu/TS', L.recv.map((v, i) => dv(v, L.ta[i])), C.bk, { yAxisID: 'y1' })], { stack: 1, y1t: '%', y1: { min: 0 } });
      return 'TCBS'; } },
  { id: 'c_fund', k: 'n', t: 'Nguồn vốn (tỷ đồng)', msg: NOSRC,
    v: L => { const e = lastv(L.eq); if (!e) return null; const n = ((lastv(L.st) || 0) + (lastv(L.lt) || 0) - (lastv(L.cash) || 0)) / e * 100; return n < 50 ? ['An toàn', 'g'] : n < 100 ? ['Trung tính', 'a'] : ['Rủi ro', 'r']; },
    draw: L => { if (!fin(L) || !has(L.ta, L.eq)) return null;
      const oth = L.ta.map((t, i) => t == null ? null : Math.max(t - (L.eq[i] || 0) - (L.st[i] || 0) - (L.lt[i] || 0), 0));
      mk('c_fund', 'bar', L.labels, [bar('Vốn chủ sở hữu', L.eq, C.gr, { stack: 's' }), bar('Vay dài hạn', L.lt, C.bl, { stack: 's' }), bar('Vay ngắn hạn', L.st, C.rd, { stack: 's' }), bar('Khác (phần còn lại)', oth, C.gy, { stack: 's' }),
        line('Nợ vay ròng/VCSH', L.eq.map((e, i) => (L.st[i] != null || L.lt[i] != null) ? dv((L.st[i] || 0) + (L.lt[i] || 0) - (L.cash[i] || 0), e) : null), C.bk, { yAxisID: 'y1' })], { stack: 1, y1t: '%' });
      return 'TCBS'; } },
  { id: 'c_roe', k: 'a', t: 'ROE và ROA', msg: NOSRC,
    v: L => grade(lastv(L.roe), 15, 10),
    draw: L => { if (!fin(L) || !(cnt(L.roe) > 1 || cnt(L.roa) > 1)) return null;
      mk('c_roe', 'bar', L.labels, [line('ROE', L.roe, C.or), line('ROA', L.roa, C.gy)], { y: pctTick }); return 'TCBS'; } },
  { id: 'c_rev', k: 'a', t: 'Doanh thu thuần (tỷ đồng)', msg: NOSRC,
    v: L => { if (L.per !== 'year') return null; const g = cagr(L.rev); return g == null ? null : [`Tăng trưởng ${fmt(g, 0)}% kép/năm trong 5 năm gần nhất`, g >= 10 ? 'g' : g >= 0 ? 'a' : 'r']; },
    draw: L => { if (!fin(L) || !has(L.rev)) return null;
      mk('c_rev', 'bar', L.labels, [bar('Doanh thu', L.rev, C.gy), line('Tăng trưởng YoY', yoy(L.rev, L.per === 'year' ? 1 : 4), C.or, { yAxisID: 'y1' })], { y1t: '%' }); return 'TCBS'; } },
  { id: 'c_np', k: 'a', t: 'LNST (tỷ đồng)', msg: NOSRC,
    v: L => { if (L.per !== 'year') return null; const g = cagr(L.np); return g == null ? null : [`Tăng trưởng ${fmt(g, 0)}% kép/năm trong 5 năm gần nhất`, g >= 10 ? 'g' : g >= 0 ? 'a' : 'r']; },
    draw: L => { if (!fin(L) || !has(L.np)) return null;
      mk('c_np', 'bar', L.labels, [bar('LNST cổ đông công ty mẹ', L.np, C.gy), line('Tăng trưởng YoY', yoy(L.np, L.per === 'year' ? 1 : 4), C.or, { yAxisID: 'y1' })], { y1t: '%', y1: { min: -100, max: 100 } }); return 'TCBS'; } },
  { id: 'c_margin', k: 'n', t: 'Biên LNG và biên LNR', msg: NOSRC,
    draw: L => { if (!fin(L) || !has(L.gm, L.nm)) return null;
      mk('c_margin', 'bar', L.labels, [line('Biên lợi nhuận gộp', L.gm, C.or), line('Biên lợi nhuận ròng', L.nm, C.gy)], { y: pctTick }); return 'TCBS'; } },
  { id: 'c_cf', k: 'n', t: 'Lưu chuyển tiền tệ (tỷ đồng)', msg: NOSRC,
    draw: L => { if (!fin(L) || !has(L.cfo, L.cfi, L.cff)) return null;
      mk('c_cf', 'bar', L.labels, [bar('LCTT hoạt động kinh doanh', L.cfo, C.tk, { stack: 's' }), bar('LCTT hoạt động đầu tư', L.cfi, C.am, { stack: 's' }), bar('LCTT hoạt động tài chính', L.cff, '#f26d6d', { stack: 's' }),
        line('Lưu chuyển tiền thuần', L.cfo.map((v, i) => v == null || L.cfi[i] == null || L.cff[i] == null ? null : Math.round(v + L.cfi[i] + L.cff[i])), C.bk, { unit: ' tỷ đồng' })], { stack: 1 }); return 'TCBS'; } },
  { id: 'c_turn', k: 'n', t: 'Vòng quay hàng tồn kho (lần)', msg: NOSRC,
    draw: L => { if (!fin(L) || !has(L.turn)) return null;
      mk('c_turn', 'bar', L.labels, [bar('Hàng tồn kho', L.inv, C.gy, { yAxisID: 'y1' }), line('Vòng quay hàng tồn kho', L.turn, C.bk, { unit: ' lần' })], { y1t: 'tỷ đồng', y: { min: 0 } }); return 'TCBS'; } },

  /* ---- Ngân hàng ---- */
  { id: 'b_radar', k: 'b', t: 'So sánh trong ngành ngân hàng', msg: 'Chưa đủ dữ liệu của các ngân hàng cùng ngành từ TCBS để xếp hạng (cần tối thiểu 8 ngân hàng và 3 chỉ tiêu).',
    draw: () => {
      const P = ST.peers; if (!P || !P[ST.code]) return null;
      const RM = [['ROE', 'roe', 0], ['NIM', 'nim', 0], ['CASA', 'casa', 0], ['COF', 'cof', 1], ['Tỷ lệ nợ xấu', 'npl', 1], ['Bao phủ nợ xấu', 'prov', 0], ['CIR', 'cir', 1], ['Tăng trưởng tín dụng', 'lg', 0]];
      const me = P[ST.code], M = RM.filter(([, k]) => me[k] != null && Object.values(P).filter(o => o[k] != null).length >= 8);
      if (M.length < 3) return null;
      const sc = M.map(([, k, lb]) => { const vs = Object.values(P).map(o => o[k]).filter(v => v != null); return Math.round(vs.filter(v => lb ? v > me[k] : v < me[k]).length / (vs.length - 1) * 100); });
      mk('b_radar', 'radar', M.map(m => m[0]), [{ label: 'Điểm xếp hạng', data: sc, raw: M.map(([, k]) => me[k]), backgroundColor: 'rgba(239,125,0,.18)', borderColor: C.or, pointBackgroundColor: C.or, borderWidth: 2 }],
        { tip: c => ` Điểm ${c.parsed.r}/100 (giá trị ${fmt(c.dataset.raw[c.dataIndex])}, kỳ ${me._p})` });
      return 'TCBS · xếp hạng 0-100 so với các ngân hàng niêm yết'; } },
  { id: 'b_nim', k: 'b', t: 'NIM, CASA, COF và CIR', msg: NOSRC,
    draw: L => { if (!fin(L) || !(cnt(L.nim) > 1 || cnt(L.casa) > 1 || cnt(L.cof) > 1 || cnt(L.cir) > 1)) return null;
      mk('b_nim', 'bar', L.labels, [line('NIM', L.nim, C.or), line('CASA', L.casa, C.bl), line('COF', L.cof, C.rd), line('CIR', L.cir, C.dg)], { y: pctTick }); return 'TCBS'; } },
  { id: 'b_term', k: 'b', t: 'Cơ cấu cho vay theo kỳ hạn', msg: USRONLY, draw: () => peerBars('b_term', 'loanTerm', 'short', 'Tỷ trọng cho vay ngắn hạn (%)', 'Tỷ trọng cho vay trung, dài hạn (%)') },
  { id: 'b_cust', k: 'b', t: 'Cơ cấu cho vay theo nhóm khách hàng', msg: USRONLY, draw: () => peerBars('b_cust', 'loanCustomer', 'retail', 'Tỷ lệ cho vay khách hàng cá nhân (%)', 'Tỷ lệ cho vay khách hàng tổ chức (%)') },
  { id: 'b_npl35', k: 'b', t: 'Nợ xấu (nhóm 3 đến 5)', msg: NOSRC + ' Có thể bổ sung từ bank-data.json.',
    draw: L => { const a = ua(), fu = a && cnt(a.npl35) > 1, lb = fu ? a.labels : L && L.labels; if (!lb) return null;
      const npl = fu ? a.npl35 : L.npl, ds = [];
      const pc = fu ? a.provCredit : L.prov, ps = fu ? a.provSpecific : null, pg = fu ? a.provGeneral : null;
      if (cnt(npl) < 2 && cnt(pc) < 2) return null;
      cnt(npl) > 1 && ds.push(bar('Tỉ lệ nợ xấu (3->5)', npl, C.lg, { yAxisID: 'y1', unit: '%' }));
      cnt(pc) > 1 && ds.push(line('Dự phòng RR tín dụng/Nợ xấu', pc, C.bk)); cnt(ps) > 1 && ds.push(line('Dự phòng cụ thể/Nợ xấu', ps, C.or)); cnt(pg) > 1 && ds.push(line('Dự phòng chung/Nợ xấu', pg, C.bl));
      mk('b_npl35', 'bar', lb, ds, { y1t: '%', y1: { min: 0 }, y: pctTick }); return fu ? 'bank-data.json' : 'TCBS'; } },
  { id: 'b_npl25', k: 'b', t: 'Nợ nhóm 2 đến 5', msg: USRONLY,
    draw: () => { const a = ua(); if (!a || cnt(a.npl25) < 2) return null; const ds = [bar('Tỉ lệ nợ (2->5)', a.npl25, C.lg, { yAxisID: 'y1', unit: '%' })];
      cnt(a.p25Credit) > 1 && ds.push(line('Dự phòng RR tín dụng/Nợ (2->5)', a.p25Credit, C.bk)); cnt(a.p25Specific) > 1 && ds.push(line('Dự phòng cụ thể/Nợ (2->5)', a.p25Specific, C.or)); cnt(a.p25General) > 1 && ds.push(line('Dự phòng chung/Nợ (2->5)', a.p25General, C.bl));
      mk('b_npl25', 'bar', a.labels, ds, { y1t: '%', y1: { min: 0 }, y: pctTick }); return 'bank-data.json'; } },
  { id: 'b_npl345', k: 'b', t: 'Cơ cấu nợ xấu', msg: USRONLY,
    draw: () => { const a = ua(); if (!a || !(cnt(a.g3) > 1 || cnt(a.g4) > 1 || cnt(a.g5) > 1)) return null;
      mk('b_npl345', 'bar', a.labels, [line('Tỷ lệ nợ nhóm 3', a.g3, C.or), line('Tỷ lệ nợ nhóm 4', a.g4, C.bl), line('Tỷ lệ nợ nhóm 5', a.g5, C.bk)], { y: pctTick }); return 'bank-data.json'; } }
];

function peerBars(id, key, field, l1, l2) {   // so sánh giữa các ngân hàng, chỉ từ bank-data.json
  const blk = ST.usr && ST.usr[key], D = blk && blk.data; if (!D) return null;
  const rows = Object.entries(D).filter(([, o]) => o && o[field] != null).sort((a, b) => b[1][field] - a[1][field]);
  if (rows.length < 3) return null;
  mk(id, 'bar', rows.map(r => r[0]), [
    bar(l1, rows.map(r => r[1][field]), rows.map(r => r[0] === ST.code ? C.or : C.gy), { stack: 's', unit: '%' }),
    bar(l2, rows.map(r => +(100 - r[1][field]).toFixed(2)), C.lg, { stack: 's', unit: '%' }),
    line('Mốc 50%', rows.map(() => 50), '#333', { borderDash: [5, 4], borderWidth: 1.3, unit: '%' })], { stack: 1, xt: 40, y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } });
  return 'bank-data.json · số liệu đến ' + (blk.asOf || '?');
}

/* ================= Dựng giao diện ================= */
function buildGrid() {
  ST.cards = CARDS.filter(c => c.k === 'a' || c.k === (ST.bank ? 'b' : 'n') || (ST.bank && c.k === 'b'));
  Object.keys(CH).forEach(kill);
  $('#grid').innerHTML = ST.cards.map(c => `
    <article class="card noData" id="w_${c.id}"><header><h3 id="h_${c.id}">${esc(c.t)}</h3><button class="exp" data-t="${c.id}">Phóng to</button></header>
    <div class="box"><canvas id="${c.id}"></canvas><div class="empty">Đang tải dữ liệu…</div></div></article>`).join('') + `
    <div class="card wide"><div class="range">Xem dữ liệu định giá từ ngày <input type="date" id="d1" value="2010-01-01" min="2009-12-31"> đến ngày <input type="date" id="d2" value="${new Date().toISOString().slice(0, 10)}"></div></div>` +
    ['pe', 'pb', 'ps'].map(k => `
    <article class="card wide noData" id="w_v_${k}"><header><h3 id="h_v_${k}">Định giá ${k.toUpperCase()}</h3><button class="exp" data-t="v_${k}">Phóng to</button></header>
    <div class="box"><canvas id="v_${k}"></canvas><div class="empty">Đang tải dữ liệu…</div></div></article>`).join('');
  $('#d1').onchange = $('#d2').onchange = drawVal;
}
function paint(c) {
  const art = $('#w_' + c.id); if (!art) return;
  const L = ST.F && ST.F[ST.per]; let src = null;
  if (ST.loading) { art.classList.add('noData'); return; }
  try { src = c.draw(L); } catch (e) { Live.diag.push({ n: 'Lỗi vẽ ' + c.id, ok: false, note: e.message }); }
  art.classList.toggle('noData', !src);
  if (!src) { kill(c.id); art.querySelector('.empty').textContent = ST.F || c.k === 'b' ? c.msg : 'Chưa có dữ liệu'; }
  const v = src && L && c.v ? (() => { try { return c.v(L); } catch (e) { return null; } })() : null;
  $('#h_' + c.id).innerHTML = esc(c.t) + (v ? `<span class="pill ${v[1]}">${esc(v[0])}</span>` : '') + (src ? `<span class="badge live">${esc(src)}</span>` : `<span class="badge">Chưa có dữ liệu</span>`);
}
const paintAll = () => { ST.cards.forEach(paint); drawVal(); };

const stat = a => { const s = [...a].sort((x, y) => x - y), n = s.length, mean = a.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / n); return { mean, sd, med: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }; };
const vs = (cur, ref) => (cur / ref - 1) * 100;
function drawVal() {
  const a = $('#d1') && $('#d1').value, b = $('#d2') && $('#d2').value;
  ['pe', 'pb', 'ps'].forEach(k => {
    const art = $('#w_v_' + k); if (!art) return;
    const s = ST.V && ST.V[k], idx = s ? s.dates.map((d, i) => i).filter(i => s.dates[i] >= a && s.dates[i] <= b) : [];
    if (idx.length < 10) { art.classList.add('noData'); kill('v_' + k); art.querySelector('.empty').textContent = ST.loading ? 'Đang tải dữ liệu…' : 'Chưa có dữ liệu để tính ' + k.toUpperCase() + ' (cần giá lịch sử và báo cáo tài chính năm).'; $('#h_v_' + k).textContent = 'Định giá ' + k.toUpperCase(); return; }
    art.classList.remove('noData');
    const v = idx.map(i => s.v[i]), st = stat(v), cur = ST.m[k] != null ? ST.m[k] : v[v.length - 1];
    const lb = idx.map(i => { const [y, mo, d] = s.dates[i].split('-'); return `${d}-${mo}-${y.slice(2)}`; });
    const fl = (n, val, col) => line(n, v.map(() => +val.toFixed(2)), col, { borderDash: [5, 4], borderWidth: 1.4, unit: '' });
    const w = x => `${x < 0 ? 'thấp' : 'cao'} hơn ${Math.abs(x).toFixed(0)}%`;
    $('#h_v_' + k).innerHTML = `Định giá ${k.toUpperCase()} <span style="color:var(--amb)">${fmt(cur)} lần, ${w(vs(cur, st.med))} trung vị, ${w(vs(cur, st.mean))} trung bình</span><span class="badge">Tính toán từ giá lịch sử và báo cáo năm</span>`;
    mk('v_' + k, 'bar', lb, [line(k.toUpperCase(), v, C.or, { unit: '', borderWidth: 1.8 }), fl('Trung vị', st.med, C.dg), fl('-2 StDv', st.mean - 2 * st.sd, C.pu), fl('-1 StDv', st.mean - st.sd, C.gr), fl('Trung bình', st.mean, '#555'), fl('+1 StDv', st.mean + st.sd, C.rd), fl('+2 StDv', st.mean + 2 * st.sd, C.bl)], { xt: 14, y: { suggestedMin: 0 } });
  });
}

/* ================= Phần đầu trang ================= */
function calcM() {
  const m = ST.m, F = ST.F; if (!m.p || !m.sh) return;
  const t = (F && F.ttm) || {}, Y = F && F.year;
  const np = t.np > 0 ? t.np : lastv(Y && Y.np), eq = t.eq > 0 ? t.eq : lastv(Y && Y.eq), rev = t.rev > 0 ? t.rev : lastv(Y && Y.rev);
  m.pe = np > 0 ? m.p * m.sh / np : null; m.pb = eq > 0 ? m.p * m.sh / eq : null; m.ps = rev > 0 ? m.p * m.sh / rev : null;
  m.eps = np > 0 ? np * 1000 / m.sh : null; m.bv = eq > 0 ? eq * 1000 / m.sh : null;
}
function renderId() {
  const m = ST.m;
  $('#logo').textContent = ST.code;
  $('#hName').textContent = m.name ? `${m.name} (${m.exch ? m.exch + ': ' : ''}${ST.code})` : ST.code;
  $('#hSub').textContent = m.ind || '';
  const up = m.ch > 0, dn = m.ch < 0, el = $('#hPrice');
  el.className = 'price ' + (m.p == null ? '' : up ? 'up' : dn ? 'down' : 'flat');
  el.innerHTML = m.p == null ? '–' : `${fmt(m.p)}<small>${up ? '+' : ''}${fmt(m.ch)} (${up ? '+' : ''}${fmt(m.pc)}%)</small>`;
}
function renderKv() {
  const m = ST.m, cap = m.p && m.sh ? m.p * m.sh : null;
  $('#hKv').innerHTML = [['Ngày thành lập', m.est || '–'], ['Vốn hóa (tỷ)', fmt(cap, 1)], ['Cổ phiếu lưu hành (triệu cổ)', fmt(m.sh, 1)], ['P/E', fmt(m.pe)], ['P/B', fmt(m.pb)], ['P/S', fmt(m.ps)], ['EPS (4 quý gần nhất)', fmt(m.eps, 0)], ['BVPS', fmt(m.bv, 0)]]
    .map(r => `<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  $('#hView').innerHTML = ['pe', 'pb', 'ps'].map(k => {
    const s = ST.V && ST.V[k]; if (!s || m[k] == null || s.v.length < 10) return `<div class="row"><span>Định giá ${k.toUpperCase()}</span><span class="tag">Chưa có dữ liệu</span></div>`;
    const x = vs(m[k], stat(s.v).med), c = x <= -10 ? 'g' : x >= 10 ? 'r' : 'a';
    return `<div class="row"><span>Định giá ${k.toUpperCase()}</span><span class="tag ${c}">${x < 0 ? 'Thấp' : 'Cao'} hơn trung vị ${Math.abs(x).toFixed(0)}%</span></div>`;
  }).join('');
}
function drawSpark() {
  const h = ST.hist, cv = $('#spark'); if (!h || !h.dates.length) { kill('spark'); return; }
  const cut = ST.rng ? new Date(Date.now() - ST.rng * 864e5).toISOString().slice(0, 10) : '0';
  const ix = h.dates.map((d, i) => i).filter(i => h.dates[i] >= cut), xs = ix.map(i => h.dates[i]), ys = ix.map(i => h.close[i]);
  if (ys.length < 2) { kill('spark'); return; }
  const col = ys[ys.length - 1] >= ys[0] ? C.gr : C.rd;
  kill('spark');
  CH.spark = new Chart(cv, {
    type: 'line', data: { labels: xs, datasets: [{ data: ys, borderColor: col, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .2, fill: true,
      backgroundColor: c => { const a = c.chart.chartArea; if (!a) return 'transparent'; const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, col + '40'); g.addColorStop(1, col + '00'); return g; } }] },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fmt(c.parsed.y)} nghìn đồng` } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 5, maxRotation: 0 } }, y: { position: 'right', grid: { color: '#eef1f6' }, ticks: { maxTicksLimit: 4 } } } }
  });
}
function setStatus(t, c) { const e = $('#status'); e.textContent = t; e.className = 'badge ' + (c || ''); }
function renderDiag() { $('#diag').innerHTML = Live.diag.map(d => `<div class="${d.ok ? '' : 'bad'}">${d.ok ? '✓' : '✗'} ${esc(d.n)} <span>${esc(d.note)}</span></div>`).join(''); }

/* ================= Nạp dữ liệu ================= */
const inSession = () => { const t = new Date(Date.now() + (new Date().getTimezoneOffset() + 420) * 6e4), h = t.getHours() + t.getMinutes() / 60, w = t.getDay(); return w > 0 && w < 6 && h >= 9 && h < 15; };
function applyQuote(q) {
  Object.assign(ST.m, { p: q.p, ch: q.ch, pc: q.pc });
  const h = ST.hist; if (h) { const n = h.dates.length - 1; if (h.dates[n] === q.date) h.close[n] = q.p; else if (q.date > h.dates[n]) { h.dates.push(q.date); h.close.push(q.p); } if (CH.spark) { const c = CH.spark; c.data.datasets[0].data[c.data.datasets[0].data.length - 1] = q.p; c.update('none'); } }
  calcM(); renderId(); renderKv();
  $('#hBadge').textContent = `Giá trực tiếp · ${q.src} · phiên ${q.date}`; $('#hBadge').className = 'badge live';
  setStatus(`LIVE · ${q.src} · ${new Date().toLocaleTimeString('vi-VN')}`, 'live');
}
function poll(code, tk) {
  const run = async () => {
    if (tk !== ST.tok) return;
    if (!document.hidden) { const q = await Live.quote(code, true).catch(() => null); if (tk !== ST.tok) return; q ? applyQuote(q) : setStatus('Mất kết nối, đang thử lại', 'warn'); }
    ST.timer = setTimeout(run, inSession() ? 10000 : 60000);
  };
  ST.timer = setTimeout(run, inSession() ? 10000 : 60000);
}

async function load(raw) {
  const code = (raw || 'HPG').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!code) return;
  const tk = ++ST.tok; clearTimeout(ST.timer); Live.diag.length = 0;
  Object.assign(ST, { code, m: {}, F: null, hist: null, V: null, peers: null, bank: BANKS.includes(code), loading: true });
  history.replaceState(null, '', '#' + code);
  buildGrid(); renderId(); renderKv(); drawSpark(); $('#hBadge').textContent = ''; $('#vNote').textContent = '';
  setStatus('Đang kết nối nguồn dữ liệu…');
  const live = () => tk === ST.tok;
  const pq = Live.quote(code).then(q => { if (live()) { applyQuote(q); return q; } }).catch(() => null);
  const ph = Live.history(code).then(h => { if (live()) { ST.hist = h; drawSpark(); } return h; }).catch(() => null);
  const pf = Live.fundAll(code).then(F => {
    if (!live()) return null;
    ST.F = F; Object.assign(ST.m, { sh: F.sh || ST.m.sh, name: F.info.name, exch: F.info.exch, ind: F.info.ind, est: F.info.est });
    const bank = BANKS.includes(code) || /ngân hàng/i.test(F.info.ind || '');
    if (bank !== ST.bank) { ST.bank = bank; ST.loading = true; buildGrid(); }
    calcM(); renderId(); renderKv(); return F;
  }).catch(e => { Live.diag.push({ n: 'Báo cáo tài chính TCBS', ok: false, note: e.message }); return null; });
  const [q] = await Promise.all([pq, ph, pf]);
  if (!live()) return;
  ST.loading = false;
  if (ST.F && ST.hist && ST.m.sh) { try { ST.V = Live.valuation(ST.hist, ST.F.year, ST.m.sh); } catch (e) {} }
  calcM(); renderId(); renderKv(); paintAll(); drawSpark();
  $('#vNote').textContent = ST.F ? 'Báo cáo tài chính: TCBS · Giá: VNDirect/TCBS' : 'Chưa lấy được báo cáo tài chính, xem mục chẩn đoán ở cuối trang.';
  q || setStatus('Chưa kết nối được nguồn giá', 'warn');
  if (!q) $('#hBadge').textContent = 'Chưa lấy được giá trực tiếp';
  renderDiag(); poll(code, tk);
  if (ST.bank) Live.peers(BANKS).then(P => { if (live()) { ST.peers = P; paint(CARDS.find(c => c.id === 'b_radar')); renderDiag(); } }).catch(() => {});
}

/* ================= Sự kiện ================= */
$('#grid').addEventListener('click', e => {
  const b = e.target.closest('.exp'); if (!b) return;
  const w = $('#w_' + b.dataset.t), on = w.classList.toggle('full'); b.textContent = on ? 'Thu nhỏ' : 'Phóng to';
  setTimeout(() => CH[b.dataset.t] && CH[b.dataset.t].resize(), 60);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.card.full .exp').forEach(b => b.click()); });
const seg = (id, attr, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset[attr]); });
seg('#perSeg', 'p', p => { ST.per = p; ST.cards.forEach(paint); });
seg('#rangeSeg', 'r', r => { ST.rng = +r; drawSpark(); });
$('#codes').innerHTML = [...BANKS, 'HPG', 'VNM', 'FPT', 'MWG', 'GAS', 'VIC', 'VHM', 'MSN', 'SSI', 'VND', 'PNJ', 'REE'].map(k => `<option value="${k}">`).join('');
$('#proxy').value = store.get('proxy');
$('#saveProxy').onclick = () => { store.set('proxy', $('#proxy').value.trim()); load(ST.code); };
$('#searchForm').onsubmit = e => { e.preventDefault(); load($('#code').value); };

fetch('bank-data.json').then(r => r.ok ? r.json() : null).then(j => { ST.usr = j; if (j) { Live.diag.push({ n: 'bank-data.json', ok: true, note: 'đã nạp' }); ST.cards.forEach(paint); } }).catch(() => {});
load(location.hash.slice(1) || 'HPG');
