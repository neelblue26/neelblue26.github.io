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
const QBYID = {}; for(const q of QUESTIONS) QBYID[q.id]=q;
const DIFF_ORDER = ['Easy','Medium','Hard'];

/* per-question pacing targets (seconds): good = aim under, slow = over this is slow */
const PACE2 = {
  'Math':                { Easy:{good:45,slow:75},  Medium:{good:75,slow:110}, Hard:{good:105,slow:150} },
  'Reading and Writing': { Easy:{good:35,slow:60},  Medium:{good:55,slow:85},  Hard:{good:75,slow:105} },
  _:                     { Easy:{good:45,slow:75},  Medium:{good:75,slow:110}, Hard:{good:105,slow:150} }
};
function paceFor(q){ const T=PACE2[q.t]||PACE2._; return T[q.df]||T.Medium; }

/* ---------- persistence ---------- */
const STORE_KEY='sat_practice_v1';
let store = { byId:{}, flagged:[], sessions:[] };
try{ const s=JSON.parse(localStorage.getItem(STORE_KEY)); if(s&&s.byId){ store=s; store.flagged=store.flagged||[]; store.sessions=store.sessions||[]; } }catch(e){}
const saveStore = ()=>{ try{ localStorage.setItem(STORE_KEY, JSON.stringify(store)); }catch(e){} };
function recordAttempt(id, correct){ const b=store.byId[id]||{a:0,c:0}; b.a++; if(correct)b.c++; store.byId[id]=b; saveStore(); }
function isFlagged(id){ return store.flagged.includes(id); }
function toggleFlag(id){ const i=store.flagged.indexOf(id); if(i<0)store.flagged.push(id); else store.flagged.splice(i,1); saveStore(); }
function seenCount(id){ return store.byId[id]?.a||0; }

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

/* ---------- progress (done/total + accuracy) per topic, test, difficulty ---------- */
let PROG = null;
function computeProgress(){
  const byTopic={}, byTest={}, byDiff={};
  for(const q of QUESTIONS){
    const b=store.byId[q.id]; const seen=b&&b.a>0;
    for(const [map,key] of [[byTopic,q.k],[byTest,q.t],[byDiff,q.df]]){
      const e=map[key]||(map[key]={total:0,done:0,a:0,c:0});
      e.total++; if(seen){ e.done++; e.a+=b.a; e.c+=b.c; }
    }
  }
  return {byTopic,byTest,byDiff};
}
function accInfo(e){ if(!e||!e.a) return null; const pct=Math.round(100*e.c/e.a); return {pct, col: pct>=70?'g':pct>=40?'a':'r'}; }
function progFrac(e){ return e.done>0? `${e.done}/${e.total}` : `${e.total}`; }

/* ---------- tiny DOM helpers ---------- */
const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));
function show(id){ $$('.screen').forEach(s=>s.classList.remove('active')); $(id).classList.add('active'); window.scrollTo(0,0); }
const fmt = s=>{ s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const rw = t=>t.replace('Reading and Writing','R&W');

/* ============================================================
   HOME / SETUP
   ============================================================ */
function chipDot(e){ const a=accInfo(e); return a?`<span class="chip-dot ${a.col}" title="${a.pct}% accuracy"></span>`:''; }
function renderTests(){
  const box=$('#f-test'); box.innerHTML='';
  for(const t of CAT.testOrder){
    const e=PROG.byTest[t];
    const c=document.createElement('div');
    c.className='chip'+(sel.tests.has(t)?' on':'');
    c.dataset.test=t;
    c.innerHTML=`${t} <span class="c-count">${progFrac(e)}</span>${chipDot(e)}`;
    box.appendChild(c);
  }
}
function renderDiffs(){
  const box=$('#f-diff'); box.innerHTML='';
  for(const d of DIFF_ORDER){
    const e=PROG.byDiff[d];
    const c=document.createElement('div');
    c.className=`chip diff-${d.toLowerCase()}`+(sel.diffs.has(d)?' on':'');
    c.dataset.diff=d;
    c.innerHTML=`${d} <span class="c-count">${progFrac(e)}</span>${chipDot(e)}`;
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
      let dDone=0,dTot=0; for(const k of D.topOrder){ const e=PROG.byTopic[k]; dDone+=e.done; dTot+=e.total; }
      const g=document.createElement('div'); g.className='tg';
      const title=document.createElement('div'); title.className='tg-title'; title.dataset.dom=dom;
      title.innerHTML=`<span class="dom-dot"></span><span class="tg-name">${dom}</span>`+
        `<span class="tg-agg">${dDone}/${dTot}</span><span class="tg-toggle">${allOn?'clear':'all'}</span>`;
      const rows=document.createElement('div'); rows.className='tg-rows';
      for(const k of D.topOrder){
        const e=PROG.byTopic[k]; const a=accInfo(e);
        const pct = e.total? Math.round(100*e.done/e.total):0;
        const r=document.createElement('div');
        r.className='topic-row'+(sel.topics.has(k)?' on':'');
        r.dataset.topic=k;
        r.innerHTML=`<span class="tr-check"></span>`+
          `<span class="tr-name" title="${k}">${k}</span>`+
          `<span class="tr-prog"><span class="tr-bar"><i style="width:${pct}%"></i></span><span class="tr-frac">${e.done}/${e.total}</span></span>`+
          `<span class="tr-acc">${a?`<span class="dot ${a.col}"></span>${a.pct}%`:'<span class="tr-none">—</span>'}</span>`;
        rows.appendChild(r);
      }
      g.appendChild(title); g.appendChild(rows); box.appendChild(g);
    }
  }
}
function matching(){
  return QUESTIONS.filter(q=> sel.tests.has(q.t) && sel.topics.has(q.k) && sel.diffs.has(q.df));
}
function updateMatch(){
  const filtered=matching();
  const mode=$('#opt-seen').value;
  const seen=filtered.filter(q=>seenCount(q.id)>0);
  const effective = (mode==='exclude') ? filtered.filter(q=>seenCount(q.id)===0) : filtered;
  $('#match-num').textContent=effective.length;
  $('#btn-start').disabled = effective.length===0;
  const note=$('#excluded-note');
  if(seen.length){
    const byTest={};
    for(const q of seen) byTest[q.t]=(byTest[q.t]||0)+1;
    const parts=CAT.testOrder.filter(t=>byTest[t]).map(t=>`${rw(t)} ${byTest[t]}`).join(' · ');
    note.classList.remove('hidden');
    if(mode==='exclude')
      note.innerHTML=`<span class="ex-tag">excluding ${seen.length} seen</span> ${parts}`;
    else
      note.innerHTML=`<span class="muted">${seen.length} of these already seen — ${parts}</span>`;
  } else note.classList.add('hidden');
}
function renderHomeStats(){
  let attempted=0, totA=0, totC=0;
  for(const id in store.byId){ const b=store.byId[id]; if(b.a>0){attempted++; totA+=b.a; totC+=b.c;} }
  const acc = totA? Math.round(100*totC/totA):0;
  $('#home-stats').innerHTML =
    `<div class="stat-box"><div class="num">${attempted}</div><div class="lbl">questions seen</div></div>`+
    `<div class="stat-box"><div class="num">${acc}%</div><div class="lbl">lifetime accuracy</div></div>`;
  $('#flag-num').textContent=store.flagged.length;
  $('#btn-review-flagged').style.display = store.flagged.length? '' : 'none';
  $('#btn-history').style.display = store.sessions.length? '' : 'none';
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
  const it=e.target.closest('.topic-row'); if(!it)return;
  const k=it.dataset.topic; if(sel.topics.has(k)) sel.topics.delete(k); else sel.topics.add(k);
  renderTopics(); updateMatch();
});
function refreshHome(){ PROG=computeProgress(); renderTests(); renderDiffs(); renderTopics(); updateMatch(); renderHomeStats(); }
$$('[data-topics]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.topics==='all'){ for(const q of QUESTIONS) if(sel.tests.has(q.t)) sel.topics.add(q.k); }
  else { sel.topics.clear(); }
  renderTopics(); updateMatch();
}));
$('#opt-seen').addEventListener('change', updateMatch);
$('#btn-reset-stats').addEventListener('click',()=>{ if(confirm('Reset ALL saved progress, flags, and session history?')){ store={byId:{},flagged:[],sessions:[]}; saveStore(); refreshHome(); }});
$('#btn-theme').addEventListener('click',()=>{ document.body.classList.toggle('theme-dark');
  try{localStorage.setItem('sat_theme', document.body.classList.contains('theme-dark')?'d':'l');}catch(e){} });
if((()=>{try{return localStorage.getItem('sat_theme')==='d'}catch(e){return false}})()) document.body.classList.add('theme-dark');

function selectionLabel(){
  const tests=CAT.testOrder.filter(t=>sel.tests.has(t)).map(rw).join('+');
  const topicsAll = QUESTIONS.every(q=> !sel.tests.has(q.t) || sel.topics.has(q.k));
  const dl = sel.diffs.size===3?'':' · '+DIFF_ORDER.filter(d=>sel.diffs.has(d)).join('/');
  return `${tests}${topicsAll?'':' · '+sel.topics.size+' topics'}${dl}`;
}

$('#btn-start').addEventListener('click',()=> startSession(matching(), {label:selectionLabel()}) );
$('#btn-review-flagged').addEventListener('click',()=>{
  const pool=QUESTIONS.filter(q=>isFlagged(q.id)); if(pool.length) startSession(pool, {flaggedReview:true, label:'Flagged review'});
});
$('#btn-history').addEventListener('click',()=>{ renderHistory(); show('#screen-history'); });

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
   SESSION  (index-based answers -> supports Back navigation)
   ============================================================ */
const state={ queue:[], answers:[], i:0, type:'mc', committed:false, selChoice:null,
  correct:0, wrong:0, skipped:0, label:'',
  timerMode:'pace', tStart:0, qStart:0, pausedAt:0, pausedTotal:0, qPausedTotal:0, paused:false, tickId:null };

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function startSession(pool, opts){
  opts=opts||{};
  pool=pool.slice();
  const order=$('#opt-order').value, mode=$('#opt-seen').value;
  if(!opts.flaggedReview && !opts.retry && mode==='exclude') pool=pool.filter(q=>seenCount(q.id)===0);
  if(order==='shuffle') shuffle(pool);
  if(!opts.flaggedReview && !opts.retry && mode==='unseen') pool.sort((a,b)=>(seenCount(a.id)-seenCount(b.id)));
  const count=parseInt($('#opt-count').value,10);
  if(!opts.flaggedReview && !opts.retry && count>0) pool=pool.slice(0,count);
  if(!pool.length){ alert('No questions match — try different filters or turn off "Exclude seen".'); return; }

  state.queue=pool; state.answers=new Array(pool.length).fill(null); state.i=0;
  state.correct=state.wrong=state.skipped=0; state.label=opts.label||'Practice';
  state.timerMode=$('#opt-timer').value;
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
function recomputeScore(){
  let c=0,w=0,s=0;
  for(const a of state.answers){ if(!a) continue; if(a.skipped) s++; else if(a.correct) c++; else w++; }
  state.correct=c; state.wrong=w; state.skipped=s;
  $('#score-correct').textContent=c; $('#score-wrong').textContent=w;
}

function loadQuestion(){
  const q=curQ(); const ans=state.answers[state.i];
  state.selChoice=null;
  state.type = q.mc? 'mc' : (q.sc? 'self':'grid');
  const answered = ans && ans.answered;
  state.committed = !!answered;

  // tags / progress
  $('#q-index').textContent=state.i+1;
  $('#progress-fill').style.width=(((state.i)/state.queue.length)*100)+'%';
  $('#tag-test').textContent=q.t;
  $('#tag-topic').textContent=q.k;
  const dl=q.df.toLowerCase();
  $('#tag-diff').textContent=q.df; $('#tag-diff').className='tag d-'+dl;
  const fb=$('#btn-flag'); fb.classList.toggle('on', isFlagged(q.id)); fb.innerHTML=isFlagged(q.id)?'⚑ Flagged':'⚑ Flag';
  // pace pill
  const pp=$('#pace-pill');
  if(state.timerMode==='pace'){ const p=paceFor(q);
    pp.classList.remove('hidden');
    pp.innerHTML=`<span class="pz good">≤ ${fmt(p.good)}</span><span class="pz slow">slow &gt; ${fmt(p.slow)}</span>`;
    pp.title=`Aim to finish under ${fmt(p.good)} (green). ${fmt(p.good)}–${fmt(p.slow)} is okay (amber). Over ${fmt(p.slow)} is slow (red).`;
  } else pp.classList.add('hidden');

  renderRange($('#q-render'),'q',q.qs,q.qp[0],q.qp[1]);
  buildAnswerArea(q, answered?ans:null);

  // timing
  state.qPausedTotal=0;
  if(answered){ state._frozenQS=(ans.ms||0)/1000; $('#timer-q').textContent=fmt(state._frozenQS); }
  else { state.qStart=Date.now(); }

  // reveal + buttons
  if(answered){ showReveal(q, ans.skipped?null:ans.correct); }
  else { $('#reveal-area').classList.add('hidden'); $('#a-render').innerHTML='<div class="loader">Loading…</div>'; }

  $('#btn-back').classList.toggle('hidden', state.i===0);
  $('#btn-next').textContent = (state.i===state.queue.length-1)? 'Finish ✓' : 'Next →';
  if(answered){
    $('#btn-submit').classList.add('hidden');
    $('#btn-skip').classList.add('hidden');
    $('#btn-next').classList.remove('hidden');
  } else {
    $('#btn-submit').classList.remove('hidden');
    $('#btn-submit').textContent = state.type==='self'? 'Reveal answer' : 'Submit';
    $('#btn-submit').disabled = state.type!=='self';
    $('#btn-skip').classList.remove('hidden');
    $('#btn-next').classList.add('hidden');
  }
  tick();
}

function buildAnswerArea(q, restore){
  const area=$('#answer-area'); area.innerHTML='';
  if(state.type==='mc'){
    ['A','B','C','D'].forEach(L=>{
      const b=document.createElement('button');
      b.className='choice'; b.dataset.letter=L;
      b.innerHTML=`<span class="letter">${L}</span><span class="ctxt">Choice ${L}</span><span class="mark"></span>`;
      b.addEventListener('click',()=>selectChoice(L));
      area.appendChild(b);
    });
    if(restore){ applyMcResult(q, restore.picked); }
  } else if(state.type==='grid'){
    const wrap=document.createElement('div'); wrap.className='gridin';
    wrap.innerHTML=`<label>Student-produced response</label>
      <input id="grid-input" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. 32 or 7/2 or 1.5" />
      <div class="hint-sm">Enter a number, fraction, or decimal.</div>`;
    area.appendChild(wrap);
    const inp=wrap.querySelector('#grid-input');
    if(restore){ inp.value=restore.picked||''; inp.disabled=true; inp.classList.add(restore.correct?'correct':'wrong'); }
    else { inp.addEventListener('input',()=>{ $('#btn-submit').disabled = inp.value.trim()===''; });
           setTimeout(()=>inp.focus(),60); }
  } else { // self-check
    const note=document.createElement('div'); note.className='selfcheck-note';
    note.textContent='This question’s answer is written-in (and stored as an image). Solve it, then reveal the worked solution and mark yourself.';
    area.appendChild(note);
    if(restore){ addSelfCheckButtons(q, restore.correct); }
  }
}

function applyMcResult(q, picked){
  $$('#answer-area .choice').forEach(c=>{
    c.classList.add('locked');
    if(c.dataset.letter===q.a){ c.classList.add('correct'); c.querySelector('.mark').textContent='✓'; }
    if(c.dataset.letter===picked && picked!==q.a){ c.classList.add('wrong'); c.querySelector('.mark').textContent='✗'; }
  });
}

function selectChoice(L){
  if(state.committed) return;
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
  if(state.committed) return;
  const q=curQ();
  if(state.type==='self'){
    showReveal(q, null);
    $('#btn-submit').classList.add('hidden'); $('#btn-skip').classList.add('hidden');
    addSelfCheckButtons(q, null);
    return;
  }
  let correct=false, picked=null;
  if(state.type==='mc'){
    if(!state.selChoice) return;
    picked=state.selChoice; correct = picked===q.a;
    applyMcResult(q, picked);
  } else {
    const inp=$('#grid-input'); picked=inp.value; correct=gradeGrid(picked, q.a);
    inp.classList.add(correct?'correct':'wrong'); inp.disabled=true;
  }
  commitAnswer({answered:true, skipped:false, correct, picked});
  showReveal(q, correct);
}

function addSelfCheckButtons(q, chosen){
  const area=$('#answer-area');
  if(area.querySelector('.selfcheck-btns')) return;
  const row=document.createElement('div'); row.className='selfcheck-btns';
  row.innerHTML=`<button class="ghost" data-sc="1">I got it right</button><button class="ghost" data-sc="0">I got it wrong</button>`;
  area.appendChild(row);
  row.querySelectorAll('button').forEach(b=>{
    const ok=b.dataset.sc==='1';
    if(chosen!==null){ b.disabled=true; if(ok===chosen) b.classList.add(ok?'sc-right':'sc-wrong'); }
    else b.addEventListener('click',()=>{
      b.classList.add(ok?'sc-right':'sc-wrong');
      row.querySelectorAll('button').forEach(x=>x.disabled=true);
      commitAnswer({answered:true, skipped:false, correct:ok, picked:ok?'right':'wrong'});
    });
  });
}

function commitAnswer(rec){
  const q=curQ();
  rec.ms = Date.now()-state.qStart-state.qPausedTotal;
  state.answers[state.i]=rec;
  state.committed=true;
  recordAttempt(q.id, rec.correct);
  recomputeScore();
  $('#btn-submit').classList.add('hidden'); $('#btn-skip').classList.add('hidden');
  $('#btn-next').classList.remove('hidden'); $('#btn-next').focus();
}

function showReveal(q, correct){
  const rv=$('#reveal-area'); rv.classList.remove('hidden');
  const banner=$('#reveal-banner');
  if(correct===null){ banner.className='banner neutral'; banner.textContent='Worked solution'; }
  else { banner.className='banner '+(correct?'ok':'no'); banner.textContent=correct?'Correct':'Incorrect'; }
  $('#reveal-correct').textContent=answerDisplay(q);
  renderRange($('#a-render'),'a',q.as,q.ap[0],q.ap[1]);
}

$('#btn-skip').addEventListener('click',()=>{
  state.answers[state.i]={answered:false, skipped:true, ms:Date.now()-state.qStart-state.qPausedTotal};
  recomputeScore();
  advance();
});
$('#btn-next').addEventListener('click', advance);
$('#btn-back').addEventListener('click',()=>{ if(state.i>0){ state.i--; loadQuestion(); } });
function advance(){
  if(state.i>=state.queue.length-1){ endSession(); return; }
  state.i++; loadQuestion();
}

$('#btn-quit').addEventListener('click',()=>{ if(confirm('Exit this session? Answered questions are saved to your stats, but this won’t be recorded as a completed session.')){ stopTick(); show('#screen-home'); refreshHome(); } });
$('#btn-flag').addEventListener('click',()=>{ const q=curQ(); toggleFlag(q.id);
  $('#btn-flag').classList.toggle('on', isFlagged(q.id)); $('#btn-flag').innerHTML=isFlagged(q.id)?'⚑ Flagged':'⚑ Flag'; });

/* ---------- timers ---------- */
function startTick(){ stopTick(); state.tickId=setInterval(tick,250); tick(); }
function stopTick(){ if(state.tickId){ clearInterval(state.tickId); state.tickId=null; } }
function tick(){
  if(state.paused||state.timerMode==='off') return;
  const totS=(Date.now()-state.tStart-state.pausedTotal)/1000;
  $('#timer-total').textContent=fmt(totS);
  const qt=$('#timer-q');
  let qS;
  if(state.committed){ qS=state._frozenQS||0; }          // frozen at recorded time when reviewing
  else { qS=(Date.now()-state.qStart-state.qPausedTotal)/1000; qt.textContent=fmt(qS); }
  qt.classList.remove('good','warn','over');
  if(state.timerMode==='pace'){
    const p=paceFor(curQ());
    if(qS<=p.good) qt.classList.add('good'); else if(qS<=p.slow) qt.classList.add('warn'); else qt.classList.add('over');
  }
}
$('#btn-pause').addEventListener('click',pauseSession);
$('#btn-resume').addEventListener('click',resumeSession);
function pauseSession(){ if(state.paused||state.timerMode==='off')return; state.paused=true; state.pausedAt=Date.now(); $('#pause-overlay').classList.remove('hidden'); }
function resumeSession(){ if(!state.paused)return; const d=Date.now()-state.pausedAt; state.pausedTotal+=d; state.qPausedTotal+=d; state.paused=false; $('#pause-overlay').classList.add('hidden'); }

/* ============================================================
   SUMMARY  (post-session)
   ============================================================ */
let lastSummary=null;
function endSession(){
  stopTick();
  const items = state.answers.map((a,i)=>{ const q=state.queue[i];
    if(!a) return {id:q.id,t:q.t,k:q.k,df:q.df,correct:false,skipped:true,ms:0};
    return {id:q.id,t:q.t,k:q.k,df:q.df,correct:!!a.correct,skipped:!!a.skipped,ms:a.ms||0};
  });
  const correct=items.filter(x=>!x.skipped&&x.correct).length;
  const answered=items.filter(x=>!x.skipped).length;
  const skipped=items.filter(x=>x.skipped).length;
  const totalMs=items.reduce((s,x)=>s+x.ms,0);
  const session={ ts:Date.now(), label:state.label, correct, wrong:answered-correct, skipped, answered, totalMs, items };
  store.sessions.push(session);
  if(store.sessions.length>120) store.sessions=store.sessions.slice(-120);
  saveStore();
  renderSummary(session);
  show('#screen-summary');
}
function renderSummary(session){
  lastSummary=session;
  const {items, correct, answered, totalMs}=session;
  const acc = answered? Math.round(100*correct/answered):0;
  const avg = answered? totalMs/answered/1000 : 0;
  $('#big-stats').innerHTML=
    `<div class="big-stat accent"><div class="num">${acc}%</div><div class="lbl">accuracy</div></div>`+
    `<div class="big-stat"><div class="num">${correct}/${answered}</div><div class="lbl">correct</div></div>`+
    `<div class="big-stat"><div class="num">${fmt(totalMs/1000)}</div><div class="lbl">total time</div></div>`+
    `<div class="big-stat"><div class="num">${avg.toFixed(0)}s</div><div class="lbl">avg / question</div></div>`;
  buildBars($('#sum-diff'), groupStats(items, x=>x.df), DIFF_ORDER);
  buildBars($('#sum-topic'), groupStats(items, x=>x.k));
  const list=$('#sum-list'); list.innerHTML='';
  items.forEach(x=> list.appendChild(reviewRow(x)) );
}
function reviewRow(x){
  const item=document.createElement('div'); item.className='review-item';
  const ic = x.skipped?'sk':(x.correct?'ok':'no');
  const icText = x.skipped?'–':(x.correct?'✓':'✗');
  item.innerHTML=`<span class="ri-ic ${ic}">${icText}</span>`+
    `<span class="ri-topic">${x.k}</span>`+
    `<span class="ri-meta">${x.df} · ${rw(x.t)} · ${fmt(x.ms/1000)}</span>`;
  item.addEventListener('click',()=>{ const q=QBYID[x.id]; if(q) openReview(q, x); });
  return item;
}
function groupStats(items, keyFn, order){
  const g={};
  for(const x of items){ if(x.skipped) continue; const k=keyFn(x); g[k]=g[k]||{c:0,n:0}; g[k].n++; if(x.correct)g[k].c++; }
  let keys=Object.keys(g); if(order) keys=order.filter(k=>g[k]); else keys.sort((a,b)=>g[b].n-g[a].n);
  return keys.map(k=>({label:k,c:g[k].c,n:g[k].n}));
}
function buildBars(box, rows, emptyMsg){
  box.innerHTML='';
  if(!rows.length){ box.innerHTML=`<div class="hint">${emptyMsg||'No graded questions.'}</div>`; return; }
  for(const row of rows){
    const pct=row.n?Math.round(100*row.c/row.n):0;
    const col = pct>=70?'var(--green)':pct>=40?'var(--amber)':'var(--red)';
    const el=document.createElement('div'); el.className='bar-row';
    el.innerHTML=`<span title="${row.label}">${rw(row.label)}</span>`+
      `<span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${col}"></span></span>`+
      `<span class="bar-val">${pct}% · ${row.c}/${row.n}</span>`;
    box.appendChild(el);
  }
}
$('#btn-again').addEventListener('click',()=>{ show('#screen-home'); refreshHome(); });
$('#btn-sum-history').addEventListener('click',()=>{ renderHistory(); show('#screen-history'); });
$('#btn-retry-wrong').addEventListener('click',()=>{
  const ids=new Set((lastSummary?lastSummary.items:[]).filter(x=>!x.correct).map(x=>x.id));
  const pool=QUESTIONS.filter(q=>ids.has(q.id));
  if(pool.length) startSession(pool, {retry:true, label:'Retry incorrect'}); else { show('#screen-home'); refreshHome(); }
});

/* ============================================================
   HISTORY & ANALYTICS
   ============================================================ */
function renderHistory(){
  const S=store.sessions;
  // overview
  let totA=0,totC=0; for(const id in store.byId){ totA+=store.byId[id].a; totC+=store.byId[id].c; }
  const answeredAll = S.reduce((s,x)=>s+(x.answered||0),0);
  const timeAll = S.reduce((s,x)=>s+(x.totalMs||0),0);
  const acc = totA? Math.round(100*totC/totA):0;
  $('#hist-overview').innerHTML=
    `<div class="big-stat accent"><div class="num">${acc}%</div><div class="lbl">overall accuracy</div></div>`+
    `<div class="big-stat"><div class="num">${S.length}</div><div class="lbl">sessions</div></div>`+
    `<div class="big-stat"><div class="num">${answeredAll}</div><div class="lbl">questions done</div></div>`+
    `<div class="big-stat"><div class="num">${fmt(timeAll/1000)}</div><div class="lbl">total time</div></div>`;
  renderActivity();
  renderTopicAnalytics();
  renderSessions();
}

function dayKey(ts){ const d=new Date(ts); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function renderActivity(){
  const box=$('#hist-activity'); box.innerHTML='';
  const days=14, today=new Date(); today.setHours(0,0,0,0);
  const buckets=[];
  for(let i=days-1;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); buckets.push({d, key:dayKey(d.getTime()), n:0, c:0}); }
  const map={}; buckets.forEach(b=>map[b.key]=b);
  for(const s of store.sessions){ const b=map[dayKey(s.ts)]; if(!b) continue;
    for(const it of s.items){ if(it.skipped) continue; b.n++; if(it.correct) b.c++; } }
  const maxN=Math.max(1,...buckets.map(b=>b.n));
  const chart=document.createElement('div'); chart.className='act-chart';
  for(const b of buckets){
    const acc = b.n? Math.round(100*b.c/b.n):0;
    const col = b.n? (acc>=70?'var(--green)':acc>=40?'var(--amber)':'var(--red)') : 'var(--line)';
    const h = b.n? Math.max(8, Math.round(b.n/maxN*72)) : 2;
    const col_el=document.createElement('div'); col_el.className='act-col';
    col_el.title = b.n? `${b.d.toLocaleDateString()} — ${b.n} questions, ${acc}% correct` : `${b.d.toLocaleDateString()} — no practice`;
    col_el.innerHTML=`<span class="act-n">${b.n||''}</span>`+
      `<span class="act-bar" style="height:${h}%;background:${col}"></span>`+
      `<span class="act-d">${b.d.getMonth()+1}/${b.d.getDate()}</span>`;
    chart.appendChild(col_el);
  }
  box.appendChild(chart);
  if(!store.sessions.length) box.innerHTML='<div class="hint">No sessions yet.</div>';
}

function topicAgg(){
  const g={};
  for(const id in store.byId){ const b=store.byId[id]; if(!b.a) continue; const q=QBYID[id]; if(!q) continue;
    const k=q.k; g[k]=g[k]||{n:0,c:0,t:q.t,d:q.d}; g[k].n+=b.a; g[k].c+=b.c; }
  return g;
}
function renderTopicAnalytics(){
  const g=topicAgg();
  const rows=Object.keys(g).map(k=>({label:k,c:g[k].c,n:g[k].n}));
  // accuracy by topic — sort by most practiced
  const byVolume=rows.slice().sort((a,b)=>b.n-a.n);
  buildBars($('#hist-topic-acc'), byVolume, 'Practice some questions to see topic accuracy.');
  // weakest — require a little data, sort by accuracy asc
  const weak=rows.filter(r=>r.n>=3).sort((a,b)=>(a.c/a.n)-(b.c/b.n)).slice(0,6);
  const box=$('#hist-weak');
  if(!weak.length){ box.innerHTML='<div class="hint">Answer at least 3 questions in a topic to surface weak spots.</div>'; return; }
  box.innerHTML='';
  for(const r of weak){
    const pct=Math.round(100*r.c/r.n);
    const col = pct>=70?'var(--green)':pct>=40?'var(--amber)':'var(--red)';
    const el=document.createElement('div'); el.className='weak-row';
    el.innerHTML=`<span class="weak-name" title="${r.label}">${r.label}</span>`+
      `<span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${col}"></span></span>`+
      `<span class="weak-val">${pct}%</span>`+
      `<button class="weak-drill" title="Practice this topic">Drill ▸</button>`;
    el.querySelector('.weak-drill').addEventListener('click',()=>{
      const pool=QUESTIONS.filter(q=>q.k===r.label);
      if(pool.length) startSession(pool, {retry:true, label:'Drill: '+r.label});
    });
    box.appendChild(el);
  }
}

function renderSessions(){
  const box=$('#hist-sessions'); box.innerHTML='';
  if(!store.sessions.length){ box.innerHTML='<div class="hint">No sessions recorded yet — finish a practice set and it’ll show up here.</div>'; return; }
  for(let i=store.sessions.length-1;i>=0;i--){
    const s=store.sessions[i];
    const acc = s.answered? Math.round(100*s.correct/s.answered):0;
    const accCol = acc>=70?'var(--green)':acc>=40?'var(--amber)':'var(--red)';
    const card=document.createElement('div'); card.className='session';
    const d=new Date(s.ts);
    const dateStr=d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
    const head=document.createElement('div'); head.className='session-head';
    head.innerHTML=`<span class="s-acc" style="color:${accCol}">${acc}%</span>`+
      `<span class="s-main"><b>${s.label||'Practice'}</b><span class="s-sub">${dateStr}</span></span>`+
      `<span class="s-meta">${s.correct}/${s.answered}${s.skipped?` · ${s.skipped} skipped`:''} · ${fmt(s.totalMs/1000)}</span>`+
      `<span class="s-caret">▾</span>`;
    const body=document.createElement('div'); body.className='session-body';
    const wrong=s.items.filter(x=>!x.skipped&&!x.correct);
    let built=false;
    head.addEventListener('click',()=>{
      card.classList.toggle('open');
      if(!built){ built=true;
        if(wrong.length){ const lbl=document.createElement('div'); lbl.className='sb-label'; lbl.textContent=`Missed (${wrong.length}) — tap to review`; body.appendChild(lbl); }
        s.items.forEach(x=> body.appendChild(reviewRow(x)) );
        if(!wrong.length){ const ok=document.createElement('div'); ok.className='sb-label good'; ok.textContent='No misses in this session 🎉'; body.insertBefore(ok, body.firstChild); }
      }
    });
    card.appendChild(head); card.appendChild(body); box.appendChild(card);
  }
}
$('#btn-hist-back').addEventListener('click',()=>{ show('#screen-home'); refreshHome(); });
$('#btn-hist-clear').addEventListener('click',()=>{ if(confirm('Clear all session history? (Topic stats and accuracy are kept.)')){ store.sessions=[]; saveStore(); renderHistory(); }});

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
  if(!$('#review-modal').classList.contains('hidden')){ if(e.key==='Escape') $('#review-modal').classList.add('hidden'); return; }
  if(state.paused){ if(e.key==='Escape'||e.key.toLowerCase()==='p') resumeSession(); return; }
  const inGrid = document.activeElement && document.activeElement.id==='grid-input';
  if(e.key==='Enter'){
    e.preventDefault();
    if(!$('#btn-next').classList.contains('hidden')) advance();
    else if(!$('#btn-submit').classList.contains('hidden') && !$('#btn-submit').disabled) submitAnswer();
    return;
  }
  if(e.key==='ArrowLeft'){ if(!$('#btn-back').classList.contains('hidden')){ e.preventDefault(); $('#btn-back').click(); } return; }
  if(e.key==='ArrowRight'){ if(!$('#btn-next').classList.contains('hidden')){ e.preventDefault(); advance(); } return; }
  if(inGrid) return;
  if(e.key.toLowerCase()==='f'){ e.preventDefault(); $('#btn-flag').click(); return; }
  if(e.key.toLowerCase()==='p'){ e.preventDefault(); pauseSession(); return; }
  if(e.key.toLowerCase()==='b'){ if(!$('#btn-back').classList.contains('hidden')){ e.preventDefault(); $('#btn-back').click(); } return; }
  if(e.key.toLowerCase()==='s'){ if(!$('#btn-skip').classList.contains('hidden')){ e.preventDefault(); $('#btn-skip').click(); } return; }
  if(state.type==='mc' && !state.committed){
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
  refreshHome();
}
init();
