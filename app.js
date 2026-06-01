/* ============================================================
   SAT Practice — app logic
   Questions rendered from the original PDF pages via PDF.js.
   Metadata (category, topic, difficulty, answer) from data/questions.js
   ============================================================ */
'use strict';

/* ---------- PDF.js worker (blob, so it works from file://) ---------- */
(function initWorker(){
  try{
    if(!window.pdfjsLib){ console.error('pdf.js failed to load'); return; }
    const bin = atob(window.__PDFWORKERB64);
    const u8 = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], {type:'text/javascript'}));
    pdfjsLib.GlobalWorkerOptions.workerSrc = url;
    delete window.__PDFWORKERB64;
  }catch(e){ console.warn('worker init failed; using default', e); }
})();

const QUESTIONS = window.QUESTIONS || [];
const DIFF_ORDER = ['Easy','Medium','Hard'];
const PACE = { 'Math':95, 'Reading and Writing':71 };

/* ---------- persistence ---------- */
const STORE_KEY='sat_practice_v1';
let store = { byId:{}, flagged:[] };
try{ const s=JSON.parse(localStorage.getItem(STORE_KEY)); if(s&&s.byId){ store=s; store.flagged=store.flagged||[]; } }catch(e){}
const saveStore = ()=>{ try{ localStorage.setItem(STORE_KEY, JSON.stringify(store)); }catch(e){} };
function recordAttempt(id, correct){ const b=store.byId[id]||{a:0,c:0}; b.a++; if(correct)b.c++; store.byId[id]=b; saveStore(); }
function isFlagged(id){ return store.flagged.includes(id); }
function toggleFlag(id){ const i=store.flagged.indexOf(id); if(i<0)store.flagged.push(id); else store.flagged.splice(i,1); saveStore(); }

/* ---------- catalog ---------- */
function buildCatalog(){
  const tax={}, testOrder=[], diffCount={};
  for(const q of QUESTIONS){
    if(!tax[q.t]){ tax[q.t]={domOrder:[],doms:{},count:0}; testOrder.push(q.t); }
    const T=tax[q.t]; T.count++;
    if(!T.doms[q.d]){ T.doms[q.d]={topOrder:[],tops:{}}; T.domOrder.push(q.d); }
    const D=T.doms[q.d];
    if(!(q.k in D.tops)){ D.tops[q.k]=0; D.topOrder.push(q.k); }
    D.tops[q.k]++;
    diffCount[q.df]=(diffCount[q.df]||0)+1;
  }
  return {tax,testOrder,diffCount};
}
const CAT = buildCatalog();

/* ---------- selection state ---------- */
const sel = { tests:new Set(CAT.testOrder), topics:new Set(), diffs:new Set(DIFF_ORDER) };
for(const q of QUESTIONS) sel.topics.add(q.k);

/* ---------- tiny DOM helpers ---------- */
const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));
function show(id){ $$('.screen').forEach(s=>s.classList.remove('active')); $(id).classList.add('active'); window.scrollTo(0,0); }
const fmt = s=>{ s=Math.max(0,Math.floor(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

/* ============================================================
   HOME / SETUP
   ============================================================ */
function renderTests(){
  const box=$('#f-test'); box.innerHTML='';
  for(const t of CAT.testOrder){
    const c=document.createElement('div');
    c.className='chip'+(sel.tests.has(t)?' on':'');
    c.dataset.test=t;
    c.innerHTML=`${t} <span class="c-count">${CAT.tax[t].count}</span>`;
    box.appendChild(c);
  }
}
function renderDiffs(){
  const box=$('#f-diff'); box.innerHTML='';
  for(const d of DIFF_ORDER){
    const c=document.createElement('div');
    c.className=`chip diff-${d.toLowerCase()}`+(sel.diffs.has(d)?' on':'');
    c.dataset.diff=d;
    c.innerHTML=`${d} <span class="c-count">${CAT.diffCount[d]||0}</span>`;
    box.appendChild(c);
  }
}
function renderTopics(){
  const box=$('#f-topics'); box.innerHTML='';
  for(const t of CAT.testOrder){
    if(!sel.tests.has(t)) continue;
    const T=CAT.tax[t];
    for(const dom of T.domOrder){
      const D=T.doms[dom];
      const allOn=D.topOrder.every(k=>sel.topics.has(k));
      const g=document.createElement('div'); g.className='tg';
      const title=document.createElement('div'); title.className='tg-title'; title.dataset.dom=dom;
      title.innerHTML=`<span class="dom-dot"></span>${dom} <span class="tg-toggle">${allOn?'clear':'all'}</span>`;
      const items=document.createElement('div'); items.className='tg-items';
      for(const k of D.topOrder){
        const it=document.createElement('div');
        it.className='topic'+(sel.topics.has(k)?' on':'');
        it.dataset.topic=k;
        it.innerHTML=`${k} <span class="t-count">${D.tops[k]}</span>`;
        items.appendChild(it);
      }
      g.appendChild(title); g.appendChild(items); box.appendChild(g);
    }
  }
}
function matching(){
  return QUESTIONS.filter(q=> sel.tests.has(q.t) && sel.topics.has(q.k) && sel.diffs.has(q.df));
}
function updateMatch(){
  const n=matching().length;
  $('#match-num').textContent=n;
  $('#btn-start').disabled = n===0;
}
function renderHomeStats(){
  const ids=Object.keys(store.byId);
  let attempted=0, totA=0, totC=0;
  for(const id of ids){ const b=store.byId[id]; if(b.a>0){attempted++; totA+=b.a; totC+=b.c;} }
  const acc = totA? Math.round(100*totC/totA):0;
  $('#home-stats').innerHTML =
    `<div class="stat-box"><div class="num">${attempted}</div><div class="lbl">questions seen</div></div>`+
    `<div class="stat-box"><div class="num">${acc}%</div><div class="lbl">lifetime accuracy</div></div>`;
  $('#flag-num').textContent=store.flagged.length;
  $('#btn-review-flagged').style.display = store.flagged.length? '' : 'none';
}

/* home events */
$('#f-test').addEventListener('click',e=>{ const c=e.target.closest('.chip'); if(!c)return;
  const t=c.dataset.test; if(sel.tests.has(t)){ if(sel.tests.size>1) sel.tests.delete(t); } else sel.tests.add(t);
  renderTests(); renderTopics(); updateMatch(); });
$('#f-diff').addEventListener('click',e=>{ const c=e.target.closest('.chip'); if(!c)return;
  const d=c.dataset.diff; if(sel.diffs.has(d)){ if(sel.diffs.size>1) sel.diffs.delete(d); } else sel.diffs.add(d);
  renderDiffs(); updateMatch(); });
$('#f-topics').addEventListener('click',e=>{
  const title=e.target.closest('.tg-title');
  if(title){ const dom=title.dataset.dom; const T=CAT.tax[ Object.keys(CAT.tax).find(t=>CAT.tax[t].doms[dom]) ];
    const D=T.doms[dom]; const allOn=D.topOrder.every(k=>sel.topics.has(k));
    D.topOrder.forEach(k=> allOn? sel.topics.delete(k) : sel.topics.add(k));
    renderTopics(); updateMatch(); return; }
  const it=e.target.closest('.topic'); if(!it)return;
  const k=it.dataset.topic; if(sel.topics.has(k)) sel.topics.delete(k); else sel.topics.add(k);
  renderTopics(); updateMatch();
});
$$('[data-topics]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.topics==='all'){ for(const q of QUESTIONS) if(sel.tests.has(q.t)) sel.topics.add(q.k); }
  else { sel.topics.clear(); }
  renderTopics(); updateMatch();
}));
$('#btn-reset-stats').addEventListener('click',()=>{ if(confirm('Reset all saved progress and flags?')){ store={byId:{},flagged:[]}; saveStore(); renderHomeStats(); }});
$('#btn-theme').addEventListener('click',()=>{ document.body.classList.toggle('theme-dark');
  try{localStorage.setItem('sat_theme', document.body.classList.contains('theme-dark')?'d':'l');}catch(e){} });
if((()=>{try{return localStorage.getItem('sat_theme')==='d'}catch(e){return false}})()) document.body.classList.add('theme-dark');

$('#btn-start').addEventListener('click',()=> startSession(matching()) );
$('#btn-review-flagged').addEventListener('click',()=>{
  const pool=QUESTIONS.filter(q=>isFlagged(q.id)); if(pool.length) startSession(pool, true);
});

/* ============================================================
   PDF RENDERING
   ============================================================ */
const docCache=new Map();
function b64ToBytes(b64){ const bin=atob(b64); const n=bin.length; const u8=new Uint8Array(n); for(let i=0;i<n;i++)u8[i]=bin.charCodeAt(i); return u8; }
function loadPdfScript(key, kind, slug){
  if(window.__PDF[key]) return Promise.resolve();
  return new Promise((res,rej)=>{
    const s=document.createElement('script'); s.src=`data/${kind}/${slug}.js`;
    s.onload=()=>res(); s.onerror=()=>rej(new Error('Could not load '+s.src));
    document.head.appendChild(s);
  });
}
async function getDoc(kind, slug){
  const key=kind+':'+slug;
  if(docCache.has(key)){ const d=docCache.get(key); docCache.delete(key); docCache.set(key,d); return d; }
  await loadPdfScript(key, kind, slug);
  const bytes=b64ToBytes(window.__PDF[key]);
  delete window.__PDF[key];
  const doc=await pdfjsLib.getDocument({data:bytes}).promise;
  docCache.set(key,doc);
  if(docCache.size>10){ const old=docCache.keys().next().value; const od=docCache.get(old); docCache.delete(old); try{od.destroy();}catch(e){} }
  return doc;
}
async function renderRange(container, kind, slug, p0, p1){
  const tok=(container._tok||0)+1; container._tok=tok;
  container.innerHTML='<div class="loader">Loading…</div>';
  try{
    const doc=await getDoc(kind, slug);
    if(container._tok!==tok) return;
    const dpr=Math.min(window.devicePixelRatio||1, 2.5);
    const cw=Math.max(280,(container.clientWidth||720)-20);
    const frag=document.createDocumentFragment();
    for(let p=p0;p<=p1;p++){
      if(p<1||p>doc.numPages) continue;
      const page=await doc.getPage(p);
      if(container._tok!==tok) return;
      const base=page.getViewport({scale:1});
      const scale=(cw/base.width)*dpr;
      const vp=page.getViewport({scale});
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(vp.width); canvas.height=Math.round(vp.height);
      await page.render({canvasContext:canvas.getContext('2d',{alpha:false}), viewport:vp}).promise;
      if(container._tok!==tok) return;
      frag.appendChild(canvas);
    }
    container.innerHTML=''; container.appendChild(frag);
  }catch(e){
    if(container._tok===tok) container.innerHTML='<div class="loader">Could not render this question.<br>'+(e.message||'')+'</div>';
  }
}

/* ============================================================
   SESSION
   ============================================================ */
const state={ queue:[], i:0, results:[], correct:0, wrong:0, skipped:0,
  type:'mc', submitted:false, selChoice:null,
  timerMode:'pace', tStart:0, qStart:0, pausedAt:0, pausedTotal:0, qPausedTotal:0, paused:false, tickId:null, flaggedReview:false };

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function startSession(pool, flaggedReview){
  pool=pool.slice();
  const order=$('#opt-order').value;
  const unseen=$('#opt-unseen').checked;
  if(order==='shuffle') shuffle(pool);
  if(unseen) pool.sort((a,b)=>((store.byId[a.id]?.a||0)-(store.byId[b.id]?.a||0)));
  let count=parseInt($('#opt-count').value,10);
  if(!flaggedReview && count>0) pool=pool.slice(0,count);
  if(!pool.length) return;
  state.queue=pool; state.i=0; state.results=[]; state.correct=0; state.wrong=0; state.skipped=0;
  state.timerMode=$('#opt-timer').value; state.flaggedReview=!!flaggedReview;
  state.tStart=Date.now(); state.pausedTotal=0; state.paused=false;
  $('#q-total').textContent=pool.length;
  $('#score-correct').textContent='0'; $('#score-wrong').textContent='0';
  const showTimers = state.timerMode!=='off';
  $('#timer-q').style.display=showTimers?'':'none';
  $('#timer-total').style.display=showTimers?'':'none';
  $('#btn-pause').style.display=showTimers?'':'none';
  show('#screen-quiz');
  startTick();
  loadQuestion();
}

function curQ(){ return state.queue[state.i]; }

function loadQuestion(){
  const q=curQ();
  state.submitted=false; state.selChoice=null;
  state.qStart=Date.now(); state.qPausedTotal=0;
  // progress + tags
  $('#q-index').textContent=state.i+1;
  $('#progress-fill').style.width=((state.i)/state.queue.length*100)+'%';
  $('#tag-test').textContent=q.t;
  $('#tag-topic').textContent=q.k;
  const dl=q.df.toLowerCase();
  $('#tag-diff').textContent=q.df; $('#tag-diff').className='tag d-'+dl;
  const fb=$('#btn-flag'); fb.classList.toggle('on', isFlagged(q.id));
  fb.innerHTML = isFlagged(q.id)? '⚑ Flagged' : '⚑ Flag';
  // render question
  renderRange($('#q-render'),'q',q.qs,q.qp[0],q.qp[1]);
  // answer UI
  state.type = q.mc? 'mc' : (q.sc? 'self':'grid');
  buildAnswerArea(q);
  // reset reveal & buttons
  $('#reveal-area').classList.add('hidden');
  $('#a-render').innerHTML='<div class="loader">Loading…</div>';
  $('#btn-submit').classList.remove('hidden'); $('#btn-submit').disabled = state.type==='self'?false:true;
  $('#btn-submit').textContent = state.type==='self'? 'Reveal answer' : 'Submit';
  $('#btn-next').classList.add('hidden');
  $('#btn-skip').classList.remove('hidden');
  $('#btn-next').textContent = (state.i===state.queue.length-1)? 'Finish →' : 'Next →';
}

function buildAnswerArea(q){
  const area=$('#answer-area'); area.innerHTML='';
  if(state.type==='mc'){
    ['A','B','C','D'].forEach(L=>{
      const b=document.createElement('button');
      b.className='choice'; b.dataset.letter=L;
      b.innerHTML=`<span class="letter">${L}</span><span class="ctxt">Choice ${L}</span><span class="mark"></span>`;
      b.addEventListener('click',()=>selectChoice(L));
      area.appendChild(b);
    });
  } else if(state.type==='grid'){
    const wrap=document.createElement('div'); wrap.className='gridin';
    wrap.innerHTML=`<label>Student-produced response</label>
      <input id="grid-input" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. 32 or 7/2 or 1.5" />
      <div class="hint-sm">Enter a number, fraction, or decimal.</div>`;
    area.appendChild(wrap);
    const inp=wrap.querySelector('#grid-input');
    inp.addEventListener('input',()=>{ $('#btn-submit').disabled = inp.value.trim()===''; });
    setTimeout(()=>inp.focus(),60);
  } else { // self-check
    const note=document.createElement('div'); note.className='selfcheck-note';
    note.textContent='This question’s answer is written-in (and stored as an image). Solve it, then reveal the worked solution and mark yourself.';
    area.appendChild(note);
  }
}

function selectChoice(L){
  if(state.submitted) return;
  state.selChoice=L;
  $$('#answer-area .choice').forEach(c=>c.classList.toggle('sel', c.dataset.letter===L));
  $('#btn-submit').disabled=false;
}

/* grid grading */
function normAns(s){ return String(s).trim().replace(/−/g,'-').replace(/\s+/g,'').replace(/^\+/,'').replace(/%$/,''); }
function toNum(s){ s=normAns(s); if(s==='')return NaN;
  if(s.includes('/')){ const p=s.split('/'); if(p.length!==2)return NaN; const a=parseFloat(p[0]),b=parseFloat(p[1]); return b? a/b : NaN; }
  const v=parseFloat(s); return /^-?(\d+\.?\d*|\.\d+)$/.test(s)? v : NaN; }
function gradeGrid(user, ansStr){
  const u=normAns(user); if(u==='')return false;
  const uv=toNum(u);
  for(const a of ansStr.split('|')){
    if(normAns(a)===u) return true;
    const av=toNum(a);
    if(isFinite(av)&&isFinite(uv)&&Math.abs(av-uv)<=Math.max(1e-9, Math.abs(av)*1e-4)) return true;
  }
  return false;
}

function answerDisplay(q){
  if(q.mc) return q.a;
  if(q.sc) return '(see explanation)';
  return q.a.split('|').join('  or  ');
}

$('#btn-submit').addEventListener('click', submitAnswer);
function submitAnswer(){
  if(state.submitted && state.type!=='self') return;
  const q=curQ();
  if(state.type==='self'){
    // reveal then self-grade
    revealRationale(q, null);
    $('#btn-submit').classList.add('hidden'); $('#btn-skip').classList.add('hidden');
    const area=$('#answer-area');
    if(!area.querySelector('.selfcheck-btns')){
      const row=document.createElement('div'); row.className='selfcheck-btns';
      row.innerHTML=`<button class="ghost" data-sc="1">I got it right</button><button class="ghost" data-sc="0">I got it wrong</button>`;
      area.appendChild(row);
      row.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
        const ok=b.dataset.sc==='1';
        b.classList.add(ok?'sc-right':'sc-wrong');
        row.querySelectorAll('button').forEach(x=>x.disabled=true);
        finishQuestion(q, ok);
      }));
    }
    return;
  }
  let correct=false;
  if(state.type==='mc'){
    if(!state.selChoice) return;
    correct = state.selChoice===q.a;
    $$('#answer-area .choice').forEach(c=>{
      c.classList.add('locked');
      if(c.dataset.letter===q.a){ c.classList.add('correct'); c.querySelector('.mark').textContent='✓'; }
      if(c.dataset.letter===state.selChoice && !correct){ c.classList.add('wrong'); c.querySelector('.mark').textContent='✗'; }
    });
  } else { // grid
    const inp=$('#grid-input'); const val=inp.value;
    correct=gradeGrid(val, q.a);
    inp.classList.add(correct?'correct':'wrong'); inp.disabled=true;
  }
  revealRationale(q, correct);
  finishQuestion(q, correct);
}

function revealRationale(q, correct){
  const rv=$('#reveal-area'); rv.classList.remove('hidden');
  const banner=$('#reveal-banner');
  if(correct===null){ banner.className='banner neutral'; banner.textContent='Worked solution'; }
  else { banner.className='banner '+(correct?'ok':'no'); banner.textContent=correct?'Correct':'Incorrect'; }
  $('#reveal-correct').textContent=answerDisplay(q);
  renderRange($('#a-render'),'a',q.as,q.ap[0],q.ap[1]);
}

function finishQuestion(q, correct){
  if(state.submitted) return;
  state.submitted=true;
  const tMs=Date.now()-state.qStart-state.qPausedTotal;
  if(correct){ state.correct++; $('#score-correct').textContent=state.correct; }
  else { state.wrong++; $('#score-wrong').textContent=state.wrong; }
  recordAttempt(q.id, correct);
  state.results.push({ id:q.id, t:q.t, k:q.k, df:q.df, correct, skipped:false, ms:tMs, q });
  $('#btn-submit').classList.add('hidden'); $('#btn-skip').classList.add('hidden');
  $('#btn-next').classList.remove('hidden');
  $('#btn-next').focus();
}

$('#btn-skip').addEventListener('click',()=>{
  const q=curQ();
  state.skipped++;
  state.results.push({ id:q.id, t:q.t, k:q.k, df:q.df, correct:false, skipped:true, ms:Date.now()-state.qStart-state.qPausedTotal, q });
  advance();
});
$('#btn-next').addEventListener('click', advance);
function advance(){
  state.i++;
  if(state.i>=state.queue.length){ endSession(); return; }
  loadQuestion();
}

$('#btn-quit').addEventListener('click',()=>{ if(confirm('Exit this session? Progress on answered questions is saved.')){ stopTick(); show('#screen-home'); renderHomeStats(); } });
$('#btn-flag').addEventListener('click',()=>{ const q=curQ(); toggleFlag(q.id);
  $('#btn-flag').classList.toggle('on', isFlagged(q.id)); $('#btn-flag').innerHTML=isFlagged(q.id)?'⚑ Flagged':'⚑ Flag'; });

/* ---------- timers ---------- */
function startTick(){ stopTick(); state.tickId=setInterval(tick,250); tick(); }
function stopTick(){ if(state.tickId){ clearInterval(state.tickId); state.tickId=null; } }
function tick(){
  if(state.paused||state.timerMode==='off') return;
  const totS=(Date.now()-state.tStart-state.pausedTotal)/1000;
  const qS=(Date.now()-state.qStart-state.qPausedTotal)/1000;
  $('#timer-total').textContent=fmt(totS);
  const qt=$('#timer-q'); qt.textContent=fmt(qS);
  qt.classList.remove('over','warn');
  if(state.timerMode==='pace'){
    const target=PACE[curQ()?.t]||90;
    if(qS>target) qt.classList.add('over'); else if(qS>target*0.8) qt.classList.add('warn');
  }
}
$('#btn-pause').addEventListener('click',pauseSession);
$('#btn-resume').addEventListener('click',resumeSession);
function pauseSession(){ if(state.paused)return; state.paused=true; state.pausedAt=Date.now(); $('#pause-overlay').classList.remove('hidden'); }
function resumeSession(){ if(!state.paused)return; const d=Date.now()-state.pausedAt; state.pausedTotal+=d; state.qPausedTotal+=d; state.paused=false; $('#pause-overlay').classList.add('hidden'); }

/* ============================================================
   SUMMARY
   ============================================================ */
function endSession(){
  stopTick();
  const r=state.results;
  const answered=r.filter(x=>!x.skipped);
  const acc = answered.length? Math.round(100*state.correct/answered.length):0;
  const totMs=r.reduce((s,x)=>s+x.ms,0);
  const avg = answered.length? totMs/answered.length/1000 : 0;
  $('#big-stats').innerHTML=
    `<div class="big-stat accent"><div class="num">${acc}%</div><div class="lbl">accuracy</div></div>`+
    `<div class="big-stat"><div class="num">${state.correct}/${answered.length}</div><div class="lbl">correct</div></div>`+
    `<div class="big-stat"><div class="num">${fmt(totMs/1000)}</div><div class="lbl">total time</div></div>`+
    `<div class="big-stat"><div class="num">${avg.toFixed(0)}s</div><div class="lbl">avg / question</div></div>`;
  // by difficulty
  buildBars($('#sum-diff'), groupStats(r, x=>x.df), DIFF_ORDER);
  // by topic
  buildBars($('#sum-topic'), groupStats(r, x=>x.k));
  // review list
  const list=$('#sum-list'); list.innerHTML='';
  r.forEach((x,idx)=>{
    const item=document.createElement('div'); item.className='review-item';
    const ic = x.skipped?'sk':(x.correct?'ok':'no');
    const icText = x.skipped?'–':(x.correct?'✓':'✗');
    item.innerHTML=`<span class="ri-ic ${ic}">${icText}</span>`+
      `<span class="ri-topic">${x.k}</span>`+
      `<span class="ri-meta">${x.df} · ${x.t.replace('Reading and Writing','R&W')} · ${fmt(x.ms/1000)}</span>`;
    item.addEventListener('click',()=>openReview(x.q, x));
    list.appendChild(item);
  });
  show('#screen-summary');
}
function groupStats(results, keyFn, order){
  const g={};
  for(const x of results){ if(x.skipped) continue; const k=keyFn(x); g[k]=g[k]||{c:0,n:0}; g[k].n++; if(x.correct)g[k].c++; }
  let keys=Object.keys(g); if(order) keys=order.filter(k=>g[k]); else keys.sort((a,b)=>g[b].n-g[a].n);
  return keys.map(k=>({label:k,c:g[k].c,n:g[k].n}));
}
function buildBars(box, rows){
  box.innerHTML='';
  if(!rows.length){ box.innerHTML='<div class="hint">No graded questions.</div>'; return; }
  for(const row of rows){
    const pct=row.n?Math.round(100*row.c/row.n):0;
    const el=document.createElement('div'); el.className='bar-row';
    const col = pct>=70?'var(--green)':pct>=40?'var(--amber)':'var(--red)';
    el.innerHTML=`<span>${row.label.replace('Reading and Writing','R&W')}</span>`+
      `<span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${col}"></span></span>`+
      `<span class="bar-val">${row.c}/${row.n}</span>`;
    box.appendChild(el);
  }
}
$('#btn-again').addEventListener('click',()=>{ show('#screen-home'); renderHomeStats(); updateMatch(); });
$('#btn-retry-wrong').addEventListener('click',()=>{
  const ids=new Set(state.results.filter(x=>!x.correct).map(x=>x.id));
  const pool=QUESTIONS.filter(q=>ids.has(q.id));
  if(pool.length) startSession(pool, true); else { show('#screen-home'); renderHomeStats(); }
});

/* review modal */
function openReview(q, res){
  const c=$('#review-content');
  const dl=q.df.toLowerCase();
  c.innerHTML=`<div class="q-tags"><span class="tag">${q.t}</span><span class="tag tag-topic">${q.k}</span>`+
    `<span class="tag d-${dl}">${q.df}</span></div>`+
    `<div id="rev-q" class="pdf-render"></div>`+
    `<div class="reveal-answer" style="margin-top:14px">Correct answer: <strong>${answerDisplay(q)}</strong>`+
    (res?` · your result: <strong style="color:${res.skipped?'var(--ink-soft)':res.correct?'var(--green)':'var(--red)'}">${res.skipped?'skipped':res.correct?'correct':'incorrect'}</strong>`:'')+`</div>`+
    `<h3 class="rationale-h" style="margin-top:14px">Explanation</h3><div id="rev-a" class="pdf-render"></div>`;
  $('#review-modal').classList.remove('hidden');
  renderRange($('#rev-q'),'q',q.qs,q.qp[0],q.qp[1]);
  renderRange($('#rev-a'),'a',q.as,q.ap[0],q.ap[1]);
}
$('#review-close').addEventListener('click',()=>$('#review-modal').classList.add('hidden'));
$('#review-modal').addEventListener('click',e=>{ if(e.target.id==='review-modal') $('#review-modal').classList.add('hidden'); });

/* ============================================================
   KEYBOARD
   ============================================================ */
document.addEventListener('keydown',e=>{
  if(!$('#screen-quiz').classList.contains('active')) {
    if(e.key==='Escape'){ $('#review-modal').classList.add('hidden'); }
    return;
  }
  if(state.paused){ if(e.key==='Escape'||e.key.toLowerCase()==='p') resumeSession(); return; }
  const inGrid = document.activeElement && document.activeElement.id==='grid-input';
  if(e.key==='Enter'){
    e.preventDefault();
    if(!$('#btn-next').classList.contains('hidden')) advance();
    else if(!$('#btn-submit').classList.contains('hidden') && !$('#btn-submit').disabled) submitAnswer();
    return;
  }
  if(e.key.toLowerCase()==='f'){ if(!inGrid){ e.preventDefault(); $('#btn-flag').click(); } return; }
  if(e.key.toLowerCase()==='p'){ if(!inGrid){ e.preventDefault(); pauseSession(); } return; }
  if(e.key.toLowerCase()==='s'){ if(!inGrid && !$('#btn-skip').classList.contains('hidden')){ e.preventDefault(); $('#btn-skip').click(); } return; }
  if(state.type==='mc' && !state.submitted){
    let L=null;
    if(['a','b','c','d'].includes(e.key.toLowerCase())) L=e.key.toUpperCase();
    else if(['1','2','3','4'].includes(e.key)) L=['A','B','C','D'][+e.key-1];
    if(L){ e.preventDefault(); selectChoice(L); }
  }
});

/* re-render PDFs crisply when the window size changes */
let _rsz;
window.addEventListener('resize',()=>{ clearTimeout(_rsz); _rsz=setTimeout(()=>{
  if(!$('#screen-quiz').classList.contains('active')) return;
  const q=curQ(); if(!q) return;
  renderRange($('#q-render'),'q',q.qs,q.qp[0],q.qp[1]);
  if(!$('#reveal-area').classList.contains('hidden')) renderRange($('#a-render'),'a',q.as,q.ap[0],q.ap[1]);
}, 300); });

/* ============================================================
   INIT
   ============================================================ */
function init(){
  if(!QUESTIONS.length){ document.body.innerHTML='<p style="padding:40px;font-family:sans-serif">No questions loaded. Make sure data/questions.js is present.</p>'; return; }
  renderTests(); renderDiffs(); renderTopics(); updateMatch(); renderHomeStats();
}
init();
