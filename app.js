// Simple SPA nav
const views = Array.from(document.querySelectorAll('.view'));
const navButtons = Array.from(document.querySelectorAll('.navitem'));
navButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const id = 'view-' + btn.dataset.view;
    views.forEach(v=>v.classList.toggle('show', v.id === id));
    if (btn.dataset.view === 'dashboard') drawDashboard();
  });
});
document.getElementById('yr').textContent = new Date().getFullYear();

// ---- Dashboard demo charts ----
let cashChart, plChart;
function drawDashboard(){
  // Fake cash trajectories (median + band)
  const labels = Array.from({length:18}, (_,i)=>`M${i+1}`);
  const median = labels.map((_,i)=> 200 - i*8 + Math.sin(i/2)*3);  // $k
  const low = median.map((v,i)=> v - (10 + i*0.8));
  const high = median.map((v,i)=> v + (12 + i*0.9));

  const ctx = document.getElementById('chartCash');
  cashChart?.destroy();
  cashChart = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'P10', data:low, borderWidth:0, fill:'+1', backgroundColor:'rgba(99, 102, 241, .15)'},
        {label:'Median', data:median, tension:.25, borderColor:'#7dd3fc', borderWidth:2, pointRadius:0},
        {label:'P90', data:high, borderWidth:0, fill:false}
      ]
    },
    options:{
      responsive:true,
      scales:{ y:{ title:{display:true, text:'Cash ($k)'}, grid:{color:'rgba(255,255,255,.06)'}}, x:{grid:{color:'rgba(255,255,255,.04)'}}},
      plugins:{ legend:{display:false} }
    }
  });

  // Simple last-6-month P&L
  const rev = [60,62,65,70,72,74];
  const exp = [45,46,47,48,50,52];
  const ctx2 = document.getElementById('chartPL');
  plChart?.destroy();
  plChart = new Chart(ctx2, {
    type:'bar',
    data:{ labels:['-5','-4','-3','-2','-1','Now'],
      datasets:[
        {label:'Revenue', data:rev, backgroundColor:'rgba(125,211,252,.5)'},
        {label:'Expenses', data:exp, backgroundColor:'rgba(167,139,250,.45)'}
      ]
    },
    options:{ responsive:true, plugins:{legend:{position:'bottom'}},
      scales:{ y:{ title:{display:true, text:'$k'}, grid:{color:'rgba(255,255,255,.06)'}}}
    }
  });

  // KPIs
  const runwayMonths = Math.max(0, Math.round(median.findLastIndex(v=>v>0)+1));
  document.getElementById('kpiRunway').textContent = `${runwayMonths} months`;
  const pct = Math.min(100, Math.max(0, (runwayMonths/24)*100));
  document.getElementById('runwayBar').style.width = pct + '%';
}
drawDashboard();

// ---- Cashflow Simulator (light Monte Carlo) ----
let cfChart;
function runCF(){
  const start = +document.getElementById('cfStartCash').value || 0;
  const rev = +document.getElementById('cfRevenue').value || 0;
  const costs = +document.getElementById('cfCosts').value || 0;
  const std = +document.getElementById('cfRevStd').value || 0;
  const months = Math.max(1, (+document.getElementById('cfMonths').value||12));
  const sims = Math.max(100, (+document.getElementById('cfSims').value||1000));

  const rng = mulberry32(42); // fixed seed for demo
  const series = [];
  for(let s=0;s<sims;s++){
    let cash = start;
    const path = [];
    for(let m=0;m<months;m++){
      const noise = gaussian(rng)*std;
      cash += Math.max(0, rev + noise) - costs;
      path.push(cash);
    }
    series.push(path);
  }
  // Compute median & bands
  const labels = Array.from({length:months}, (_,i)=>`M${i+1}`);
  const p = (arr,q)=> arr.toSorted((a,b)=>a-b)[Math.floor(q*(arr.length-1))];
  const med=[], lo=[], hi=[];
  for(let m=0;m<months;m++){
    const col = series.map(r=>r[m]);
    med.push(p(col,0.5)); lo.push(p(col,0.1)); hi.push(p(col,0.9));
  }

  // Draw
  const ctx = document.getElementById('chartCF');
  cfChart?.destroy();
  cfChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      {label:'P10', data:lo, borderWidth:0, fill:'+1', backgroundColor:'rgba(99,102,241,.15)'},
      {label:'Median', data:med, tension:.25, borderColor:'#7dd3fc', borderWidth:2, pointRadius:0},
      {label:'P90', data:hi, borderWidth:0, fill:false}
    ]},
    options:{responsive:true, plugins:{legend:{display:false}},
      scales:{ y:{ grid:{color:'rgba(255,255,255,.06)'}}, x:{ grid:{color:'rgba(255,255,255,.04)'}}}
    }
  });

  const shortfall = med.findIndex(v=>v<0);
  const txt = `
    <div><strong>Runs:</strong> ${sims.toLocaleString()}</div>
    <div><strong>Horizon:</strong> ${months} months</div>
    <div><strong>Median cash-out:</strong> ${shortfall>=0 ? 'Month '+(shortfall+1) : 'No shortfall'}</div>
  `;
  document.getElementById('cfSummary').innerHTML = txt;
}
document.getElementById('btnRunCF').addEventListener('click', runCF);

// ---- Scenario Builder (toy curves to compare) ----
let scChart;
function runScenarios(){
  const A = {
    g:+document.getElementById('scA_growth').value/100,
    c:+document.getElementById('scA_churn').value/100,
    e:+document.getElementById('scA_exp').value/100
  };
  const B = {
    g:+document.getElementById('scB_growth').value/100,
    c:+document.getElementById('scB_churn').value/100,
    e:+document.getElementById('scB_exp').value/100
  };
  const months = 18;
  const labels = Array.from({length:months},(_,i)=>`M${i+1}`);
  const base= 60; // $k baseline

  const proj = (params)=> Array.from({length:months},(_,i)=> +(base*Math.pow(1+params.g - params.c, i)).toFixed(2));
  const a = proj(A), b = proj(B);

  const ctx = document.getElementById('chartScenarios');
  scChart?.destroy();
  scChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      {label:'Scenario A', data:a, tension:.25, borderColor:'#7dd3fc', pointRadius:0},
      {label:'Scenario B', data:b, tension:.25, borderColor:'#a78bfa', pointRadius:0}
    ]},
    options:{ responsive:true, plugins:{legend:{position:'bottom'}},
      scales:{ y:{ title:{display:true,text:'Revenue ($k)'}}}
    }
  });
}
document.getElementById('btnRunSc').addEventListener('click', runScenarios);

// ---- Hiring Forecaster ----
let hires = [];
let hiringChart;
const hireTbody = document.getElementById('hireTable').querySelector('tbody');
document.getElementById('btnAddHire').addEventListener('click', ()=>{
  hires.push({role:'Engineer', salary:120000, benefits:20, start:3});
  renderHires();
});
function renderHires(){
  hireTbody.innerHTML='';
  hires.forEach((h,idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${h.role}"></td>
      <td><input type="number" value="${h.salary}"></td>
      <td><input type="number" value="${h.benefits}"></td>
      <td><input type="number" value="${h.start}"></td>
      <td><button data-i="${idx}">✕</button></td>`;
    hireTbody.appendChild(tr);
    const [role,sal,ben,st] = tr.querySelectorAll('input');
    role.addEventListener('input', e=> {h.role=e.target.value; drawHiring();});
    sal.addEventListener('input', e=> {h.salary=+e.target.value||0; drawHiring();});
    ben.addEventListener('input', e=> {h.benefits=+e.target.value||0; drawHiring();});
    st.addEventListener('input', e=> {h.start=+e.target.value||0; drawHiring();});
    tr.querySelector('button').addEventListener('click', ()=>{
      hires.splice(idx,1); renderHires();
    });
  });
  drawHiring();
}
function drawHiring(){
  const months=18, labels = Array.from({length:months},(_,i)=>`M${i+1}`);
  const burn = Array.from({length:months}, ()=> 25000); // base burn
  hires.forEach(h=>{
    const mCost = (h.salary/12)*(1+h.benefits/100);
    for(let m=h.start-1; m<months; m++) burn[m]+=mCost;
  });
  const ctx = document.getElementById('chartHiring');
  hiringChart?.destroy();
  hiringChart = new Chart(ctx, {
    type:'line',
    data:{labels, datasets:[{label:'Monthly Burn ($)', data:burn, borderColor:'#7dd3fc', tension:.2, pointRadius:0}]},
    options:{responsive:true, plugins:{legend:{display:false}}}
  });
}

// ---- Cap Table Lite ----
function calcCapTable(){
  const pre = +document.getElementById('ctPre').value||0;
  const invest = +document.getElementById('ctInvest').value||0;
  const foundersPrePct = (+document.getElementById('ctFounders').value||0)/100;
  const optionsPrePct = (+document.getElementById('ctOptions').value||0)/100;
  const post = pre + invest;

  // convert pre % to post based on new money
  const foundersPost = foundersPrePct * (pre/post);
  const optionsPost  = optionsPrePct  * (pre/post);
  const investorPost = invest/post;

  const otherPost = Math.max(0, 1 - (foundersPost+optionsPost+investorPost));

  const tbl = document.getElementById('ctTable');
  tbl.innerHTML = `
    <thead><tr><th>Holder</th><th>Post-Money %</th></tr></thead>
    <tbody>
      <tr><td>Founders</td><td>${(foundersPost*100).toFixed(2)}%</td></tr>
      <tr><td>Option Pool</td><td>${(optionsPost*100).toFixed(2)}%</td></tr>
      <tr><td>New Investor</td><td>${(investorPost*100).toFixed(2)}%</td></tr>
      <tr><td>Other/Existing</td><td>${(otherPost*100).toFixed(2)}%</td></tr>
    </tbody>`;
}
document.getElementById('btnCalcCT').addEventListener('click', calcCapTable);
calcCapTable();

// ---- P&L (toy CSV parser + chart) ----
let plBarChart;
document.getElementById('btnPL').addEventListener('click', async ()=>{
  const invFile = document.getElementById('plInv').files[0];
  const expFile = document.getElementById('plExp').files[0];
  const inv = invFile ? await readCSV(invFile) : [];
  const exp = expFile ? await readCSV(expFile) : [];

  // Expect columns: date, amount (positive numbers)
  const months = ['Jan','Feb','Mar','Apr','May','Jun'];
  const rev = months.map(()=>0), costs = months.map(()=>0);
  inv.forEach(r=>{ const m = monthIndex(r.date); if(m<6 && m>=0) rev[m]+= +r.amount||0; });
  exp.forEach(r=>{ const m = monthIndex(r.date); if(m<6 && m>=0) costs[m]+= +r.amount||0; });

  // Table
  const sum = a=>a.reduce((s,v)=>s+v,0);
  const tbl = document.getElementById('plTable');
  tbl.innerHTML = `
    <thead><tr><th>Metric</th>${months.map(m=>`<th>${m}</th>`).join('')}<th>Total</th></tr></thead>
    <tbody>
      <tr><td>Revenue</td>${rev.map(v=>`<td>$${v.toFixed(2)}</td>`).join('')}<td>$${sum(rev).toFixed(2)}</td></tr>
      <tr><td>Expenses</td>${costs.map(v=>`<td>$${v.toFixed(2)}</td>`).join('')}<td>$${sum(costs).toFixed(2)}</td></tr>
      <tr><td><strong>Net</strong></td>${rev.map((v,i)=>`<td><strong>$${(v-costs[i]).toFixed(2)}</strong></td>`).join('')}
          <td><strong>$${(sum(rev)-sum(costs)).toFixed(2)}</strong></td></tr>
    </tbody>`;

  // Chart
  const ctx = document.getElementById('chartPLBars');
  plBarChart?.destroy();
  plBarChart = new Chart(ctx, {
    type:'bar',
    data:{ labels:months,
      datasets:[
        {label:'Revenue', data:rev, backgroundColor:'rgba(125,211,252,.6)'},
        {label:'Expenses', data:costs, backgroundColor:'rgba(167,139,250,.55)'}
      ]},
    options:{responsive:true, plugins:{legend:{position:'bottom'}}}
  });
});

// ---- Save/Load/Export (local, JSON) ----
const STORAGE_KEY = 'zcs.cfo.suite.v1';
document.getElementById('btnSave').addEventListener('click', ()=>{
  const snapshot = {
    settings:{ currency: document.getElementById('currency').value },
    hiring: hires
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  alert('Saved locally.');
});
document.getElementById('btnLoad').addEventListener('click', ()=>{
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return alert('No save found.');
  const s = JSON.parse(raw);
  document.getElementById('currency').value = s.settings?.currency || 'USD';
  hires = s.hiring || [];
  renderHires();
  alert('Loaded.');
});
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob = new Blob([localStorage.getItem(STORAGE_KEY)||'{}'], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'zcs-cfo-suite.json'; a.click();
});

// ---- Helpers ----
function readCSV(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>{
      const lines = r.result.split(/\r?\n/).filter(Boolean);
      const [h, ...rows] = lines;
      const headers = h.split(',').map(s=>s.trim().toLowerCase());
      const out = rows.map(line=>{
        const cols = line.split(',').map(s=>s.trim());
        const obj = {}; headers.forEach((k,i)=> obj[k]=cols[i]);
        return obj;
      });
      resolve(out);
    };
    r.onerror = reject;
    r.readAsText(file);
  });
}
function monthIndex(dateStr){
  const m = new Date(dateStr); if (isNaN(m)) return -1;
  return m.getMonth(); // 0..11
}
// Mulberry32 & Gaussian for demo RNG
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function gaussian(rng){ // Box-Muller
  let u=0,v=0; while(u===0) u=rng(); while(v===0) v=rng();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

// initial render
renderHires();
