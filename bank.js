/* ============================================================
   Blue's SAT Practice — full College Board bank (text / MathML)
   Catalog from apdata/index.js (window.QIDX)
   Content lazy-loaded from apdata/q/<2-hex>.js (window.__Q)
   v15
   ============================================================ */
'use strict';

const QUESTIONS = window.QIDX || [];
const QBYID = {}; for(const q of QUESTIONS) QBYID[q.id]=q;
const DIFF_ORDER = ['Easy','Medium','Hard'];

/* per-question pacing targets (seconds): good = aim under, slow = over this is slow */
const PACE2 = {
  'Math':                { Easy:{good:45,slow:75},  Medium:{good:75,slow:110}, Hard:{good:105,slow:150} },
  'Reading and Writing': { Easy:{good:35,slow:60},  Medium:{good:55,slow:85},  Hard:{good:75,slow:105} },
  _:                     { Easy:{good:45,slow:75},  Medium:{good:75,slow:110}, Hard:{good:105,slow:150} }
};
function paceFor(q){ const T=PACE2[q.t]||PACE2._; return T[q.df]||T.Medium; }

/* ---------- persistence (separate store from the PDF site) ---------- */
const STORE_KEY='sat_practice_bank_v1';
let store = { byId:{}, flagged:[], sessions:[] };
try{ const s=JSON.parse(localStorage.getItem(STORE_KEY)); if(s&&s.byId){ store=s; store.flagged=store.flagged||[]; store.sessions=store.sessions||[]; } }catch(e){}
const saveStore = ()=>{ try{ localStorage.setItem(STORE_KEY, JSON.stringify(store)); }catch(e){} };
function recordAttempt(id, correct){ const b=store.byId[id]||{a:0,c:0}; b.a++; if(correct)b.c++; store.byId[id]=b; saveStore(); }
function isFlagged(id){ return store.flagged.includes(id); }
function toggleFlag(id){ const i=store.flagged.indexOf(id); if(i<0)store.flagged.push(id); else store.flagged.splice(i,1); saveStore(); }
function seenCount(id){ const b=store.byId[id]; return (b?.a||0) || (b?.manualSeen ? 1 : 0); }
function markManualSeen(id){
  const b=store.byId[id]||{a:0,c:0};
  if(b.a>0) return; // already has real attempts — don't override
  b.manualSeen=true;
  store.byId[id]=b; saveStore();
}

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

/* ---------- progress (done/total + accuracy) per skill, section, difficulty ---------- */
let PROG = null;
function computeProgress(){
  const byTopic={}, byTest={}, byDiff={};
  for(const q of QUESTIONS){
    const b=store.byId[q.id];
    const seen = b && (b.a>0 || b.manualSeen);
    for(const [map,key] of [[byTopic,q.k],[byTest,q.t],[byDiff,q.df]]){
      const e=map[key]||(map[key]={total:0,done:0,a:0,c:0});
      e.total++;
      if(seen){
        e.done++;
        if(b.a>0){ e.a+=b.a; e.c+=b.c; } // only real attempts affect accuracy
      }
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
   CONTENT LOADER (lazy shards — replaces the PDF renderer)
   ============================================================ */
window.__Q = window.__Q || {};
const __shardP = {};
function loadShard(pfx){
  if(__shardP[pfx]) return __shardP[pfx];
  __shardP[pfx]=new Promise((res)=>{
    const s=document.createElement('script'); s.src='apdata/q/'+pfx+'.js?v=1';
    s.onload=()=>res(); s.onerror=()=>res();   // resolve regardless; caller handles a miss
    document.head.appendChild(s);
  });
  return __shardP[pfx];
}
async function getContent(id){ await loadShard(id.slice(0,2)); return window.__Q[id]; }
/* ============================================================
   MFENCED FIX — Chrome's MathML Core doesn't render <mfenced> fence characters.
   After inserting HTML into the DOM, call fixMfenced(container) to expand
   every <mfenced open="X" close="Y"> into <mrow><mo>X</mo>…<mo>Y</mo></mrow>.
   ============================================================ */
const _MLNS='http://www.w3.org/1998/Math/MathML';
function fixMfenced(root){
  root.querySelectorAll('mfenced').forEach(f=>{
    const open  = f.getAttribute('open')  ?? '(';
    const close = f.getAttribute('close') ?? ')';
    const sepStr=(f.getAttribute('separators')??',').replace(/\s/g,'');
    const seps=sepStr?sepStr.split(''):[','];
    const mrow=document.createElementNS(_MLNS,'mrow');
    if(open){ const mo=document.createElementNS(_MLNS,'mo'); mo.setAttribute('stretchy','false'); mo.textContent=open; mrow.appendChild(mo); }
    const kids=[...f.childNodes].filter(n=>n.nodeType!==3||n.textContent.trim()!=='');
    kids.forEach((child,i)=>{
      mrow.appendChild(child.cloneNode(true));
      if(i<kids.length-1){ const mo=document.createElementNS(_MLNS,'mo'); mo.textContent=seps[Math.min(i,seps.length-1)]||','; mrow.appendChild(mo); }
    });
    if(close){ const mo=document.createElementNS(_MLNS,'mo'); mo.setAttribute('stretchy','false'); mo.textContent=close; mrow.appendChild(mo); }
    f.replaceWith(mrow);
  });
}

function sanitizeHTML(html){
  if(!html) return '';
  // CB encodes fill-in-the-blank as:
  //   <span aria-hidden="true">______</span><span class="sr-only">blank</span>
  // Convert the aria-hidden underscores span first, then clean up any leftover sr-only.
  html = html.replace(/<span[^>]*aria-hidden="true"[^>]*>_{3,}<\/span>/gi, '<span class="cb-blank"></span>');
  html = html.replace(/<span\s+class="sr-only"\s*>blank<\/span>/gi, '');
  // Legacy patterns (older CB format)
  html = html.replace(/_{3,}blank/g, '<span class="cb-blank"></span>');
  html = html.replace(/<u>\s*blank\s*<\/u>/gi, '<span class="cb-blank"></span>');
  // SVG figures: strip ALL hardcoded dimensions (pt OR bare px values like width="400")
  // so CSS max-width + height:auto fully controls scaling via viewBox aspect ratio.
  html = html.replace(/(<svg[^>]*?)\s+width="[\d.]+(?:pt|px|em|rem)?"/gi, '$1');
  html = html.replace(/(<svg[^>]*?)\s+height="[\d.]+(?:pt|px|em|rem)?"/gi, '$1');
  // Strip problematic CB inline style properties from ALL style="" attributes.
  // CB embeds color, font-family, font-size, etc. to match their own UI.
  // We keep structural properties (text-decoration, text-align, vertical-align,
  // margin, padding, display) but remove anything that fights our theme.
  const BAD_PROPS = /^\s*(color|font-family|font-size|font-weight|background(?:-color)?|line-height)\s*:/i;
  html = html.replace(/\sstyle="([^"]*)"/gi, (_, s) => {
    const kept = s.split(';').filter(p => p.trim() && !BAD_PROPS.test(p)).join(';').trim();
    return kept ? ` style="${kept}"` : '';
  });
  return html;
}
function qHTML(c){
  let h='';
  if(c.st && c.st.trim()) h+='<div class="stimulus">'+sanitizeHTML(c.st)+'</div>';
  h+='<div class="stem">'+sanitizeHTML(c.q||'')+'</div>';
  return h;
}

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
    c.innerHTML=`${rw(t)} <span class="c-count">${progFrac(e)}</span>${chipDot(e)}`;
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
let topicSearch='';
function renderOverall(){
  let done=0; const total=QUESTIONS.length;
  for(const q of QUESTIONS){ const b=store.byId[q.id]; if(b&&(b.a>0||b.manualSeen)) done++; }
  const pct = total? Math.round(100*done/total):0;
  $('#overall-meter').innerHTML =
    `<div class="om-top"><span class="om-label">📚 Question bank completed</span>`+
    `<span class="om-val">${done.toLocaleString()} / ${total.toLocaleString()} · ${pct}%</span></div>`+
    `<div class="om-bar"><i style="width:${pct}%"></i></div>`;
}
function renderTopics(){
  const box=$('#f-topics'); box.innerHTML='';
  const qstr=(topicSearch||'').trim().toLowerCase();
  let shown=0;
  for(const t of CAT.testOrder){
    if(!sel.tests.has(t)) continue;
    const T=CAT.tax[t];
    for(const dom of T.domOrder){
      const D=T.doms[dom];
      const domMatch = qstr && dom.toLowerCase().includes(qstr);
      const topics = D.topOrder.filter(k=> !qstr || domMatch || k.toLowerCase().includes(qstr));
      if(!topics.length) continue;
      shown += topics.length;
      const allOn=D.topOrder.every(k=>sel.topics.has(k));
      let dDone=0,dTot=0; for(const k of D.topOrder){ const e=PROG.byTopic[k]; dDone+=e.done; dTot+=e.total; }
      const g=document.createElement('div'); g.className='tg';
      const title=document.createElement('div'); title.className='tg-title'; title.dataset.dom=dom;
      title.innerHTML=`<span class="dom-dot"></span><span class="tg-name">${dom}</span>`+
        `<span class="tg-agg">${dDone}/${dTot}</span><span class="tg-toggle">${allOn?'clear':'all'}</span>`;
      const rows=document.createElement('div'); rows.className='tg-rows';
      for(const k of topics){
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
  if(!shown) box.innerHTML='<div class="hint" style="padding:16px 6px">No skills match your search.</div>';
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
$('#topic-search').addEventListener('input', e=>{ topicSearch=e.target.value; renderTopics(); });
function refreshHome(){ PROG=computeProgress(); renderOverall(); renderTests(); renderDiffs(); renderTopics(); updateMatch(); renderHomeStats(); }
$$('[data-topics]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.topics==='all'){ for(const q of QUESTIONS) if(sel.tests.has(q.t)) sel.topics.add(q.k); }
  else { sel.topics.clear(); }
  renderTopics(); updateMatch();
}));
$('#opt-seen').addEventListener('change', updateMatch);
$('#btn-reset-stats').addEventListener('click',()=>{ if(confirm('Reset ALL saved progress, flags, and session history?')){ store={byId:{},flagged:[],sessions:[]}; saveStore(); refreshHome(); }});
$$('#btn-theme').forEach(b=>b.addEventListener('click',()=>{ document.body.classList.toggle('theme-dark');
  try{localStorage.setItem('sat_theme', document.body.classList.contains('theme-dark')?'d':'l');}catch(e){} }));
if((()=>{try{return localStorage.getItem('sat_theme')==='d'}catch(e){return false}})()) document.body.classList.add('theme-dark');

function selectionLabel(){
  const tests=CAT.testOrder.filter(t=>sel.tests.has(t)).map(rw).join('+');
  const topicsAll = QUESTIONS.every(q=> !sel.tests.has(q.t) || sel.topics.has(q.k));
  const dl = sel.diffs.size===3?'':' · '+DIFF_ORDER.filter(d=>sel.diffs.has(d)).join('/');
  return `${tests}${topicsAll?'':' · '+sel.topics.size+' skills'}${dl}`;
}

$('#btn-start').addEventListener('click',()=> startSession(matching(), {label:selectionLabel()}) );
$('#btn-review-flagged').addEventListener('click',()=>{
  const pool=QUESTIONS.filter(q=>isFlagged(q.id)); if(pool.length) startSession(pool, {flaggedReview:true, label:'Flagged review'});
});
$('#btn-history').addEventListener('click',()=>{ renderHistory(); show('#screen-history'); });

/* ============================================================
   SESSION  (index-based answers -> supports Back navigation)
   ============================================================ */
const state={ queue:[], answers:[], i:0, type:'mc', committed:false, selChoice:null, content:null, _lt:0,
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

async function loadQuestion(){
  const tok=(state._lt=state._lt+1);
  const q=curQ(); const ans=state.answers[state.i];
  state.selChoice=null;
  state.type = q.tp==='mcq' ? 'mc' : 'grid';
  const answered = ans && ans.answered;
  state.committed = !!answered;

  // content first (needed for options, answer key, grading)
  $('#q-render').innerHTML='<div class="loader">Loading…</div>';
  $('#q-render').classList.remove('hidden');
  const c = await getContent(q.id);
  if(tok!==state._lt) return;            // a newer navigation superseded this one
  state.content=c;

  // tags / progress
  $('#q-index').textContent=state.i+1;
  $('#progress-fill').style.width=(((state.i)/state.queue.length)*100)+'%';
  $('#tag-test').textContent=rw(q.t);
  $('#tag-topic').textContent=q.k;
  const dl=q.df.toLowerCase();
  $('#tag-diff').textContent=q.df; $('#tag-diff').className='tag d-'+dl;
  // question number badge + mark-for-review button
  $('#q-num-badge').textContent=state.i+1;
  const fb=$('#btn-flag'); const isF=isFlagged(q.id);
  fb.classList.toggle('on', isF);
  fb.innerHTML=`<svg viewBox="0 0 24 24" width="14" height="14" fill="${isF?'currentColor':'none'}" stroke="currentColor" stroke-width="2.2"><path d="M5 3h14v18l-7-5-7 5V3z"/></svg> Mark for Review`;
  // pace pill
  const pp=$('#pace-pill');
  if(state.timerMode==='pace'){ const p=paceFor(q);
    pp.classList.remove('hidden');
    pp.innerHTML=`<span class="pz good">≤ ${fmt(p.good)}</span><span class="pz slow">slow &gt; ${fmt(p.slow)}</span>`;
    pp.title=`Aim to finish under ${fmt(p.good)} (green). ${fmt(p.good)}–${fmt(p.slow)} is okay (amber). Over ${fmt(p.slow)} is slow (red).`;
  } else pp.classList.add('hidden');

  // render question — CB layout: passage fills left panel, stem goes above choices on right
  const stemEl = $('#q-stem');
  if(c){
    const hasStim = !!(c.st && c.st.trim());
    if(hasStim){
      $('#q-render').innerHTML = '<div class="stimulus">'+sanitizeHTML(c.st)+'</div>';
      $('#q-render').classList.add('stimulus-panel');
      fixMfenced($('#q-render'));
      stemEl.innerHTML = '<div class="stem">'+sanitizeHTML(c.q||'')+'</div>';
      stemEl.classList.remove('hidden');
      fixMfenced(stemEl);
    } else {
      $('#q-render').innerHTML = '<div class="stem">'+sanitizeHTML(c.q||'')+'</div>';
      $('#q-render').classList.remove('stimulus-panel');
      fixMfenced($('#q-render'));
      stemEl.innerHTML = ''; stemEl.classList.add('hidden');
    }
  } else {
    $('#q-render').innerHTML = '<div class="loader">Question content unavailable.</div>';
    $('#q-render').classList.remove('stimulus-panel');
    stemEl.innerHTML = ''; stemEl.classList.add('hidden');
  }
  buildAnswerArea(q, answered?ans:null, c||{});

  // timing
  state.qPausedTotal=0;
  if(answered){ state._frozenQS=(ans.ms||0)/1000; $('#timer-q').textContent=fmt(state._frozenQS); }
  else { state.qStart=Date.now(); }

  // reveal + buttons
  if(answered){ showReveal(q, ans.skipped?null:ans.correct); }
  else { $('#reveal-area').classList.add('hidden'); $('#expl-wrap').classList.add('hidden'); }

  $('#btn-back').classList.toggle('hidden', state.i===0);
  $('#btn-next').textContent = (state.i===state.queue.length-1)? 'Finish ✓' : 'Next →';
  if(answered){
    $('#btn-submit').classList.add('hidden');
    $('#btn-skip').classList.add('hidden');
    $('#btn-mark-seen').classList.add('hidden');
    $('#btn-next').classList.remove('hidden');
  } else {
    $('#btn-submit').classList.remove('hidden');
    $('#btn-submit').textContent = 'Submit';
    $('#btn-submit').disabled = true;
    $('#btn-skip').classList.remove('hidden');
    $('#btn-mark-seen').classList.remove('hidden');
    $('#btn-next').classList.add('hidden');
  }
  tick();
}

function buildAnswerArea(q, restore, c){
  const area=$('#answer-area'); area.innerHTML='';
  if(state.type==='mc'){
    const letters=['A','B','C','D','E','F','G','H'];
    const xoutSVG=(active)=>active
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><line x1="7.5" y1="12" x2="16.5" y2="12"/><line x1="12" y1="7.5" x2="12" y2="16.5"/></svg>`;
    (c.o||[]).forEach((opt,idx)=>{
      const L=letters[idx]||('#'+(idx+1));
      const row=document.createElement('div');
      row.className='choice-row'; row.dataset.letter=L;
      const b=document.createElement('button');
      b.className='choice'; b.dataset.letter=L;
      b.innerHTML=`<span class="letter">${L}</span><span class="ctxt">${sanitizeHTML(opt)}</span><span class="mark"></span>`;
      fixMfenced(b);
      b.addEventListener('click',()=>selectChoice(L));
      const xb=document.createElement('button');
      xb.className='xout-btn'; xb.dataset.letter=L;
      xb.title='Cross out this answer'; xb.tabIndex=-1;
      xb.innerHTML=xoutSVG(false);
      xb.addEventListener('click',(e)=>{
        e.stopPropagation();
        if(state.committed) return;
        const on=row.classList.toggle('xout');
        xb.innerHTML=xoutSVG(on);
      });
      row.appendChild(b); row.appendChild(xb);
      area.appendChild(row);
    });
    if(restore){ applyMcResult(q, restore.picked); }
  } else { // grid-in (student-produced response)
    const wrap=document.createElement('div'); wrap.className='gridin';
    wrap.innerHTML=`<label>Student-produced response</label>
      <input id="grid-input" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. 32 or 7/2 or 1.5" />
      <div class="hint-sm">Enter a number, fraction, or decimal.</div>`;
    area.appendChild(wrap);
    const inp=wrap.querySelector('#grid-input');
    if(restore){ inp.value=restore.picked||''; inp.disabled=true; inp.classList.add(restore.correct?'correct':'wrong'); }
    else { inp.addEventListener('input',()=>{ $('#btn-submit').disabled = inp.value.trim()===''; });
           setTimeout(()=>inp.focus(),60); }
  }
}

function correctAns(){ return (state.content&&state.content.a)||''; }
function applyMcResult(q, picked){
  const ans=correctAns();
  $$('#answer-area .choice').forEach(c=>{
    c.classList.add('locked');
    if(c.dataset.letter===ans){ c.classList.add('correct'); c.querySelector('.mark').textContent='✓'; }
    if(c.dataset.letter===picked && picked!==ans){ c.classList.add('wrong'); c.querySelector('.mark').textContent='✗'; }
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
  for(const a of String(ansStr).split('|')){
    if(normAns(a)===u) return true;
    const av=toNum(a);
    if(isFinite(av)&&isFinite(uv)&&Math.abs(av-uv)<=Math.max(1e-9, Math.abs(av)*1e-4)) return true;
  }
  return false;
}
function answerDisplay(q, c){
  c = c || state.content || {};
  if(q.tp==='mcq') return c.a||'?';
  return String(c.a||'').split('|').join('  or  ');
}

$('#btn-submit').addEventListener('click', submitAnswer);
function submitAnswer(){
  if(state.committed) return;
  const q=curQ(); const c=state.content||{};
  let correct=false, picked=null;
  if(state.type==='mc'){
    if(!state.selChoice) return;
    picked=state.selChoice; correct = picked===(c.a||'');
    applyMcResult(q, picked);
  } else {
    const inp=$('#grid-input'); picked=inp.value; correct=gradeGrid(picked, c.a||'');
    inp.classList.add(correct?'correct':'wrong'); inp.disabled=true;
  }
  commitAnswer({answered:true, skipped:false, correct, picked});
  showReveal(q, correct);
}

function commitAnswer(rec){
  const q=curQ();
  rec.ms = Date.now()-state.qStart-state.qPausedTotal;
  state.answers[state.i]=rec;
  state.committed=true;
  recordAttempt(q.id, rec.correct);
  recomputeScore();
  $('#btn-submit').classList.add('hidden'); $('#btn-skip').classList.add('hidden'); $('#btn-mark-seen').classList.add('hidden');
  $('#btn-next').classList.remove('hidden'); $('#btn-next').focus();
}

function showReveal(q, correct){
  const rv=$('#reveal-area'); rv.classList.remove('hidden');
  const banner=$('#reveal-banner');
  if(correct===null){ banner.className='banner neutral'; banner.textContent='Review'; }
  else { banner.className='banner '+(correct?'ok':'no'); banner.textContent=correct?'Correct':'Incorrect'; }
  $('#reveal-correct').textContent=answerDisplay(q);
  // worked explanation under the (still-visible) question
  $('#expl-wrap').classList.remove('hidden');
  $('#a-render').innerHTML='<div class="rationale">'+sanitizeHTML((state.content&&state.content.r)||'No explanation available.')+'</div>';
  fixMfenced($('#a-render'));
}

$('#btn-skip').addEventListener('click',()=>{
  state.answers[state.i]={answered:false, skipped:true, ms:Date.now()-state.qStart-state.qPausedTotal};
  recomputeScore();
  advance();
});
$('#btn-mark-seen').addEventListener('click',()=>{
  const q=curQ();
  markManualSeen(q.id);
  // treat as a skip in this session
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
  const isF=isFlagged(q.id); $('#btn-flag').classList.toggle('on',isF);
  $('#btn-flag').innerHTML=`<svg viewBox="0 0 24 24" width="14" height="14" fill="${isF?'currentColor':'none'}" stroke="currentColor" stroke-width="2.2"><path d="M5 3h14v18l-7-5-7 5V3z"/></svg> Mark for Review`; });

/* ---------- timers ---------- */
function startTick(){ stopTick(); state.tickId=setInterval(tick,250); tick(); }
function stopTick(){ if(state.tickId){ clearInterval(state.tickId); state.tickId=null; } }
function tick(){
  if(state.paused||state.timerMode==='off') return;
  const totS=(Date.now()-state.tStart-state.pausedTotal)/1000;
  $('#timer-total').textContent=fmt(totS);
  const qt=$('#timer-q');
  let qS;
  if(state.committed){ qS=state._frozenQS||0; }
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
   DESMOS GRAPHING CALCULATOR
   Lazy-loads the Desmos API on first open, then reuses the instance.
   Panel is draggable via the handle bar.
   ============================================================ */
(function initCalc(){
  const panel    = document.getElementById('calc-panel');
  const handle   = document.getElementById('calc-handle');
  const btnOpen  = document.getElementById('btn-calc');
  const btnClose = document.getElementById('btn-calc-close');
  const quizScr  = document.getElementById('screen-quiz');
  const CALC_W   = 600; // docked width in px
  let desmosLoaded = false;
  let docked = true; // tracks whether panel is docked to left

  function getTopbarH(){ return document.querySelector('.quiz-bar')?.getBoundingClientRect().bottom || 52; }

  function dock(){
    docked = true;
    const th = getTopbarH();
    Object.assign(panel.style, {
      left:'0', top:th+'px', right:'auto', bottom:'auto',
      width:CALC_W+'px', height:`calc(100vh - ${th}px)`,
      borderRadius:'0', resize:'none'
    });
    panel.classList.add('docked');
    quizScr.style.paddingLeft = CALC_W+'px';
  }

  function undock(){
    docked = false;
    panel.classList.remove('docked');
    // restore default CSS values so resize works again
    panel.style.borderRadius = '';
    panel.style.resize = '';
    quizScr.style.paddingLeft = '';
  }

  function openCalc(){
    panel.classList.remove('hidden');
    btnOpen.classList.add('on');
    dock();
    if(!desmosLoaded){
      desmosLoaded = true;
      const s = document.createElement('script');
      s.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
      s.onload = ()=>{
        window._desmosCalc = Desmos.GraphingCalculator(
          document.getElementById('calc-container'),
          { keypad:true, expressions:true, settingsMenu:true, zoomButtons:true }
        );
      };
      document.head.appendChild(s);
    }
  }

  function closeCalc(){
    panel.classList.add('hidden');
    btnOpen.classList.remove('on');
    quizScr.style.paddingLeft = '';
    // reset inline styles so next open re-docks cleanly
    panel.style.cssText = '';
    panel.classList.remove('docked');
    docked = true;
  }

  btnOpen.addEventListener('click', ()=>{ panel.classList.contains('hidden') ? openCalc() : closeCalc(); });
  btnClose.addEventListener('click', closeCalc);

  /* drag via handle — undocks on first move */
  let drag = null;
  handle.addEventListener('pointerdown', e=>{
    if(e.target === btnClose) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    drag = { ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e=>{
    if(!drag) return;
    if(!drag.moved){
      drag.moved = true;
      // Snapshot current position before undocking so panel doesn't jump
      const r = panel.getBoundingClientRect();
      undock();
      panel.style.left = r.left+'px';
      panel.style.top  = r.top+'px';
      panel.style.width = r.width+'px';
      panel.style.height= r.height+'px';
      panel.style.bottom=''; panel.style.right='';
    }
    const x = e.clientX - drag.ox, y = e.clientY - drag.oy;
    panel.style.left = Math.max(0, Math.min(window.innerWidth-100,  x))+'px';
    panel.style.top  = Math.max(0, Math.min(window.innerHeight-60, y))+'px';
  });
  handle.addEventListener('pointerup',    ()=>{ drag=null; });
  handle.addEventListener('pointercancel',()=>{ drag=null; });
})();

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
  const byVolume=rows.slice().sort((a,b)=>b.n-a.n);
  buildBars($('#hist-topic-acc'), byVolume, 'Practice some questions to see skill accuracy.');
  const weak=rows.filter(r=>r.n>=3).sort((a,b)=>(a.c/a.n)-(b.c/b.n)).slice(0,6);
  const box=$('#hist-weak');
  if(!weak.length){ box.innerHTML='<div class="hint">Answer at least 3 questions in a skill to surface weak spots.</div>'; return; }
  box.innerHTML='';
  for(const r of weak){
    const pct=Math.round(100*r.c/r.n);
    const col = pct>=70?'var(--green)':pct>=40?'var(--amber)':'var(--red)';
    const el=document.createElement('div'); el.className='weak-row';
    el.innerHTML=`<span class="weak-name" title="${r.label}">${r.label}</span>`+
      `<span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${col}"></span></span>`+
      `<span class="weak-val">${pct}%</span>`+
      `<button class="weak-drill" title="Practice this skill">Drill ▸</button>`;
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
$('#btn-hist-clear').addEventListener('click',()=>{ if(confirm('Clear all session history? (Skill stats and accuracy are kept.)')){ store.sessions=[]; saveStore(); renderHistory(); }});

/* review modal */
async function openReview(q, res){
  const c=await getContent(q.id);
  const dl=q.df.toLowerCase();
  const cur=$('#review-content');
  cur.innerHTML=`<div class="q-tags"><span class="tag">${rw(q.t)}</span><span class="tag tag-topic">${q.k}</span>`+
    `<span class="tag d-${dl}">${q.df}</span></div>`+
    `<div id="rev-q" class="pdf-render">${c?qHTML(c):'—'}</div>`+
    `<div class="reveal-answer" style="margin-top:14px">Correct answer: <strong>${answerDisplay(q,c)}</strong>`+
    (res?` · your result: <strong style="color:${res.skipped?'var(--ink-soft)':res.correct?'var(--green)':'var(--red)'}">${res.skipped?'skipped':res.correct?'correct':'incorrect'}</strong>`:'')+`</div>`+
    `<h3 class="rationale-h" style="margin-top:14px">Explanation</h3>`+
    `<div id="rev-a" class="pdf-render"><div class="rationale">${sanitizeHTML((c&&c.r)||'—')}</div></div>`;
  fixMfenced(cur);
  $('#review-modal').classList.remove('hidden');
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

/* ============================================================
   RESIZABLE COLUMN DIVIDER
   Persists the a-col width to localStorage so it survives between
   questions and page reloads.
   ============================================================ */
const LAYOUT_KEY = 'sat_practice_layout_v1';
let savedACColW = 480;

function applyLayout(){
  const qb = document.querySelector('.quiz-body');
  if(qb) qb.style.setProperty('--a-col-w', savedACColW + 'px');
}
function loadLayout(){
  try{ const v = parseInt(localStorage.getItem(LAYOUT_KEY), 10); if(v >= 260 && v <= 780) savedACColW = v; }catch(e){}
  applyLayout();
}
function saveLayout(){
  try{ localStorage.setItem(LAYOUT_KEY, savedACColW); }catch(e){}
}

(function initDivider(){
  const divider = document.getElementById('col-divider');
  if(!divider) return;
  let drag = null;
  divider.addEventListener('pointerdown', e => {
    e.preventDefault();
    drag = { startX: e.clientX, startW: savedACColW };
    divider.classList.add('dragging');
    divider.setPointerCapture(e.pointerId);
  });
  divider.addEventListener('pointermove', e => {
    if(!drag) return;
    // Moving mouse LEFT (dx < 0) widens the right panel; RIGHT narrows it.
    const dx = e.clientX - drag.startX;
    savedACColW = Math.max(260, Math.min(780, drag.startW - dx));
    applyLayout();
  });
  divider.addEventListener('pointerup', () => {
    if(!drag) return;
    drag = null;
    divider.classList.remove('dragging');
    saveLayout();
  });
  divider.addEventListener('pointercancel', () => {
    if(!drag) return;
    drag = null;
    divider.classList.remove('dragging');
  });
})();

/* ============================================================
   INIT
   ============================================================ */
function init(){
  if(!QUESTIONS.length){ document.body.innerHTML='<p style="padding:40px;font-family:sans-serif">No questions loaded. Make sure apdata/index.js is present (run api-build/assemble.pl).</p>'; return; }
  loadLayout();
  refreshHome();
}
init();
