'use strict';

// ─── STATE ────────────────────────────────────────────────
const today = new Date(); today.setHours(0,0,0,0);
const state = {
  today, calViewDate: new Date(today),
  viewMode:'week', weekOffset:0, monthOffset:0,
  tasks:{}, statsMode:'week', charts:{},
  habits:[], habitLogs:{},
  selectedEmoji:'🐰', selectedColor:'#b07fff',
  selectedCalDate: null,
  theme: localStorage.getItem('rh-theme') || 'dark',
};

// ─── DATE UTILS ───────────────────────────────────────────
function tds(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function isToday(d){ return tds(d)===tds(state.today); }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function getWeekDates(off=0){
  const now=new Date(state.today), dow=now.getDay(), mon=new Date(now);
  mon.setDate(now.getDate()-(dow===0?6:dow-1)+off*7);
  return Array.from({length:7},(_,i)=>addDays(mon,i));
}
function getMonthDates(off=0){
  const base=new Date(state.today.getFullYear(),state.today.getMonth()+off,1);
  const days=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
  return Array.from({length:days},(_,i)=>new Date(base.getFullYear(),base.getMonth(),i+1));
}
const VI_DAYS=['CN','T2','T3','T4','T5','T6','T7'];
const VI_MONTHS=['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const PRIORITY_LABELS = ['','🔵 Thấp','🟡 Vừa','🔴 Cao'];
const PRIORITY_COLORS = ['','#5ee8f0','#ffcf5c','#ff6b8a'];

// ─── API ──────────────────────────────────────────────────
const API={
  g:(u)=>fetch(u,{credentials:'include'}).then(r=>{
    if(r.status===401){window.location.href='/auth.html';throw new Error('Unauthorized');}
    return r.json();
  }),
  p:(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b),credentials:'include'}).then(r=>{
    if(r.status===401){window.location.href='/auth.html';throw new Error('Unauthorized');}
    return r.json();
  }),
  pa:(u,b)=>fetch(u,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(b),credentials:'include'}).then(r=>{
    if(r.status===401){window.location.href='/auth.html';throw new Error('Unauthorized');}
    return r.json();
  }),
  d:(u)=>fetch(u,{method:'DELETE',credentials:'include'}),
};
const apiTasks={
  list:(s,e)=>API.g(`/api/tasks?startDate=${s}&endDate=${e}`),
  add:(t,d,p)=>API.p('/api/tasks',{title:t,date:d,priority:p||0}),
  toggle:(id)=>API.pa(`/api/tasks/${id}/toggle`,{}),
  del:(id)=>API.d(`/api/tasks/${id}`),
  upd:(id,fields)=>API.pa(`/api/tasks/${id}`,fields),
  stats:(s,e)=>API.g(`/api/tasks/stats?startDate=${s}&endDate=${e}`),
  streak:(t)=>API.g(`/api/tasks/streak?title=${encodeURIComponent(t)}`),
  globalStreak:()=>API.g('/api/tasks/global-streak'),
  heatmap:(s,e)=>API.g(`/api/tasks/heatmap?startDate=${s}&endDate=${e}`),
};
const apiJournal={
  get:(date)=>API.g(`/api/journal/${date}`),
  range:(s,e)=>API.g(`/api/journal/?startDate=${s}&endDate=${e}`),
  save:(date,mood,content)=>fetch(`/api/journal/${date}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({mood,content}),credentials:"include"}).then(r=>r.json()),
};
const apiHabits={
  list:()=>API.g("/api/habits"),
  add:(b)=>API.p("/api/habits",b),
  del:(id)=>API.d(`/api/habits/${id}`),
  logs:(s,e)=>API.g(`/api/habits/logs?startDate=${s}&endDate=${e}`),
  toggleLog:(hid,d)=>API.p("/api/habits/logs/toggle",{habitId:hid,date:d}),
  stats:(s,e)=>API.g(`/api/habits/stats?startDate=${s}&endDate=${e}`),
  analytics:()=>API.g("/api/habits/analytics"),
};

// ─── THEME ────────────────────────────────────────────────
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('rh-theme',t);
  state.theme=t;
  const btn=document.getElementById('theme-btn');
  if(btn) btn.textContent= t==='dark' ? '☀️' : '🌙';
}
function toggleTheme(){ applyTheme(state.theme==='dark'?'light':'dark'); }

// ─── CALENDAR ─────────────────────────────────────────────
function renderCalendar(){
  const vd=state.calViewDate, year=vd.getFullYear(), month=vd.getMonth();
  document.getElementById('cal-title').textContent=`${VI_MONTHS[month]} ${year}`;
  const firstDow=new Date(year,month,1).getDay();
  const off=firstDow===0?6:firstDow-1;
  const dInMo=new Date(year,month+1,0).getDate();
  const dInPrev=new Date(year,month,0).getDate();
  const weekStrs=new Set(getWeekDates(state.weekOffset).map(tds));
  const taskStrs=new Set(Object.keys(state.tasks).filter(k=>state.tasks[k]?.length>0));
  const grid=document.getElementById('cal-grid');
  grid.innerHTML='';
  for(let i=0;i<42;i++){
    let day,date;
    if(i<off){day=dInPrev-off+i+1;date=new Date(year,month-1,day);}
    else if(i>=off+dInMo){day=i-off-dInMo+1;date=new Date(year,month+1,day);}
    else{day=i-off+1;date=new Date(year,month,day);}
    const ds=tds(date);
    const cell=document.createElement('div');
    cell.className='cal-day';
    if(i<off||i>=off+dInMo) cell.classList.add('other-month');
    if(weekStrs.has(ds))    cell.classList.add('current-week');
    if(isToday(date))       cell.classList.add('today');
    if(taskStrs.has(ds))    cell.classList.add('has-tasks');
    if(state.selectedCalDate===ds) cell.classList.add('selected-day');
    cell.textContent=day;
    cell.addEventListener('click',()=>handleCalDayClick(new Date(date)));
    grid.appendChild(cell);
  }
  renderWeekMini(getWeekDates(state.weekOffset));
}

// Toggle selection: click same day again → deselect and go to today
function handleCalDayClick(date){
  const ds=tds(date);
  if(state.selectedCalDate===ds){
    // Deselect — jump back to today's week
    state.selectedCalDate=null;
    state.weekOffset=0; state.viewMode='week';
    document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='week'));
    loadAndRender();
    return;
  }
  jumpToDate(date);
}

function jumpToDate(date){
  state.selectedCalDate=tds(date);
  const todayDow=state.today.getDay();
  const todayMon=addDays(state.today,-(todayDow===0?6:todayDow-1));
  const dateDow=date.getDay();
  const dateMon=addDays(date,-(dateDow===0?6:dateDow-1));
  const diffW=Math.round((dateMon-todayMon)/(7*86400000));
  state.viewMode='week'; state.weekOffset=diffW;
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='week'));
  renderCalendar();
  loadAndRender().then(()=>{
    scrollToDate(tds(date));
    renderCalendar();
    // Close sheet on mobile
    if(window.innerWidth<=768){
      const sb=document.getElementById('sidebar');
      const ov=document.getElementById('sidebar-overlay');
      if(sb?.classList.contains('open')){
        sb.classList.remove('open'); ov?.classList.remove('show');
        document.body.style.overflow='';
        const tog=document.getElementById('sidebar-toggle');
        if(tog) tog.textContent='🗓 Lịch & Thói quen';
      }
    }
  });
}

function renderWeekMini(wd){
  const wrap=document.getElementById('week-days-mini'); wrap.innerHTML='';
  wd.forEach(d=>{
    const ds=tds(d), tasks=state.tasks[ds]||[];
    const total=tasks.length, done=tasks.filter(t=>t.completed).length;
    const pct=total>0?Math.round((done/total)*100):0;
    const item=document.createElement('div'); item.className='wday-mini';
    const lbl=document.createElement('div'); lbl.className='wday-mini-label'; lbl.textContent=VI_DAYS[d.getDay()];
    const circle=document.createElement('div'); circle.className='wday-mini-circle';
    if(isToday(d)) circle.classList.add('today-circle');
    else if(total>0&&done===total) circle.classList.add('done');
    else if(done>0) circle.classList.add('partial');
    circle.textContent=total>0?pct+'%':d.getDate();
    circle.title=`${done}/${total} tasks`;
    circle.addEventListener('click',()=>handleCalDayClick(d));
    item.append(lbl,circle); wrap.appendChild(item);
  });
}

// ─── SCROLLBAR ────────────────────────────────────────────
function getViewport(){ return document.getElementById('columns-viewport'); }
function scrollToDate(ds){
  const vp=getViewport(), col=vp?.querySelector(`.day-column[data-date="${ds}"]`);
  if(!col||!vp) return;
  vp.scrollLeft=Math.max(0,col.offsetLeft-(vp.clientWidth/2)+(col.offsetWidth/2));
  updateScrollbar();
}
function scrollToToday(){ scrollToDate(tds(state.today)); }
function scrollByCol(dir){
  const vp=getViewport(); if(!vp) return;
  const colW=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-w'))||220;
  vp.scrollLeft+=dir*(colW+10); updateScrollbar();
}
function updateScrollbar(){
  const vp=getViewport(), thumb=document.getElementById('shb-thumb');
  const track=document.querySelector('.shb-track');
  if(!vp||!thumb||!track) return;
  const maxS=vp.scrollWidth-vp.clientWidth;
  if(maxS<=0){thumb.style.width='100%';thumb.style.left='0';return;}
  const pct=vp.scrollLeft/maxS;
  const trackW=track.clientWidth;
  const thumbW=Math.max(40,(vp.clientWidth/vp.scrollWidth)*trackW);
  thumb.style.width=thumbW+'px';
  thumb.style.left=(pct*(trackW-thumbW))+'px';
}
function initScrollbarDrag(){
  const thumb=document.getElementById('shb-thumb');
  const track=document.querySelector('.shb-track');
  if(!thumb||!track) return;
  let drag=false, startX=0, startL=0;
  const startDrag=x=>{drag=true;startX=x;startL=parseFloat(thumb.style.left)||0;};
  const moveDrag=x=>{
    if(!drag) return;
    const vp=getViewport(), trackW=track.clientWidth, thumbW=thumb.offsetWidth;
    const maxL=trackW-thumbW, newL=Math.max(0,Math.min(maxL,startL+(x-startX)));
    thumb.style.left=newL+'px'; vp.scrollLeft=(newL/maxL)*(vp.scrollWidth-vp.clientWidth);
  };
  const endDrag=()=>{drag=false;};
  thumb.addEventListener('mousedown',e=>{startDrag(e.clientX);e.preventDefault();});
  window.addEventListener('mousemove',e=>{if(drag)moveDrag(e.clientX);});
  window.addEventListener('mouseup',endDrag);
  thumb.addEventListener('touchstart',e=>{startDrag(e.touches[0].clientX);},{passive:true});
  window.addEventListener('touchmove',e=>{if(drag)moveDrag(e.touches[0].clientX);},{passive:true});
  window.addEventListener('touchend',endDrag);
  track.addEventListener('click',e=>{
    if(e.target===thumb) return;
    const vp=getViewport(), rect=track.getBoundingClientRect();
    vp.scrollLeft=((e.clientX-rect.left)/rect.width)*(vp.scrollWidth-vp.clientWidth);
    updateScrollbar();
  });
}
function initViewportScroll(){
  getViewport()?.addEventListener('scroll',updateScrollbar,{passive:true});
}

// ─── LOAD & RENDER COLUMNS ────────────────────────────────
async function loadAndRender(){
  const dates=state.viewMode==='week'?getWeekDates(state.weekOffset):getMonthDates(state.monthOffset);
  updateNavLabel(dates);
  const s=tds(dates[0]), e=tds(dates[dates.length-1]);
  const tasks=await apiTasks.list(s,e);
  state.tasks={};
  tasks.forEach(t=>{if(!state.tasks[t.date])state.tasks[t.date]=[];state.tasks[t.date].push(t);});
  renderColumns(dates); renderCalendar(); loadStats();
  requestAnimationFrame(()=>requestAnimationFrame(()=>scrollToToday()));
}
function updateNavLabel(dates){
  const lbl=document.getElementById('nav-label');
  if(state.viewMode==='week'){const s=dates[0],e=dates[6];lbl.textContent=`${s.getDate()}/${s.getMonth()+1} – ${e.getDate()}/${e.getMonth()+1}/${e.getFullYear()}`;}
  else lbl.textContent=`Tháng ${dates[0].getMonth()+1}, ${dates[0].getFullYear()}`;
}
function renderColumns(dates){
  const row=document.getElementById('columns-row');
  row.innerHTML='';
  dates.forEach(date=>row.appendChild(createDayColumn(date)));
  updateScrollbar();
}

// Priority ring colors for donut
const PRIO_DONUT=['#b07fff','#5ee8f0','#ffcf5c','#ff6b8a'];

function createDayColumn(date){
  const ds=tds(date);
  const rawTasks=state.tasks[ds]||[];
  // Sort by priority desc (already done by server, but keep for safety)
  const tasks=[...rawTasks].sort((a,b)=>(b.priority||0)-(a.priority||0));
  const total=tasks.length, done=tasks.filter(t=>t.completed).length;
  const pct=total>0?Math.round((done/total)*100):0, rem=total-done;
  let badgeCls='dsb-empty',badgeTxt='Chưa có task';
  if(pct===100&&total>0){badgeCls='dsb-done';badgeTxt='✓ Hoàn tất';}
  else if(done>0){badgeCls='dsb-progress';badgeTxt=`${rem} còn lại`;}
  else if(total>0){badgeCls='dsb-empty';badgeTxt=`0/${total}`;}
  const donutColor=pct===100?'#5ef0a0':pct>=60?'#ffcf5c':'#b07fff';
  const circ=2*Math.PI*34, fill=(pct/100)*circ;
  const isSelected=state.selectedCalDate===ds&&!isToday(date);
  const col=document.createElement('div');
  col.className='day-column'+(isToday(date)?' is-today':'')+(isSelected?' is-selected':'');
  col.dataset.date=ds;
  col.innerHTML=`
    <div class="day-header">
      <div class="day-weekday">${VI_DAYS[date.getDay()]}</div>
      <div class="day-date-num">${date.getDate()}</div>
      <div class="day-month-year">${VI_MONTHS[date.getMonth()]} ${date.getFullYear()}</div>
      <div class="day-status-badge ${badgeCls}">${badgeTxt}</div>
    </div>
    <div class="big-donut-wrap">
      <div class="donut-container">
        <svg class="donut-svg" viewBox="0 0 80 80">
          <circle class="donut-bg-circle" cx="40" cy="40" r="34"/>
          <circle class="donut-fill-circle" cx="40" cy="40" r="34" stroke="${donutColor}"
            stroke-dasharray="${fill.toFixed(2)} ${circ.toFixed(2)}"/>
        </svg>
        <div class="donut-center-text">
          <div class="donut-pct">${pct}%</div>
          <div class="donut-label">done</div>
        </div>
      </div>
      <div class="donut-side-stats">
        <div class="donut-stat-item"><div class="dsi-label">Xong</div><div class="dsi-value v-done">${done}</div></div>
        <div class="donut-stat-item"><div class="dsi-label">Tổng</div><div class="dsi-value v-total">${total}</div></div>
        <div class="donut-stat-item"><div class="dsi-label">Còn</div><div class="dsi-value v-left">${rem}</div></div>
      </div>
    </div>
    <div class="tasks-list" id="tasks-${ds}"></div>
    <div class="add-task-area">
      <!-- Row 1: input + add button -->
      <div class="add-task-input-row">
        <input class="add-task-input" type="text" placeholder="Thêm task mới..." autocomplete="off"/>
        <button class="add-task-btn" title="Thêm (Enter)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <!-- Row 2: priority pills -->
      <div class="priority-row">
        <span class="prio-label">Ưu tiên:</span>
        <div class="prio-pills">
          <button class="prio-pill active" data-p="0">Không</button>
          <button class="prio-pill prio-pill-low" data-p="1">🔵 Thấp</button>
          <button class="prio-pill prio-pill-med" data-p="2">🟡 Vừa</button>
          <button class="prio-pill prio-pill-high" data-p="3">🔴 Cao</button>
        </div>
      </div>
    </div>`;

  const list=col.querySelector('.tasks-list');
  if(!tasks.length){
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">🌸</div>Chưa có task</div>`;
  } else {
    tasks.forEach(t=>list.appendChild(mkTaskItem(t)));
  }

  // Priority picker state
  let selPrio=0;
  col.querySelectorAll('.prio-pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      selPrio=parseInt(btn.dataset.p);
      col.querySelectorAll('.prio-pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const inp=col.querySelector('.add-task-input');
  col.querySelector('.add-task-btn').addEventListener('click',()=>addTask(ds,inp,selPrio));
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')addTask(ds,inp,selPrio);});
  return col;
}

function refreshDonut(ds){
  const col=document.querySelector(`.day-column[data-date="${ds}"]`); if(!col) return;
  const tasks=state.tasks[ds]||[];
  const total=tasks.length,done=tasks.filter(t=>t.completed).length;
  const pct=total>0?Math.round((done/total)*100):0,rem=total-done;
  const circ=2*Math.PI*34,fill=(pct/100)*circ;
  const donutColor=pct===100?'#5ef0a0':pct>=60?'#ffcf5c':'#b07fff';
  const fc=col.querySelector('.donut-fill-circle');
  if(fc){fc.setAttribute('stroke',donutColor);fc.setAttribute('stroke-dasharray',`${fill.toFixed(2)} ${circ.toFixed(2)}`);}
  const pe=col.querySelector('.donut-pct'); if(pe) pe.textContent=pct+'%';
  const vs=col.querySelectorAll('.dsi-value');
  if(vs[0])vs[0].textContent=done; if(vs[1])vs[1].textContent=total; if(vs[2])vs[2].textContent=rem;
  let bc='dsb-empty',bt='Chưa có task';
  if(pct===100&&total>0){bc='dsb-done';bt='✓ Hoàn tất';}
  else if(done>0){bc='dsb-progress';bt=`${rem} còn lại`;}
  else if(total>0){bc='dsb-empty';bt=`0/${total}`;}
  const b=col.querySelector('.day-status-badge'); if(b){b.className=`day-status-badge ${bc}`;b.textContent=bt;}
  loadStats();
}

// ─── TASK ITEM ────────────────────────────────────────────
function mkTaskItem(task){
  const p=task.priority||0;
  const item=document.createElement('div');
  item.className='task-item'+(task.completed?' completed':'')+(p>0?` prio-${p}`:'');
  item.dataset.id=task._id;
  const prioIndicator=p>0?`<div class="task-prio-dot" style="background:${PRIORITY_COLORS[p]}" title="${PRIORITY_LABELS[p]}"></div>`:'';
  item.innerHTML=`
    ${prioIndicator}
    <div class="task-checkbox"><div class="task-checkbox-check"></div></div>
    <span class="task-title">${esc(task.title)}</span>
    <div class="task-actions">
      <div class="task-prio-menu">
        <button class="task-prio-toggle" title="Đổi ưu tiên">${p>0?PRIORITY_COLORS[p].slice(0,2):'…'}</button>
        <div class="task-prio-dropdown">
          <div class="tpd-item" data-p="0">— Không</div>
          <div class="tpd-item" data-p="1" style="color:#5ee8f0">🔵 Thấp</div>
          <div class="tpd-item" data-p="2" style="color:#ffcf5c">🟡 Vừa</div>
          <div class="tpd-item" data-p="3" style="color:#ff6b8a">🔴 Cao</div>
        </div>
      </div>
      <button class="task-delete">✕</button>
    </div>`;

  item.querySelector('.task-checkbox').addEventListener('click',()=>toggleTask(task._id,item));
  item.querySelector('.task-delete').addEventListener('click',()=>deleteTask(task._id,item));

  // Priority dropdown
  const menu=item.querySelector('.task-prio-menu');
  const toggle=item.querySelector('.task-prio-toggle');
  const dropdown=item.querySelector('.task-prio-dropdown');
  toggle.addEventListener('click',e=>{e.stopPropagation();dropdown.classList.toggle('open');});
  dropdown.querySelectorAll('.tpd-item').forEach(opt=>{
    opt.addEventListener('click',async e=>{
      e.stopPropagation();
      const np=parseInt(opt.dataset.p);
      await apiTasks.upd(task._id,{priority:np});
      task.priority=np;
      dropdown.classList.remove('open');
      // Re-render this day column
      const ds=item.closest('.day-column')?.dataset.date;
      if(ds){
        // Update task in state
        const idx=state.tasks[ds]?.findIndex(t=>t._id===task._id);
        if(idx!==-undefined&&idx>-1) state.tasks[ds][idx].priority=np;
        state.tasks[ds]=[...state.tasks[ds]].sort((a,b)=>(b.priority||0)-(a.priority||0));
        const list=document.getElementById(`tasks-${ds}`);
        if(list){ list.innerHTML=''; state.tasks[ds].forEach(t=>list.appendChild(mkTaskItem(t))); }
        refreshDonut(ds);
      }
    });
  });
  document.addEventListener('click',()=>dropdown.classList.remove('open'));

  // Edit on dblclick
  const te=item.querySelector('.task-title');
  te.addEventListener('dblclick',()=>{
    te.contentEditable='true';te.focus();
    const r=document.createRange();r.selectNodeContents(te);
    window.getSelection().removeAllRanges();window.getSelection().addRange(r);
  });
  te.addEventListener('blur',async()=>{
    te.contentEditable='false';
    const nv=te.textContent.trim();
    if(nv&&nv!==task.title){await apiTasks.upd(task._id,{title:nv});task.title=nv;toast('✎ Đã cập nhật');}
    else te.textContent=task.title;
  });
  te.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();te.blur();}
    if(e.key==='Escape'){te.textContent=task.title;te.blur();}
  });
  return item;
}

async function addTask(ds,inp,prio=0){
  const title=inp.value.trim(); if(!title) return;
  inp.value='';
  const task=await apiTasks.add(title,ds,prio);
  if(!state.tasks[ds]) state.tasks[ds]=[];
  state.tasks[ds].push(task);
  // Re-sort by priority
  state.tasks[ds].sort((a,b)=>(b.priority||0)-(a.priority||0));
  const list=document.getElementById(`tasks-${ds}`);
  list.querySelector('.empty-state')?.remove();
  list.innerHTML=''; state.tasks[ds].forEach(t=>list.appendChild(mkTaskItem(t)));
  refreshDonut(ds); renderCalendar(); toast('✓ Đã thêm task');
}
async function toggleTask(id,itemEl){
  const task=await apiTasks.toggle(id);
  itemEl.classList.toggle('completed',task.completed);
  const ds=itemEl.closest('.day-column').dataset.date;
  const t=state.tasks[ds]?.find(t=>t._id===id); if(t) t.completed=task.completed;
  refreshDonut(ds); renderCalendar();
  if(task.completed){
    const pts = task.pointsAwarded || 5;
    toast(`🌸 Task hoàn thành! +${pts}⭐`);
    showPointsToast(pts);
    updatePointsUI((_shopData.points||0) + pts);
    const intensity = task.priority >= 3 ? 'high' : task.priority >= 2 ? 'medium' : 'low';
    launchConfetti(intensity);
    setTimeout(() => showMotivationOverlay(), 600);
    checkAndAwardBadges();
  } else {
    const pts = task.pointsDeducted || 5;
    toast(`↩️ Đã bỏ tích — trừ ${pts}⭐`);
    updatePointsUI(Math.max(0, (_shopData.points||0) - pts));
  }
}
async function deleteTask(id,itemEl){
  await apiTasks.del(id);
  const ds=itemEl.closest('.day-column').dataset.date;
  state.tasks[ds]=state.tasks[ds]?.filter(t=>t._id!==id)||[];
  itemEl.style.cssText='opacity:0;transform:translateX(-7px);transition:opacity .2s,transform .2s';
  setTimeout(()=>{
    itemEl.remove();
    const list=document.getElementById(`tasks-${ds}`);
    if(list&&!list.children.length)
      list.innerHTML=`<div class="empty-state"><div class="empty-icon">🌸</div>Chưa có task</div>`;
    refreshDonut(ds);
  },200);
  renderCalendar();
}

// ─── STATS ────────────────────────────────────────────────
function statsRange(){
  const now=state.today;
  if(state.statsMode==='week'){const d=getWeekDates(state.weekOffset);return{s:tds(d[0]),e:tds(d[6])};}
  else if(state.statsMode==='month'){
    return{s:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,
           e:tds(new Date(now.getFullYear(),now.getMonth()+1,0))};
  }
  return{s:`${now.getFullYear()}-01-01`,e:`${now.getFullYear()}-12-31`};
}
async function loadStats(){
  const {s,e}=statsRange();
  const [stats,globalStreak]=await Promise.all([apiTasks.stats(s,e),apiTasks.globalStreak()]);
  await renderStats(stats,s,e,globalStreak);
  // Monthly charts
  loadMonthlyCharts();
  // Weekly emotion stats
  loadEmotionStats();
  // Monthly emotion chart
  loadMonthlyEmotionChart();
}

async function loadMonthlyCharts() {
  try {
    const now = state.today;
    // Current month
    const cms = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const cme = tds(new Date(now.getFullYear(), now.getMonth()+1, 0));
    // Previous month
    const pm = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const pms = tds(pm);
    const pme = tds(new Date(pm.getFullYear(), pm.getMonth()+1, 0));

    document.getElementById('chart-month-label').textContent = VI_MONTHS[now.getMonth()] + ' ' + now.getFullYear();
    document.getElementById('chart-prevmonth-label').textContent = VI_MONTHS[pm.getMonth()] + ' ' + pm.getFullYear();

    const [cmStats, pmStats] = await Promise.all([apiTasks.stats(cms, cme), apiTasks.stats(pms, pme)]);

    // Current month daily chart
    const cmLabels = [], cmData = [];
    for (let d = new Date(cms); tds(d) <= cme; d.setDate(d.getDate()+1)) {
      const ds = tds(new Date(d)), bd = cmStats.byDate[ds];
      cmLabels.push(new Date(d).getDate() + '');
      cmData.push(bd && bd.total > 0 ? Math.round((bd.completed/bd.total)*100) : 0);
    }
    mkLineChart('chart-monthly', cmLabels, cmData);

    // Previous month
    const pmLabels = [], pmData = [];
    for (let d = new Date(pms); tds(d) <= pme; d.setDate(d.getDate()+1)) {
      const ds = tds(new Date(d)), bd = pmStats.byDate[ds];
      pmLabels.push(new Date(d).getDate() + '');
      pmData.push(bd && bd.total > 0 ? Math.round((bd.completed/bd.total)*100) : 0);
    }
    mkLineChart('chart-prevmonthly', pmLabels, pmData);
  } catch(e) { console.error('loadMonthlyCharts:', e); }
}

async function loadEmotionStats() {
  try {
    const wrap = document.getElementById('emotion-week-wrap');
    if (!wrap) return;
    // Get last 7 days of journal entries
    const end = tds(state.today);
    const start = tds(addDays(state.today, -6));
    const entries = await apiJournal.range(start, end);

    if (!entries || !entries.length) {
      wrap.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:12px;padding:20px">Chưa có nhật ký nào trong tuần. Hãy viết nhật ký mỗi ngày nhé!</div>';
      return;
    }

    // Count moods
    const moodCounts = {};
    entries.forEach(e => { if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1; });
    const totalEntries = entries.filter(e => e.mood).length;

    const MOOD_INFO = {
      '🌸': { label: 'Tuyệt vời', color: '#ff85c8' },
      '😊': { label: 'Vui vẻ', color: '#ffcf5c' },
      '😌': { label: 'Bình thường', color: '#b07fff' },
      '😴': { label: 'Mệt mỏi', color: '#5ee8f0' },
      '😤': { label: 'Căng thẳng', color: '#ff9900' },
      '😢': { label: 'Buồn', color: '#7cb9ff' },
    };

    wrap.innerHTML = '';
    // Sort by count desc
    const sorted = Object.entries(moodCounts).sort((a,b) => b[1] - a[1]);
    sorted.forEach(([mood, count]) => {
      const info = MOOD_INFO[mood] || { label: mood, color: '#b07fff' };
      const pct = Math.round((count / 7) * 100);
      const bar = document.createElement('div');
      bar.className = 'emotion-bar';
      bar.innerHTML = `
        <div class="emotion-bar-emoji">${mood}</div>
        <div class="emotion-bar-label">${info.label}</div>
        <div class="emotion-bar-track">
          <div class="emotion-bar-fill" style="width:${pct}%;background:${info.color}"></div>
        </div>
        <div class="emotion-bar-count">${count}/${7}</div>
      `;
      wrap.appendChild(bar);
    });

    // Add summary text
    if (sorted.length > 0) {
      const topMood = MOOD_INFO[sorted[0][0]]?.label || sorted[0][0];
      const summary = document.createElement('div');
      summary.style.cssText = 'margin-top:10px;font-size:12px;color:var(--text2);text-align:center;';
      summary.textContent = `Tuần qua bạn chủ yếu cảm thấy: ${sorted[0][0]} ${topMood} (${sorted[0][1]}/${totalEntries} ngày)`;
      wrap.appendChild(summary);
    }
  } catch(e) { console.error('loadEmotionStats:', e); }
}

async function loadMonthlyEmotionChart() {
  try {
    const end = tds(state.today);
    const start = tds(addDays(state.today, -29));
    const entries = await apiJournal.range(start, end);

    const MOOD_INFO = {
      '🌸': { label: 'Tuyệt vời', color: '#ff85c8' },
      '😊': { label: 'Vui vẻ', color: '#ffcf5c' },
      '😌': { label: 'Bình thường', color: '#b07fff' },
      '😴': { label: 'Mệt mỏi', color: '#5ee8f0' },
      '😤': { label: 'Căng thẳng', color: '#ff9900' },
      '😢': { label: 'Buồn', color: '#7cb9ff' },
    };
    const MOOD_ORDER = ['🌸','😊','😌','😴','😤','😢'];

    // Build daily mood map
    const moodByDate = {};
    if (entries?.length) {
      entries.forEach(e => { if (e.mood && e.date) moodByDate[e.date.slice(0,10)] = e.mood; });
    }

    // Build labels and per-mood datasets
    const labels = [];
    const moodData = {};
    MOOD_ORDER.forEach(m => { moodData[m] = []; });

    for (let i = 0; i < 30; i++) {
      const d = addDays(state.today, -29 + i);
      const ds = tds(d);
      labels.push(d.getDate() + '/' + (d.getMonth()+1));
      const mood = moodByDate[ds];
      MOOD_ORDER.forEach(m => {
        moodData[m].push(mood === m ? 1 : 0);
      });
    }

    // Stacked bar chart
    const ctx = document.getElementById('chart-emotion-month')?.getContext('2d');
    if (!ctx) return;
    if (state.charts['emotion-month']) state.charts['emotion-month'].destroy();
    const c = chartColors();

    const datasets = MOOD_ORDER.map(m => ({
      label: MOOD_INFO[m].label,
      data: moodData[m],
      backgroundColor: MOOD_INFO[m].color + 'cc',
      borderColor: MOOD_INFO[m].color,
      borderWidth: 1,
      borderRadius: 4,
    }));

    state.charts['emotion-month'] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: c.tick, font: { size: 10 }, boxWidth: 12 } },
          tooltip: {
            backgroundColor: '#1f2030', borderColor: '#2e3150', borderWidth: 1,
            titleColor: '#ecedf5', bodyColor: '#8b8fa8',
            callbacks: {
              label: ct => ct.parsed.y > 0 ? ` ${ct.dataset.label}` : null
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: c.tick, font: { size: 9 }, maxRotation: 45 } },
          y: { stacked: true, display: false, max: 1 }
        }
      }
    });

    // Summary
    const summary = document.getElementById('emotion-month-summary');
    if (summary) {
      const moodCounts = {};
      Object.values(moodByDate).forEach(m => { moodCounts[m] = (moodCounts[m] || 0) + 1; });
      const total = Object.values(moodCounts).reduce((a,b) => a+b, 0);
      const sorted = Object.entries(moodCounts).sort((a,b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const topMood = sorted[0][0];
        const info = MOOD_INFO[topMood];
        summary.innerHTML = `Tháng qua bạn ghi nhật ký <b>${total}/30</b> ngày · Cảm xúc chủ đạo: ${topMood} <span style="color:${info?.color||'var(--text2)'}">${info?.label||''}</span> (${sorted[0][1]} ngày)`;
      } else {
        summary.textContent = 'Chưa có nhật ký nào trong tháng. Hãy viết nhật ký mỗi ngày nhé!';
      }
    }
  } catch(e) { console.error('loadMonthlyEmotionChart:', e); }
}

async function renderStats(stats,s,e,globalStreak){
  document.getElementById('stat-total').textContent=stats.overall.total;
  document.getElementById('stat-done').textContent=stats.overall.completed;
  document.getElementById('stat-rate').textContent=stats.overall.rate+'%';
  // Global streak
  const gs=globalStreak?.currentStreak||0, gm=globalStreak?.maxStreak||0;
  document.getElementById('stat-streak').textContent=(gs>0?gs:gm);
  const gsBadge = document.getElementById('global-streak-badge');
  if(gs>=3 && gsBadge){
    gsBadge.style.display='flex';
    const gsText = document.getElementById('global-streak-text');
    if(gsText) gsText.textContent=`🔥 ${gs} ngày liên tiếp`;
  }
  const labels=[],rateData=[];
  for(let d=new Date(s);tds(d)<=e;d.setDate(d.getDate()+1)){
    const ds=tds(new Date(d)),bd=stats.byDate[ds];
    labels.push(`${new Date(d).getDate()}/${new Date(d).getMonth()+1}`);
    rateData.push(bd&&bd.total>0?Math.round((bd.completed/bd.total)*100):0);
  }
  document.getElementById('chart-period-label').textContent=`${s.split('-').reverse().join('/')} – ${e.split('-').reverse().join('/')}`;
  mkLineChart('chart-daily',labels,rateData);
  mkOverviewChart(stats.overall.total, stats.overall.completed, stats.overall.total - stats.overall.completed);
  // Top tasks with streaks — new card layout
  const tbody=document.getElementById('top-tasks-body'); tbody.innerHTML='';
  if(!stats.topTasks?.length){
    tbody.innerHTML=`<div class="empty-state" style="padding:24px"><div class="empty-icon">🐰</div>Chưa có dữ liệu</div>`;
    return;
  }
  const maxT=stats.topTasks[0]?.total||1;
  for(let i=0;i<stats.topTasks.length;i++){
    const t=stats.topTasks[i];
    const rate=Math.round((t.completed/t.total)*100);
    const freqW=Math.round((t.total/maxT)*100);
    const rc=rate>=80?'var(--green)':rate>=50?'var(--amber)':'var(--red)';
    let sd={currentStreak:0,maxStreak:0};
    try{sd=await apiTasks.streak(t.title);}catch(_){}
    const card=document.createElement('div');
    card.className='ttc';
    card.innerHTML=`
      <div class="ttc-top">
        <div class="ttc-rank">${i+1}</div>
        <div class="ttc-name" title="${esc(t.title)}">${esc(t.title)}</div>
        <div class="ttc-meta">
          <span class="ttc-count">${t.total}×</span>
          <span class="ttc-fire">${streakFlames(sd.currentStreak||0)}</span>
        </div>
      </div>
      <div class="ttc-freq-row">
        <div class="ttc-freq-bar-wrap">
          <div class="ttc-freq-bar" style="width:${freqW}%"></div>
        </div>
      </div>
      <div class="ttc-streak-row">
        <span class="ttc-streak-label">STREAK</span>
        ${buildFireBar(sd)}
      </div>`;
    tbody.appendChild(card);
  }
}

// Streak flames: more flames for longer streaks (max 31)
function streakFlames(n) {
  if (n <= 0) return '<span style="color:var(--text3);font-size:12px">—</span>';
  // 1-3: 🔥, 4-7: 🔥🔥, 8-14: 🔥🔥🔥, 15-21: 🔥🔥🔥🔥, 22-30: 🔥🔥🔥🔥🔥, 31: 🔥🔥🔥🔥🔥🔥
  const flames = n >= 31 ? 6 : n >= 22 ? 5 : n >= 15 ? 4 : n >= 8 ? 3 : n >= 4 ? 2 : 1;
  const size = Math.min(20, 12 + Math.floor(n / 5) * 2);
  return `<span style="font-size:${size}px;filter:brightness(${1 + n/40})" title="${n} ngày streak">${'🔥'.repeat(flames)}</span>`;
}

// Build the big horizontal fire streak bar
function buildFireBar(sd){
  const cur = sd.currentStreak || 0;
  const max = sd.maxStreak    || 0;
  const alive = cur > 0;
  const n = alive ? cur : max;

  if(n === 0) return `<div class="fire-bar-wrap fire-bar-empty">
    <div class="fire-bar-track"><div class="fire-bar-fill" style="width:0%"></div></div>
    <span class="fire-bar-label fire-bar-none">Chưa có</span>
  </div>`;

  // pct = n/31, fill width
  const pct = Math.min(100, Math.round((n / 31) * 100));

  // Color stops: 1 day = pale yellow, 31 days = deep red
  // We interpolate 5 color zones
  const stops = getFireStops(n);

  // Glow intensity grows with n
  const glowAlpha = Math.min(0.7, 0.15 + (n/31) * 0.55);
  const glowColor = stops.glow;

  return `<div class="fire-bar-wrap ${alive?'fire-bar-alive':'fire-bar-dead'}">
    <div class="fire-bar-track" title="${alive?`Đang cháy ${n} ngày`:`Đã tắt — max ${n} ngày`}">
      <div class="fire-bar-fill" style="
        width:${pct}%;
        background: linear-gradient(90deg, ${stops.left}, ${stops.mid} 50%, ${stops.right});
        box-shadow: ${alive ? `0 0 ${4 + Math.round(n/31*14)}px ${glowAlpha > 0.4 ? Math.round(glowAlpha*12) : 4}px ${glowColor}` : 'none'};
        opacity: ${alive ? 1 : 0.45};
      "></div>
    </div>
    <span class="fire-bar-label" style="color:${stops.right};opacity:${alive?1:0.55}">
      ${n} ngày
    </span>
  </div>`;
}

function getFireStops(n){
  // n: 1-31
  // Returns gradient stops and glow color
  if(n >= 28) return { left:'#ff0000', mid:'#ff4400', right:'#ff8800', glow:'rgba(255,60,0,.7)' };
  if(n >= 21) return { left:'#ff2200', mid:'#ff6600', right:'#ffaa00', glow:'rgba(255,80,0,.6)' };
  if(n >= 14) return { left:'#ff5500', mid:'#ff8800', right:'#ffcc00', glow:'rgba(255,120,0,.5)' };
  if(n >= 7)  return { left:'#ff7700', mid:'#ffaa00', right:'#ffe044', glow:'rgba(255,160,0,.4)' };
  if(n >= 3)  return { left:'#ffaa00', mid:'#ffcc44', right:'#ffee88', glow:'rgba(255,200,0,.3)' };
                return { left:'#ffcc44', mid:'#ffee88', right:'#fffacc', glow:'rgba(255,230,100,.2)' };
}

function getFlameEmoji(n){ return ''; } // kept for compat, unused

function getFlameEmoji(n){
  // Returns an SVG flame that scales with streak length
  // capped visual at 30
  const capped = Math.min(n, 30);
  const pct    = capped / 30; // 0→1

  // Interpolate orange→red color and size
  // 3-6: small cool flame; 7-14: medium; 15-29: large; 30: max blazing
  if(n === 0) return '';

  // Pick color ramp
  let color1, color2;
  if(n >= 30)      { color1 = '#ff2200'; color2 = '#ff8800'; } // blazing red-orange
  else if(n >= 14) { color1 = '#ff5500'; color2 = '#ffaa00'; } // hot orange
  else if(n >= 7)  { color1 = '#ff7700'; color2 = '#ffcc00'; } // orange-yellow
  else             { color1 = '#ff9900'; color2 = '#ffee44'; } // warm yellow

  // Scale flame size: 12px (3 days) → 22px (30 days)
  const size = Math.round(12 + pct * 10);

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;vertical-align:middle">
    <defs><linearGradient id="fg${n}" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${color2}"/>
      <stop offset="100%" stop-color="${color1}"/>
    </linearGradient></defs>
    <path d="M12 2C12 2 7 8 7 13C7 15.76 9.24 18 12 18C14.76 18 17 15.76 17 13C17 8 12 2 12 2Z
             M12 22C10.34 22 9 20.66 9 19C9 17.5 10 16.5 12 15C14 16.5 15 17.5 15 19C15 20.66 13.66 22 12 22Z"
      fill="url(#fg${n})"/>
  </svg>`;
}

function renderStreakBadge(sd){
  const cur = sd.currentStreak || 0, max = sd.maxStreak || 0;
  if(cur === 0 && max === 0) return `<div class="streak-bar-wrap streak-zero"><span class="streak-num">—</span></div>`;

  const alive = cur > 0;
  const n     = alive ? cur : max;
  // Fill % capped at 30 days = 100%
  const pct   = Math.min(100, Math.round((n / 30) * 100));

  // Color ramp: cool yellow → hot orange → red blazing
  let gradStart, gradEnd, glowColor;
  if(n >= 30)       { gradStart='#ff1a00'; gradEnd='#ff9900'; glowColor='rgba(255,60,0,.55)'; }
  else if(n >= 20)  { gradStart='#ff3300'; gradEnd='#ffaa00'; glowColor='rgba(255,80,0,.4)'; }
  else if(n >= 14)  { gradStart='#ff5500'; gradEnd='#ffcc00'; glowColor='rgba(255,100,0,.3)'; }
  else if(n >= 7)   { gradStart='#ff7700'; gradEnd='#ffe066'; glowColor='rgba(255,140,0,.25)'; }
  else              { gradStart='#ffaa00'; gradEnd='#fff0a0'; glowColor='rgba(255,180,0,.2)'; }

  const label = alive ? `${n} ngày` : `${n}`;
  const title = alive
    ? `🔥 Đang cháy ${n} ngày liên tiếp — Max: ${max}`
    : `Đã tắt — Max: ${max} ngày`;

  return `<div class="streak-bar-wrap ${alive?'streak-alive':'streak-dead-bar'}" title="${title}">
    <div class="streak-bar-track">
      <div class="streak-bar-fill" style="
        width:${pct}%;
        background:linear-gradient(90deg,${gradStart},${gradEnd});
        box-shadow:${alive?`0 0 8px ${glowColor}`:'none'};
      "></div>
    </div>
    <span class="streak-num" style="color:${alive?gradEnd:'var(--text3)'}">${label}</span>
  </div>`;
}

// ─── CHARTS ───────────────────────────────────────────────
function chartColors(){
  return {
    grid: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim()||'rgba(34,36,53,.8)',
    tick: getComputedStyle(document.documentElement).getPropertyValue('--chart-tick').trim()||'#4a4d65',
    tooltip_bg:'#1f2030', tooltip_border:'#2e3150',
  };
}
function mkLineChart(id,labels,data){
  const ctx=document.getElementById(id)?.getContext('2d'); if(!ctx) return;
  if(state.charts[id]) state.charts[id].destroy();
  const c=chartColors();
  state.charts[id]=new Chart(ctx,{type:'line',
    data:{labels,datasets:[{label:'%',data,borderColor:'#b07fff',backgroundColor:'rgba(176,127,255,.08)',
      borderWidth:2,pointBackgroundColor:'#b07fff',pointRadius:3,pointHoverRadius:5,fill:true,tension:.4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:c.tooltip_bg,borderColor:c.tooltip_border,borderWidth:1,
        titleColor:'#ecedf5',bodyColor:'#8b8fa8',callbacks:{label:ct=>` ${ct.parsed.y}%`}}},
      scales:{x:{grid:{color:c.grid},ticks:{color:c.tick,font:{size:10}}},
              y:{min:0,max:100,grid:{color:c.grid},ticks:{color:c.tick,font:{size:10},callback:v=>v+'%'}}}}});
}
function mkOverviewChart(total, done, rem){
  const ctx = document.getElementById('chart-overview')?.getContext('2d');
  if(!ctx) return;
  if(state.charts.overview) state.charts.overview.destroy();
  const c = chartColors();
  state.charts.overview = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Tổng tasks', 'Hoàn thành', 'Chưa xong'],
      datasets: [{
        data: [total, done, rem],
        backgroundColor: [
          'rgba(176,127,255,.7)',
          'rgba(94,240,160,.75)',
          'rgba(46,49,80,.9)',
        ],
        borderColor: ['#b07fff','#5ef0a0','#2e3150'],
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f2030', borderColor: '#2e3150', borderWidth: 1,
          titleColor: '#ecedf5', bodyColor: '#8b8fa8',
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? Math.round((ctx.parsed.y / total) * 100) : 0;
              return ` ${ctx.parsed.y} tasks${ctx.dataIndex > 0 ? ` (${pct}%)` : ''}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: c.tick, font: { size: 12, weight: '600' } } },
        y: { min: 0, grid: { color: c.grid }, ticks: { color: c.tick, font: { size: 10 }, stepSize: 1 } }
      }
    }
  });
}

// ─── GITHUB-STYLE HEATMAP ─────────────────────────────────
// Render once. Called on init and on window resize (debounced).
let _hmRenderTimer = null;

function scheduleHeatmap(){
  clearTimeout(_hmRenderTimer);
  _hmRenderTimer = setTimeout(()=> _buildHeatmap(), 120);
}

async function _buildHeatmap(){
  const panel = document.querySelector('.heatmap-panel');
  const grid  = document.getElementById('heatmap-grid');
  if(!panel || !grid) return;

  const WEEKS  = 13;          // fixed ~3 months
  const GAP    = 4;
  const DAY_W  = 28, PAD = 32;
  const panelW = panel.offsetWidth;
  if(panelW === 0) return;

  // Auto cell size: fill available width evenly
  const availW = panelW - DAY_W - PAD;
  const CELL   = Math.max(14, Math.min(28, Math.floor((availW - (WEEKS - 1) * GAP) / WEEKS)));

  // Date range: end = nearest Sunday >= today, start = 13 weeks back
  const todayStr   = tds(state.today);
  const endDow     = state.today.getDay();
  const lastSunday = addDays(state.today, endDow === 0 ? 0 : 7 - endDow);
  const rawStart   = addDays(lastSunday, -(WEEKS * 7 - 1));
  const rsDow      = rawStart.getDay();
  const alignStart = addDays(rawStart, -(rsDow === 0 ? 6 : rsDow - 1));

  const data = await apiTasks.heatmap(tds(alignStart), tds(lastSunday));

  // Build columns
  let cur = new Date(alignStart), lastMo = -1;
  const cols = [];
  let totalDone = 0, totalTasks = 0, activeDays = 0;

  for(let w = 0; w < WEEKS; w++){
    const cells = [];
    let monthLabel = '', newMonth = false;
    if(cur.getMonth() !== lastMo){
      monthLabel = VI_MONTHS[cur.getMonth()];
      lastMo = cur.getMonth();
      newMonth = true;
    }
    for(let d = 0; d < 7; d++){
      const day = addDays(cur, d), ds = tds(day);
      const bd  = data[ds];
      const fut = day > state.today;
      const isTd = ds === todayStr;
      let lv = 0;
      if(!fut && bd && bd.total > 0){
        const r = bd.completed / bd.total;
        lv = r >= 1 ? 4 : r >= .66 ? 3 : r >= .33 ? 2 : 1;
        totalDone  += bd.completed;
        totalTasks += bd.total;
        if(bd.completed > 0) activeDays++;
      }
      cells.push({ day, ds, lv, bd, fut, isTd });
    }
    cols.push({ cells, monthLabel, newMonth });
    cur = addDays(cur, 7);
  }

  // Build DOM off-screen
  const frag = document.createDocumentFragment();
  const wrap = document.createElement('div');
  wrap.className = 'heatmap-wrapper';
  // pass cell/gap sizes as CSS vars scoped to this wrapper
  wrap.style.setProperty('--hc', CELL + 'px');
  wrap.style.setProperty('--hg', GAP + 'px');

  // Day-of-week labels column
  const dayCol = document.createElement('div');
  dayCol.className = 'hm-day-labels';
  ['T2','','T4','','T6','','CN'].forEach(t => {
    const el = document.createElement('div');
    el.className = 'hm-day-lbl'; el.textContent = t;
    dayCol.appendChild(el);
  });
  wrap.appendChild(dayCol);

  // Grid area
  const area = document.createElement('div');
  area.className = 'hm-grid-area';

  cols.forEach(({ cells, monthLabel, newMonth }) => {
    const col = document.createElement('div');
    col.className = 'hm-col' + (newMonth ? ' hm-col-newmonth' : '');

    // Month label row
    const mo = document.createElement('div');
    mo.className = 'hm-month-lbl';
    mo.textContent = monthLabel;
    col.appendChild(mo);

    cells.forEach(c => {
      const dot = document.createElement('div');
      dot.className = 'hmap-day' + (c.isTd ? ' hmap-today' : '');
      dot.setAttribute('data-level', c.fut ? 'future' : c.lv);

      // Rich tooltip
      const VI_DOW = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
      const dow = VI_DOW[c.day.getDay()];
      const dateStr = `${dow}, ${c.day.getDate()}/${c.day.getMonth()+1}/${c.day.getFullYear()}`;
      if(c.fut){
        dot.title = `${dateStr}\n— Chưa đến ngày`;
      } else if(c.bd && c.bd.total > 0){
        const pct = Math.round(c.bd.completed / c.bd.total * 100);
        dot.title = `${dateStr}\n✅ ${c.bd.completed}/${c.bd.total} tasks · ${pct}%`;
      } else {
        dot.title = `${dateStr}\n— Chưa có task`;
      }
      col.appendChild(dot);
    });

    area.appendChild(col);
  });

  wrap.appendChild(area);
  frag.appendChild(wrap);

  // Summary bar
  const rate = totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0;
  const summary = document.createElement('div');
  summary.className = 'hm-summary';
  summary.innerHTML = `
    <span class="hms-item">📅 <b>${WEEKS * 7}</b> ngày</span>
    <span class="hms-sep">·</span>
    <span class="hms-item">⚡ <b>${activeDays}</b> ngày hoạt động</span>
    <span class="hms-sep">·</span>
    <span class="hms-item">✅ <b>${totalDone}</b>/<b>${totalTasks}</b> tasks</span>
    <span class="hms-sep">·</span>
    <span class="hms-item hms-rate" style="color:${rate>=80?'var(--green)':rate>=50?'var(--accent)':'var(--text3)'}"><b>${rate}%</b> hoàn thành</span>
  `;
  frag.appendChild(summary);

  // Single DOM write
  grid.innerHTML = '';
  grid.appendChild(frag);

  // Update title
  const titleEl = document.querySelector('.heatmap-panel .heatmap-panel-header .chart-panel-title');
  if(titleEl) titleEl.textContent = '🗓 3 tháng gần đây';

  // Legend
  const leg = document.getElementById('heatmap-legend');
  if(leg) leg.innerHTML = `
    <span class="hml-label">Ít</span>
    ${[0,1,2,3,4].map(l=>`<div class="hmap-day" data-level="${l}" style="width:12px;height:12px;cursor:default;border-radius:3px"></div>`).join('')}
    <span class="hml-label">Nhiều</span>`;
}

// ─── HABITS ───────────────────────────────────────────────
async function loadHabits(){
  state.habits=await apiHabits.list();
  const wd=getWeekDates(0);
  const s=tds(wd[0]),e=tds(wd[6]);
  const logs=await apiHabits.logs(s,e);
  state.habitLogs={};
  logs.forEach(l=>{state.habitLogs[`${l.habitId}_${l.date}`]=l.done;});
  renderHabitsPanel(wd);
  renderHabitsStats();
}

function renderHabitsPanel(wd){
  const todayStr=tds(state.today);

  // Move habits-main-section into inject point inside main
  const inject=document.getElementById('habits-main-inject');
  const section=document.getElementById('habits-main-section');
  if(inject&&section&&!inject.contains(section)){
    inject.appendChild(section);
    section.style.display=''; // show after injecting
  } else if(section){
    section.style.display='';
  }

  // Build column headers
  const colHeader=document.getElementById('habits-col-header');
  if(colHeader){
    colHeader.innerHTML=`
      <div class="hch-name-col">THÓI QUEN</div>
      <div class="hch-days">
        ${wd.map(d=>{
          const ds=tds(d), isT=ds===todayStr;
          return `<div class="hch-day${isT?' hch-today':''}">
            <div class="hch-weekday">${VI_DAYS[d.getDay()]}</div>
            <div class="hch-date">${d.getDate()}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="hch-del-col"></div>`;
  }

  const wrap=document.getElementById('habits-rows-wrap');
  const empty=document.getElementById('habits-empty');
  wrap.querySelectorAll('.habit-row-main').forEach(r=>r.remove());

  if(!state.habits.length){ if(empty)empty.style.display=''; return; }
  if(empty) empty.style.display='none';

  state.habits.forEach(h=>{
    const row=document.createElement('div'); row.className='habit-row-main';
    const cellsHtml=wd.map(d=>{
      const ds=tds(d);
      const done=state.habitLogs[`${h._id}_${ds}`]===true;
      // future = strictly after today
      const isFuture=new Date(ds+' 00:00:00') > state.today;
      const isToday_=ds===todayStr;
      return `<div class="hrm-cell${done?' hrm-done':''}${isFuture?' hrm-future':''}${isToday_?' hrm-today':''}"
        data-hid="${h._id}" data-date="${ds}"
        style="${done?`--hcolor:${h.color};background:${h.color}22;border-color:${h.color};`:''}"
        title="${d.getDate()}/${d.getMonth()+1}">
        ${done?`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3" stroke="${done?h.color:'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`:''}
      </div>`;
    }).join('');
    row.innerHTML=`
      <div class="hrm-info">
        <span class="hrm-emoji">${h.emoji}</span>
        <span class="hrm-name">${esc(h.name)}</span>
      </div>
      <div class="hrm-cells">${cellsHtml}</div>
      <button class="hrm-delete" title="Xóa">✕</button>`;

    // Click cells — only non-future
    row.querySelectorAll('.hrm-cell:not(.hrm-future)').forEach(cell=>{
      cell.addEventListener('click',async()=>{
        const log=await apiHabits.toggleLog(cell.dataset.hid,cell.dataset.date);
        const key=`${cell.dataset.hid}_${cell.dataset.date}`;
        state.habitLogs[key]=log.done;
        // Refresh row
        const ds=cell.dataset.date;
        if(log.done){
          cell.classList.add('hrm-done');
          cell.style.background=`${h.color}22`; cell.style.borderColor=h.color;
          cell.innerHTML=`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3" stroke="${h.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else {
          cell.classList.remove('hrm-done');
          cell.style.background=''; cell.style.borderColor=''; cell.innerHTML='';
        }
        renderHabitsStats();
        if(log.done){
          const pts = log.pointsAwarded || 5;
          toast(`${h.emoji} Thói quen hoàn thành! +${pts}⭐`);
          showPointsToast(pts);
          updatePointsUI((_shopData.points||0) + pts);
          launchConfetti('low');
          setTimeout(() => showMotivationOverlay(), 600);
        } else {
          const pts = log.pointsDeducted || 5;
          toast(`${h.emoji} Đã bỏ tích — trừ ${pts}⭐`);
          updatePointsUI(Math.max(0, (_shopData.points||0) - pts));
        }
      });
    });
    row.querySelector('.hrm-delete').addEventListener('click',async()=>{
      if(!confirm(`Xoá thói quen "${h.name}"?`)) return;
      await apiHabits.del(h._id); await loadHabits(); toast('🗑 Đã xóa');
    });
    wrap.insertBefore(row,empty||null);
  });
}
async function renderHabitsStats(){
  const wd=getWeekDates(0),ws=tds(wd[0]),we=tds(wd[6]);
  document.getElementById('habit-week-label').textContent=`${ws.split('-').reverse().join('/')} – ${we.split('-').reverse().join('/')}`;
  const now=state.today;
  const cms=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const cme=tds(new Date(now.getFullYear(),now.getMonth()+1,0));
  document.getElementById('habit-curmonth-label').textContent=`${VI_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const pm=new Date(now.getFullYear(),now.getMonth()-1,1);
  const pms=tds(pm),pme=tds(new Date(pm.getFullYear(),pm.getMonth()+1,0));
  document.getElementById('habit-prevmonth-label').textContent=`${VI_MONTHS[pm.getMonth()]} ${pm.getFullYear()}`;

  const [wD,cmD,pmD]=await Promise.all([
    apiHabits.stats(ws,we), apiHabits.stats(cms,cme), apiHabits.stats(pms,pme)
  ]);
  mkHabitChart('chart-habit-week',wD);
  mkHabitChart('chart-habit-curmonth',cmD);
  mkHabitChart('chart-habit-prevmonth',pmD);

  // Analytics charts
  try{
    const ana = await apiHabits.analytics();
    if(ana?.length) renderHabitAnalytics(ana);
  }catch(e){}
}

async function renderHabitAnalytics(ana){
  const c = chartColors();
  const VI_DAY_FULL = ['CN','T2','T3','T4','T5','T6','T7'];

  // 1. Streak leaderboard (horizontal bar)
  const ctx1 = document.getElementById('chart-habit-streak')?.getContext('2d');
  if(ctx1){
    if(state.charts['habit-streak']) state.charts['habit-streak'].destroy();
    state.charts['habit-streak'] = new Chart(ctx1,{
      type:'bar',
      data:{
        labels: ana.map(h=>`${h.emoji} ${h.name}`),
        datasets:[
          { label:'Chuỗi hiện tại', data:ana.map(h=>h.curStreak),
            backgroundColor:ana.map(h=>h.color+'cc'), borderColor:ana.map(h=>h.color),
            borderWidth:1.5, borderRadius:6 },
          { label:'Chuỗi dài nhất', data:ana.map(h=>h.maxStreak),
            backgroundColor:'rgba(46,49,80,.5)', borderColor:'rgba(46,49,80,.8)',
            borderWidth:1, borderRadius:6 }
        ]},
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:true,labels:{color:c.tick,font:{size:10}}},
          tooltip:{backgroundColor:'#1f2030',borderColor:'#2e3150',borderWidth:1,
            titleColor:'#ecedf5',bodyColor:'#8b8fa8'}},
        scales:{
          x:{min:0, grid:{color:c.grid}, ticks:{color:c.tick,font:{size:10},stepSize:1}},
          y:{grid:{display:false}, ticks:{color:c.tick,font:{size:11}}}
        }}});
  }

  // 2. Weekly trend — line chart for first habit (or average)
  const ctx2 = document.getElementById('chart-habit-trend')?.getContext('2d');
  if(ctx2 && ana.length){
    if(state.charts['habit-trend']) state.charts['habit-trend'].destroy();
    const labels = ana[0].weeklyData.map((_,i)=> i===7?'Tuần này':`-${7-i}W`);
    const datasets = ana.slice(0,4).map(h=>({
      label:`${h.emoji} ${h.name}`,
      data: h.weeklyData.map(w=>w.rate),
      borderColor: h.color, backgroundColor: h.color+'20',
      borderWidth:2, pointRadius:3, tension:.4, fill:false
    }));
    state.charts['habit-trend'] = new Chart(ctx2,{
      type:'line', data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,labels:{color:c.tick,font:{size:10},boxWidth:12}},
          tooltip:{backgroundColor:'#1f2030',borderColor:'#2e3150',borderWidth:1,
            titleColor:'#ecedf5',bodyColor:'#8b8fa8',
            callbacks:{label:ct=>` ${ct.dataset.label}: ${ct.parsed.y}%`}}},
        scales:{
          x:{grid:{color:c.grid},ticks:{color:c.tick,font:{size:10}}},
          y:{min:0,max:100,grid:{color:c.grid},ticks:{color:c.tick,font:{size:10},callback:v=>v+'%'}}
        }}});
  }

  // 3. Best day of week — current week only (from habit logs)
  const ctx3 = document.getElementById('chart-habit-bestday')?.getContext('2d');
  if(ctx3){
    if(state.charts['habit-bestday']) state.charts['habit-bestday'].destroy();
    // Fetch current week's habit logs
    const weekDates = getWeekDates(state.weekOffset);
    const ws = tds(weekDates[0]), we = tds(weekDates[6]);
    try {
      const weekLogs = await apiHabits.logs(ws, we);
      const dayCounts = Array(7).fill(0); // 0=Sun
      if(weekLogs?.length){
        weekLogs.forEach(log => {
          const d = new Date(log.date + 'T00:00:00');
          dayCounts[d.getDay()]++;
        });
      }
      state.charts['habit-bestday'] = new Chart(ctx3,{
        type:'bar',
        data:{
          labels: VI_DAY_FULL,
          datasets:[{ label:'Hoàn thành trong tuần', data:dayCounts,
            backgroundColor:['#b07fff99','#ff85c899','#5ef0a099','#ffcf5c99','#5ee8f099','#ff6b8a99','#ffa8d899'],
            borderColor:['#b07fff','#ff85c8','#5ef0a0','#ffcf5c','#5ee8f0','#ff6b8a','#ffa8d8'],
            borderWidth:1.5, borderRadius:6 }]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},
            tooltip:{backgroundColor:'#1f2030',borderColor:'#2e3150',borderWidth:1,
              titleColor:'#ecedf5',bodyColor:'#8b8fa8',
              callbacks:{label:ct=>` ${ct.parsed.y} thói quen hoàn thành`}}},
          scales:{
            x:{grid:{display:false},ticks:{color:c.tick,font:{size:11}}},
            y:{min:0,grid:{color:c.grid},ticks:{color:c.tick,font:{size:10},stepSize:1}}
          }}});
    } catch(e) { console.error('bestday chart:', e); }
  }

  // 4. Consistency score — visual cards
  const wrap = document.getElementById('habit-consistency-wrap');
  if(wrap){
    wrap.innerHTML='';
    const sorted = [...ana].sort((a,b)=>b.totalDone-a.totalDone);
    sorted.forEach(h=>{
      const score = Math.min(100, Math.round((h.totalDone/90)*100)); // out of 90 days
      const bar = document.createElement('div');
      bar.style.cssText='display:flex;align-items:center;gap:8px;';
      bar.innerHTML=`
        <span style="font-size:14px;flex-shrink:0">${h.emoji}</span>
        <span style="font-size:12px;color:var(--text2);min-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.name)}</span>
        <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${score}%;background:${h.color};border-radius:3px;transition:width .6s"></div>
        </div>
        <span style="font-size:11px;font-family:'JetBrains Mono',monospace;color:${h.color};min-width:28px;text-align:right">${h.totalDone}d</span>`;
      wrap.appendChild(bar);
    });
  }
}
function mkHabitChart(id,data){
  const ctx=document.getElementById(id)?.getContext('2d'); if(!ctx) return;
  if(state.charts[id]) state.charts[id].destroy();
  if(!data?.length){state.charts[id]=null;return;}
  const c=chartColors();
  state.charts[id]=new Chart(ctx,{type:'bar',
    data:{labels:data.map(h=>`${h.emoji} ${h.name}`),
      datasets:[
        {label:'Ngày done',data:data.map(h=>h.doneDays),backgroundColor:data.map(h=>h.color+'cc'),borderColor:data.map(h=>h.color),borderWidth:1.5,borderRadius:5},
        {label:'Tổng ngày',data:data.map(h=>h.totalDays),backgroundColor:'rgba(46,49,80,.5)',borderColor:'rgba(46,49,80,.8)',borderWidth:1,borderRadius:5}
      ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#1f2030',borderColor:'#2e3150',borderWidth:1,
        titleColor:'#ecedf5',bodyColor:'#8b8fa8',
        callbacks:{title:items=>items[0].label,
          label:item=>item.datasetIndex===0?` ${data[item.dataIndex].doneDays}/${data[item.dataIndex].totalDays} ngày (${data[item.dataIndex].rate}%)`:null}}},
      scales:{x:{grid:{display:false},ticks:{color:c.tick,font:{size:10},maxRotation:30}},
              y:{min:0,grid:{color:c.grid},ticks:{color:c.tick,font:{size:10},stepSize:1}}}}});
}

// ─── HABITS FORM ──────────────────────────────────────────
function initHabitsForm(){
  document.getElementById('open-add-habit').addEventListener('click',()=>{
    document.getElementById('add-habit-form').style.display='';
    document.getElementById('ahf-name').focus();
  });
  document.getElementById('ahf-cancel').addEventListener('click',()=>{
    document.getElementById('add-habit-form').style.display='none';
    document.getElementById('ahf-name').value='';
  });
  document.getElementById('ahf-save').addEventListener('click',async()=>{
    const name=document.getElementById('ahf-name').value.trim();
    if(!name){toast('⚠ Nhập tên thói quen');return;}
    await apiHabits.add({name,emoji:state.selectedEmoji,color:state.selectedColor});
    document.getElementById('add-habit-form').style.display='none';
    document.getElementById('ahf-name').value='';
    await loadHabits(); toast('🐰 Đã thêm thói quen!');
  });
  document.querySelectorAll('.ahf-ep').forEach(ep=>{
    ep.addEventListener('click',()=>{
      document.querySelectorAll('.ahf-ep').forEach(e=>e.classList.remove('selected'));
      ep.classList.add('selected'); state.selectedEmoji=ep.dataset.e;
      document.getElementById('ahf-emoji-display').textContent=ep.dataset.e;
    });
  });
  document.querySelectorAll('.ahf-color').forEach(cp=>{
    cp.addEventListener('click',()=>{
      document.querySelectorAll('.ahf-color').forEach(c=>c.classList.remove('selected'));
      cp.classList.add('selected'); state.selectedColor=cp.dataset.c;
    });
  });
}

// ─── MOOD + JOURNAL (Locket style) ───────────────────────
const MOOD_PROMPTS = {
  '🌸':{ label:'Tuyệt vời! 🌸', color:'#ff85c8', prompt:'Hôm nay điều gì khiến bạn cảm thấy tuyệt vời vậy? Hãy ghi lại để nhớ mãi nhé!' },
  '😊':{ label:'Vui vẻ 😊',     color:'#ffcf5c', prompt:'Ngày hôm nay vui vẻ thật đấy! Có chuyện gì thú vị xảy ra không?' },
  '😌':{ label:'Bình thường 😌',color:'#b07fff', prompt:'Một ngày bình yên. Bạn đang suy nghĩ gì hoặc có điều gì muốn ghi lại không?' },
  '😴':{ label:'Mệt mỏi 😴',    color:'#5ee8f0', prompt:'Bạn đang mệt mỏi... Chuyện gì đang làm bạn kiệt sức vậy? Chia sẻ ra đây cho nhẹ lòng nhé.' },
  '😤':{ label:'Căng thẳng 😤', color:'#ff9900', prompt:'Có chuyện gì đang làm bạn căng thẳng không? Cứ viết ra đây — đôi khi nói ra là nhẹ hơn nhiều đó.' },
  '😢':{ label:'Buồn 😢',       color:'#7cb9ff', prompt:'Bạn đang buồn... Có chuyện gì không vui xảy ra không? Tôi lắng nghe bạn đây 💕' },
};

async function initJournal(){
  const dateStr = tds(state.today);
  document.getElementById('jp-date').textContent =
    `${state.today.getDate()}/${state.today.getMonth()+1}/${state.today.getFullYear()}`;

  let entry = { mood:'', content:'' };
  try { entry = await apiJournal.get(dateStr); } catch(e){}
  if(entry.mood) showJournalSaved(entry.mood, entry.content);
  else showMoodPicker();

  // Mood buttons
  document.querySelectorAll('.jp-mood-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.jp-mood-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      showJournalWrite(btn.dataset.mood);
    });
  });

  // Save
  document.getElementById('jp-save-btn').addEventListener('click', async()=>{
    const mood    = document.querySelector('.jp-mood-btn.active')?.dataset.mood||'';
    const content = document.getElementById('jp-textarea').value.trim();
    if(!mood){ toast('Chọn tâm trạng trước nhé!'); return; }
    await apiJournal.save(dateStr, mood, content);
    showJournalSaved(mood, content);
    toast('✍️ Đã lưu nhật ký!');
  });

  // Edit
  document.getElementById('jp-edit-btn').addEventListener('click',()=>{
    const mood = document.querySelector('.jp-mood-btn.active')?.dataset.mood || entry.mood;
    showJournalWrite(mood);
  });

  // Change mood — go back to mood picker, keep content in textarea
  document.getElementById('jp-change-mood-btn')?.addEventListener('click',()=>{
    showMoodPicker();
  });

  // Char count
  document.getElementById('jp-textarea').addEventListener('input', e=>{
    document.getElementById('jp-char-count').textContent = `${e.target.value.length}/2000`;
  });

  // History button
  document.getElementById('jp-history-btn').addEventListener('click', ()=> showHistoryScreen());

  // Back button
  document.getElementById('jp-back-btn').addEventListener('click', ()=>{
    document.getElementById('jp-screen-history').style.display='none';
    document.getElementById('jp-screen-write').style.display='';
  });

  // Overlay close
  document.getElementById('jp-overlay-close').addEventListener('click', ()=>{
    document.getElementById('jp-overlay').style.display='none';
  });
  document.getElementById('jp-overlay').addEventListener('click', e=>{
    if(e.target===document.getElementById('jp-overlay'))
      document.getElementById('jp-overlay').style.display='none';
  });
}

function showMoodPicker(){
  document.getElementById('jp-mood-row').style.display='';
  document.getElementById('jp-write-row').style.display='none';
  document.getElementById('jp-saved').style.display='none';
}
function showJournalWrite(mood){
  const info = MOOD_PROMPTS[mood]||{ label:mood, color:'var(--accent)', prompt:'Hôm nay bạn có muốn ghi lại điều gì không?' };
  document.getElementById('jp-mood-row').style.display='none';
  document.getElementById('jp-write-row').style.display='';
  document.getElementById('jp-saved').style.display='none';
  document.getElementById('jp-selected-mood').textContent = info.label;
  document.getElementById('jp-selected-mood').style.color = info.color;
  document.getElementById('jp-prompt').textContent = info.prompt;
  document.querySelectorAll('.jp-mood-btn').forEach(b=>b.classList.toggle('active',b.dataset.mood===mood));
}
function showJournalSaved(mood, content){
  const info = MOOD_PROMPTS[mood]||{ label:mood, color:'var(--accent)' };
  document.getElementById('jp-mood-row').style.display='none';
  document.getElementById('jp-write-row').style.display='none';
  document.getElementById('jp-saved').style.display='';
  document.getElementById('jp-saved-mood').textContent = info.label;
  document.getElementById('jp-saved-mood').style.color = info.color;
  document.getElementById('jp-saved-content').textContent = content||'(Chưa có ghi chú)';
  document.getElementById('jp-textarea').value = content||'';
  document.getElementById('jp-char-count').textContent = `${(content||'').length}/2000`;
  document.querySelectorAll('.jp-mood-btn').forEach(b=>b.classList.toggle('active',b.dataset.mood===mood));
}

// ── HISTORY SCREEN ──
async function showHistoryScreen(){
  document.getElementById('jp-screen-write').style.display='none';
  document.getElementById('jp-screen-history').style.display='';
  const scroll = document.getElementById('jp-history-scroll');
  scroll.innerHTML = '<div class="jp-history-loading">Đang tải...</div>';

  // Fetch last 6 months of entries
  const end   = tds(state.today);
  const start6 = new Date(state.today); start6.setMonth(start6.getMonth()-5); start6.setDate(1);
  const start = tds(start6);

  let entries = [];
  try { entries = await apiJournal.range(start, end); } catch(e){}

  // Map by date for quick lookup
  const byDate = {};
  entries.forEach(e=>{ byDate[e.date]=e; });

  // Build month groups — newest first
  scroll.innerHTML='';
  const months=[];
  for(let m=0;m<6;m++){
    const d=new Date(state.today.getFullYear(), state.today.getMonth()-m, 1);
    months.push({year:d.getFullYear(), month:d.getMonth()});
  }

  months.forEach(({year,month})=>{
    const daysInMo = new Date(year,month+1,0).getDate();
    const group = document.createElement('div');
    group.className='jph-group';

    const title = document.createElement('div');
    title.className='jph-month-title';
    title.textContent=`${VI_MONTHS[month]} ${year}`;
    group.appendChild(title);

    const grid = document.createElement('div');
    grid.className='jph-grid';

    for(let day=1;day<=daysInMo;day++){
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const entry = byDate[ds];
      const isToday_ = ds===tds(state.today);
      const isFuture = new Date(ds+'T00:00:00')>state.today;

      const cell = document.createElement('div');
      cell.className='jph-cell'+(isToday_?' jph-today':'')+(isFuture?' jph-future':'');

      if(entry?.mood){
        const info = MOOD_PROMPTS[entry.mood]||{ color:'#b07fff' };
        cell.classList.add('jph-has-entry');
        cell.style.background = info.color+'22';
        cell.style.borderColor = info.color+'88';
        cell.innerHTML=`<span class="jph-cell-emoji">${entry.mood}</span><span class="jph-cell-day">${day}</span>`;
        cell.addEventListener('click',()=>showEntryOverlay(ds, entry));
      } else {
        cell.innerHTML=`<span class="jph-cell-day jph-day-only">${day}</span>`;
      }
      grid.appendChild(cell);
    }
    group.appendChild(grid);
    scroll.appendChild(group);
  });
}

async function showEntryOverlay(dateStr, entry){
  const [y,m,d] = dateStr.split('-');
  const info = MOOD_PROMPTS[entry.mood]||{ label:entry.mood, color:'#b07fff' };

  // Fetch task stats for that day
  let taskDone=0, taskTotal=0;
  try{
    const stats = await apiTasks.stats(dateStr, dateStr);
    taskDone  = stats.overall.completed;
    taskTotal = stats.overall.total;
  }catch(e){}

  // Fetch habit logs for that day
  let habitsDone = [];
  try{
    const logs = await apiHabits.logs(dateStr, dateStr);
    const done = logs.filter(l=>l.done);
    habitsDone = state.habits.filter(h=>done.some(l=>String(l.habitId)===String(h._id)));
  }catch(e){}

  document.getElementById('jp-overlay-mood').textContent = info.label;
  document.getElementById('jp-overlay-mood').style.color  = info.color;
  document.getElementById('jp-overlay-date').textContent  = `${parseInt(d)}/${parseInt(m)}/${y}`;
  document.getElementById('jp-overlay-content').textContent = entry.content||'(Không có ghi chú)';
  document.getElementById('jp-overlay-meta').innerHTML = `
    ${taskTotal>0 ? `<div class="jp-ov-meta-item">✅ Task: <b>${taskDone}/${taskTotal}</b></div>` : ''}
    ${habitsDone.length>0 ? `<div class="jp-ov-meta-item">🐰 Thói quen: ${habitsDone.map(h=>`${h.emoji} ${h.name}`).join(', ')}</div>` : ''}
  `;
  document.getElementById('jp-overlay').style.display='flex';
}

// ─── MOBILE SIDEBAR ───────────────────────────────────────
function initMobileSidebar(){
  const toggle=document.getElementById('sidebar-toggle');
  const sidebar=document.getElementById('sidebar');
  const overlay=document.getElementById('sidebar-overlay');
  const close=document.getElementById('sidebar-close');
  const handle=document.getElementById('sheet-handle');
  let isOpen=false;
  function openSheet(){isOpen=true;sidebar.classList.add('open');overlay.classList.add('show');document.body.style.overflow='hidden';if(toggle)toggle.textContent='✕ Đóng';}
  function closeSheet(){isOpen=false;sidebar.classList.remove('open');overlay.classList.remove('show');document.body.style.overflow='';if(toggle)toggle.textContent='🗓 Lịch & Thói quen';}
  toggle?.addEventListener('click',()=>isOpen?closeSheet():openSheet());
  close?.addEventListener('click',closeSheet);
  overlay?.addEventListener('click',closeSheet);
  let dragStartY=0,isDrag=false;
  const ds_=y=>{dragStartY=y;isDrag=true;};
  const dm_=y=>{if(!isDrag)return;const dy=y-dragStartY;if(dy>0)sidebar.style.transform=`translateY(${dy}px)`;};
  const de_=y=>{
    if(!isDrag)return;isDrag=false;sidebar.style.transform='';
    const dy=y-dragStartY;if(dy>80)closeSheet();
  };
  handle?.addEventListener('touchstart',e=>ds_(e.touches[0].clientY),{passive:true});
  window.addEventListener('touchmove',e=>{if(isDrag)dm_(e.touches[0].clientY);},{passive:true});
  window.addEventListener('touchend',e=>{if(isDrag)de_(e.changedTouches[0].clientY);},{passive:true});
  handle?.addEventListener('mousedown',e=>ds_(e.clientY));
  window.addEventListener('mousemove',e=>{if(isDrag)dm_(e.clientY);});
  window.addEventListener('mouseup',e=>{if(isDrag)de_(e.clientY);});
}

// ─── UTILS ────────────────────────────────────────────────
let _toastTimer;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(_toastTimer);_toastTimer=setTimeout(()=>el.classList.remove('show'),2400);
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ─── PAGE NAVIGATION ──────────────────────────────────────
let _currentPage = 'home';
let _statsInited = false;

function navigateTo(page){
  if(_currentPage === page) return;
  _currentPage = page;
  document.querySelectorAll('.page-content').forEach(p=>p.style.display='none');
  document.getElementById(`page-${page}`).style.display='';
  document.querySelectorAll('.tnav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  // Lazy load stats page
  if(page==='stats' && !_statsInited){
    _statsInited = true;
    loadStats();
    setTimeout(()=>_buildHeatmap(), 300);
  }
}

function initTopNav(){
  document.querySelectorAll('.tnav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> navigateTo(btn.dataset.page));
  });
}

// ─── PROFILE PAGE ─────────────────────────────────────────
function initProfilePage(user){
  document.getElementById('profile-display-name').textContent = user.displayName||user.username||'—';
  document.getElementById('profile-username-label').textContent = '@'+(user.username||'');
  const nameInput = document.getElementById('edit-display-name');
  if(nameInput) nameInput.value = user.displayName||'';

  // Save display name
  document.getElementById('save-display-name')?.addEventListener('click', async()=>{
    const newName = document.getElementById('edit-display-name').value.trim();
    if(!newName){ toast('⚠ Nhập tên hiển thị!'); return; }
    try{
      const r = await fetch('/api/auth/profile', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ displayName: newName }), credentials:'include'
      });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error);
      document.getElementById('profile-display-name').textContent = newName;
      toast('✓ Đã cập nhật tên!');
    }catch(e){ toast('❌ '+(e.message||'Có lỗi xảy ra')); }
  });

  // Change password
  document.getElementById('save-password')?.addEventListener('click', async()=>{
    const cur = document.getElementById('pw-current').value;
    const nw  = document.getElementById('pw-new').value;
    if(!cur||!nw){ toast('⚠ Điền đầy đủ!'); return; }
    if(nw.length < 6){ toast('⚠ Mật khẩu mới tối thiểu 6 ký tự!'); return; }
    try{
      const r = await fetch('/api/auth/password', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ currentPassword: cur, newPassword: nw }), credentials:'include'
      });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error);
      document.getElementById('pw-current').value='';
      document.getElementById('pw-new').value='';
      toast('✓ Đã đổi mật khẩu!');
    }catch(e){ toast('❌ '+(e.message||'Mật khẩu hiện tại không đúng')); }
  });

  // Theme toggle
  document.getElementById('psb-theme-btn')?.addEventListener('click',()=>{
    toggleTheme();
    document.getElementById('psb-theme-btn').textContent = state.theme==='dark'?'☀️ Đổi giao diện':'🌙 Đổi giao diện';
  });

  // Logout
  document.getElementById('profile-logout-btn')?.addEventListener('click', async()=>{
    await fetch('/api/auth/logout',{method:'POST',credentials:'include'});
    window.location.href='/auth.html';
  });
}

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async ()=>{
  // ── AUTH CHECK ──
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if(!r.ok){ window.location.href = '/auth.html'; return; }
    const { user } = await r.json();
    state.currentUser = user;
    initProfilePage(user);
  } catch(e){ window.location.href = '/auth.html'; return; }

  applyTheme(state.theme);

  // Header date
  const days=['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  const now=state.today;
  document.getElementById('header-date').textContent=`${days[now.getDay()]}, ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

  // Theme toggle (header)
  document.getElementById('theme-btn')?.addEventListener('click',toggleTheme);

  // Top nav
  initTopNav();

  // Col nav arrows
  document.getElementById('col-nav-left')?.addEventListener('click',()=>scrollByCol(-1));
  document.getElementById('col-nav-right')?.addEventListener('click',()=>scrollByCol(+1));

  initViewportScroll();
  initScrollbarDrag();

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.view-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.viewMode=btn.dataset.view; state.weekOffset=0; state.monthOffset=0;
      loadAndRender();
    });
  });

  // Calendar nav
  document.getElementById('cal-prev')?.addEventListener('click',()=>{
    state.calViewDate=new Date(state.calViewDate.getFullYear(),state.calViewDate.getMonth()-1,1);renderCalendar();});
  document.getElementById('cal-next')?.addEventListener('click',()=>{
    state.calViewDate=new Date(state.calViewDate.getFullYear(),state.calViewDate.getMonth()+1,1);renderCalendar();});

  // Period nav buttons (injected)
  const navLabel=document.getElementById('nav-label');
  const mkNavBtn=(icon,dir)=>{
    const b=document.createElement('button'); b.className='nav-btn';
    b.innerHTML=icon; b.addEventListener('click',()=>{
      if(state.viewMode==='week') state.weekOffset+=dir; else state.monthOffset+=dir;
      loadAndRender();
    }); return b;
  };
  navLabel.parentNode.insertBefore(mkNavBtn('<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',-1),navLabel);
  navLabel.parentNode.appendChild(mkNavBtn('<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',+1));

  // Stats tabs
  document.querySelectorAll('.stats-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.stats-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); state.statsMode=btn.dataset.mode; loadStats();
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT') return;
    if(e.key==='ArrowLeft'){if(state.viewMode==='week')state.weekOffset--;else state.monthOffset--;loadAndRender();}
    if(e.key==='ArrowRight'){if(state.viewMode==='week')state.weekOffset++;else state.monthOffset++;loadAndRender();}
  });

  initJournal();
  initHabitsForm();
  initMobileSidebar();
  loadAndRender();
  loadHabits();
  initGoals();
  // Stats summary cards still on home page
  loadStats();

  setTimeout(()=> _buildHeatmap(), 400);
  window.addEventListener('resize', scheduleHeatmap, {passive:true});

  // Load points for header badge
  loadInitialPoints();

  // Init global inventory shelf
  initInventoryShelf();

  // Load floating pets after a short delay (let auth settle)
  setTimeout(() => loadFloatingPets(), 1500);
});

// ═══════════════════════════════════════════
// GOALS — Long-term task tracker
// ═══════════════════════════════════════════

// ═══ MOTIVATIONAL QUOTES — ca dao, tục ngữ, trích dẫn nổi tiếng ═══
const TASK_QUOTES = [
  // Ca dao tục ngữ Việt Nam
  { text: "Có công mài sắt, có ngày nên kim.", author: "Ca dao Việt Nam" },
  { text: "Kiến tha lâu cũng đầy tổ.", author: "Tục ngữ Việt Nam" },
  { text: "Chớ thấy sóng cả mà ngã tay chèo.", author: "Ca dao Việt Nam" },
  { text: "Lửa thử vàng, gian nan thử sức.", author: "Tục ngữ Việt Nam" },
  { text: "Ai ơi bưng bát cơm đầy, dẻo thơm một hạt, đắng cay muôn phần.", author: "Ca dao Việt Nam" },
  { text: "Không thầy đố mày làm nên. Nhưng chính sự kiên trì mới là thầy vĩ đại nhất.", author: "Ca dao & Suy ngẫm" },
  { text: "Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao.", author: "Ca dao Việt Nam" },
  { text: "Có chí thì nên.", author: "Tục ngữ Việt Nam" },
  { text: "Thua keo này, bày keo khác.", author: "Tục ngữ Việt Nam" },
  { text: "Nước chảy đá mòn.", author: "Tục ngữ Việt Nam" },
  { text: "Dù ai nói ngả nói nghiêng, lòng ta vẫn vững như kiềng ba chân.", author: "Ca dao Việt Nam" },
  { text: "Muốn ăn phải lăn vào bếp.", author: "Tục ngữ Việt Nam" },
  { text: "Đường đi khó, không khó vì ngăn sông cách núi, mà khó vì lòng người ngại núi e sông.", author: "Nguyễn Bá Học" },
  { text: "Thất bại là mẹ thành công.", author: "Tục ngữ Việt Nam" },
  { text: "Siêng làm thì có, siêng học thì hay.", author: "Tục ngữ Việt Nam" },

  // Trích dẫn nổi tiếng thế giới
  { text: "Bạn không cần phải vĩ đại mới bắt đầu. Nhưng bạn phải bắt đầu để trở nên vĩ đại.", author: "Zig Ziglar" },
  { text: "Thành công không phải là chìa khóa dẫn đến hạnh phúc. Hạnh phúc mới là chìa khóa dẫn đến thành công.", author: "Albert Schweitzer" },
  { text: "Điều duy nhất đứng giữa bạn và giấc mơ của bạn là ý chí muốn thử và niềm tin rằng nó thực sự khả thi.", author: "Joel Brown" },
  { text: "Tương lai thuộc về những người tin vào vẻ đẹp của ước mơ mình.", author: "Eleanor Roosevelt" },
  { text: "Bạn bỏ lỡ 100% những cú sút mà bạn không thực hiện.", author: "Wayne Gretzky" },
  { text: "Thành công là đi từ thất bại này sang thất bại khác mà không đánh mất nhiệt huyết.", author: "Winston Churchill" },
  { text: "Cách tốt nhất để dự đoán tương lai là tạo ra nó.", author: "Peter Drucker" },
  { text: "Không phải vì khó mà ta không dám, mà vì ta không dám nên mới thấy khó.", author: "Seneca" },
  { text: "Mỗi ngày là một cơ hội mới để thay đổi cuộc đời bạn.", author: "Khuyết danh" },
  { text: "Hãy luôn nhớ rằng quyết tâm thành công của bạn quan trọng hơn bất kỳ điều gì khác.", author: "Abraham Lincoln" },
  { text: "Người thành công và người không thành công không khác nhau nhiều về khả năng, mà khác nhau về khát vọng.", author: "John Maxwell" },
  { text: "Giọt nước xuyên đá không phải nhờ sức mạnh, mà nhờ sự kiên trì.", author: "Ovid" },
  { text: "Kỷ luật là cầu nối giữa mục tiêu và thành tựu.", author: "Jim Rohn" },
  { text: "Không có thang máy dẫn đến thành công. Bạn phải leo cầu thang.", author: "Zig Ziglar" },
  { text: "Ngày hôm nay là ngày khó nhất. Ngày mai sẽ dễ hơn, nếu bạn không bỏ cuộc.", author: "Jack Ma" },

  // Câu động viên, khuyến khích
  { text: "Bạn đã làm rất tốt! Mỗi task hoàn thành là một bước tiến gần hơn đến phiên bản tốt nhất của mình.", author: "Rabbit Habits" },
  { text: "Thói quen nhỏ, thay đổi lớn. Bạn đang xây dựng tương lai của mình từng ngày.", author: "Rabbit Habits" },
  { text: "Không ai có thể quay ngược thời gian để bắt đầu lại. Nhưng ai cũng có thể bắt đầu từ hôm nay.", author: "Rabbit Habits" },
  { text: "Bạn mạnh hơn bạn nghĩ, giỏi hơn bạn tin, và được yêu thương nhiều hơn bạn biết.", author: "A.A. Milne" },
  { text: "Đừng so sánh mình với người khác. Hãy so sánh mình hôm nay với mình hôm qua.", author: "Jordan Peterson" },
  { text: "Thành công không đến từ những gì bạn làm thỉnh thoảng. Nó đến từ những gì bạn làm mỗi ngày.", author: "Marie Forleo" },
  { text: "Điều quan trọng không phải là tốc độ, mà là hướng đi. Bạn đang đi đúng hướng rồi!", author: "Rabbit Habits" },
  { text: "Hôm nay bạn đã chọn hành động thay vì trì hoãn. Đó chính là chiến thắng lớn nhất.", author: "Rabbit Habits" },
  { text: "Mỗi buổi sáng bạn có hai lựa chọn: tiếp tục nằm mơ, hoặc thức dậy theo đuổi giấc mơ.", author: "Carmelo Anthony" },
  { text: "Khó khăn không tạo nên tính cách, nó bộc lộ tính cách.", author: "James Lane Allen" },
  { text: "Bạn không cần nhìn thấy cả cầu thang. Chỉ cần bước lên bước đầu tiên.", author: "Martin Luther King Jr." },
  { text: "Sự khác biệt giữa thường và phi thường chỉ là chút \"extra\" nỗ lực hơn.", author: "Jimmy Johnson" },
  { text: "Hành động là liều thuốc giải cho sự lo lắng. Bạn vừa hành động — tuyệt vời!", author: "Will Smith" },
  { text: "Kiên nhẫn, kiên trì và nỗ lực. Ba thứ đó tạo nên sự kết hợp bất bại cho thành công.", author: "Napoleon Hill" },
  { text: "Vinh quang lớn nhất không phải là không bao giờ vấp ngã, mà là đứng dậy mỗi khi vấp ngã.", author: "Khổng Tử" },
  { text: "Đừng đợi cơ hội. Hãy tạo ra nó.", author: "George Bernard Shaw" },
  { text: "Thành công là tổng của những nỗ lực nhỏ, được lặp đi lặp lại ngày này qua ngày khác.", author: "Robert Collier" },
  { text: "Bạn là tác giả của cuộc đời mình. Hãy viết nên một câu chuyện đáng tự hào.", author: "Rabbit Habits" },
  { text: "Con đường dài nhất bắt đầu bằng một bước chân. Bạn đã bước rồi — tiếp tục thôi!", author: "Lão Tử" },
  { text: "Ngày mai bạn sẽ cảm ơn bản thân hôm nay đã không bỏ cuộc.", author: "Rabbit Habits" },
];

// Goal-specific motivations
const MOTIVATIONS = {
  start: [
    "🚀 Hành trình vạn dặm bắt đầu từ một bước chân!",
    "✨ Ngày đầu tiên luôn là ngày quan trọng nhất — bạn đã bắt đầu rồi!",
    "🌱 Mỗi chuyên gia từng là người mới bắt đầu. Hôm nay là ngày 1 của bạn!",
    "💫 Không cần hoàn hảo, chỉ cần bắt đầu thôi!",
    "🐰 Thỏ nhỏ cũng leo được núi cao, từng bước một thôi!",
    "🌅 Bình minh của sự thay đổi bắt đầu từ hôm nay!",
    "💪 Bắt đầu là phần khó nhất — và bạn đã làm được rồi!",
  ],
  middle: [
    "💪 Bạn đã đi được nửa đường rồi — đừng dừng lại bây giờ!",
    "🔥 Momentum đang ở phía bạn, hãy tiếp tục nhé!",
    "🌊 Sóng lớn nhất thường đến giữa hành trình — vượt qua đi!",
    "⭐ Mỗi ngày kiên trì là một viên gạch xây nên thành công.",
    "🎯 Bạn đang đi đúng hướng rồi, chỉ cần giữ nhịp thôi!",
    "🏃 Không cần nhanh, chỉ cần không dừng lại!",
    "💎 Kim cương cũng cần áp lực để tỏa sáng — bạn đang làm được!",
    "🌟 Nửa đường rồi! Phía trước là ánh sáng!",
    "🐇 Kiên trì như chú thỏ — chậm mà chắc!",
  ],
  nearEnd: [
    "🎊 Sắp về đích rồi! Cố lên một chút nữa thôi!",
    "🏆 Đích đến đang ở trước mặt rồi — đừng từ bỏ lúc này!",
    "⚡ Giai đoạn cuối luôn khó nhất, nhưng bạn gần xong rồi!",
    "🌅 Bình minh luôn đến sau đêm dài — bạn sắp thấy kết quả rồi!",
    "💪 Vài ngày nữa thôi! Bạn đã làm được nhiều thứ hơn bạn nghĩ đấy!",
    "🏁 Vạch đích đang chờ bạn — chạy nốt đoạn cuối này!",
  ],
  done: [
    "🎉 TUYỆT VỜI! Bạn đã hoàn thành mục tiêu! Tự hào về bản thân đi!",
    "🏆 100%! Bạn làm được rồi! Đây là minh chứng cho sự kiên trì của bạn!",
    "✨ Xong rồi! Hôm nay bạn là phiên bản tốt hơn của chính mình hôm qua!",
    "🌟 Bạn đã chứng minh rằng mình có thể làm được — đây chỉ là khởi đầu!",
    "👑 Hoàn thành xuất sắc! Bạn xứng đáng với mọi lời khen!",
  ],
  missed: [
    "😌 Không sao cả! Một ngày nghỉ không phá hủy cả hành trình đâu.",
    "🌱 Ngã là chuyện bình thường, quan trọng là đứng dậy. Hôm nay thử lại nhé!",
    "💙 Hãy nhẹ nhàng với bản thân — hôm qua qua rồi, hôm nay là cơ hội mới.",
    "🐰 Thỏ cũng có lúc mệt, nhưng không bỏ cuộc! Tiếp tục nào!",
    "⭐ Bỏ lỡ một ngày không có nghĩa là thất bại — quay lại ngay hôm nay đi!",
    "🌈 Sau cơn mưa trời lại sáng — ngày mai sẽ tốt hơn!",
  ],
  daily: [
    "☀️ Chào buổi sáng! Hôm nay là ngày để tiến gần hơn đến mục tiêu của bạn!",
    "🌸 Một ngày mới, một cơ hội mới. Bạn làm được!",
    "✍️ Đừng để ngày này trôi qua mà không làm gì cho mục tiêu của mình nhé!",
    "💡 Nhắc nhở nhỏ: mục tiêu của bạn đang chờ bạn hôm nay!",
    "🎯 Focus! Hôm nay chỉ cần hoàn thành 1 ngày này thôi — làm được không?",
    "🔑 Chìa khóa thành công là nhất quán — và hôm nay bạn có cơ hội đó!",
    "🌊 Từng giọt nước tạo nên đại dương. Hành động nhỏ hôm nay tạo nên thành tích lớn!",
  ]
};

// Show motivational quote overlay on task completion
function showMotivationOverlay() {
  const overlay = document.getElementById('motivation-overlay');
  if (!overlay) return;
  const quote = TASK_QUOTES[Math.floor(Math.random() * TASK_QUOTES.length)];
  const emojis = ['🌟','✨','💫','🎯','💪','🔥','🌸','🏆','💎','🌈','⭐','🐰','🎉','🌻','🌺'];
  document.getElementById('motivation-emoji').textContent = emojis[Math.floor(Math.random() * emojis.length)];
  document.getElementById('motivation-text').textContent = '"' + quote.text + '"';
  document.getElementById('motivation-author').textContent = '— ' + quote.author;
  overlay.classList.add('show');

  // Auto-dismiss after 4.5 seconds or on click
  const dismiss = () => {
    overlay.classList.remove('show');
    overlay.removeEventListener('click', dismiss);
  };
  overlay.addEventListener('click', dismiss);
  setTimeout(dismiss, 4500);
}

function getMotivation(goal){
  const done = goal.days.filter(d=>d.done).length;
  const pct  = goal.totalDays > 0 ? (done/goal.totalDays)*100 : 0;
  const hasMissed = goal.days.some(d=>d.missedAt);
  if(pct >= 100) return MOTIVATIONS.done[Math.floor(Math.random()*MOTIVATIONS.done.length)];
  if(hasMissed && done === 0) return MOTIVATIONS.missed[Math.floor(Math.random()*MOTIVATIONS.missed.length)];
  if(pct >= 80) return MOTIVATIONS.nearEnd[Math.floor(Math.random()*MOTIVATIONS.nearEnd.length)];
  if(pct >= 30) return MOTIVATIONS.middle[Math.floor(Math.random()*MOTIVATIONS.middle.length)];
  return MOTIVATIONS.start[Math.floor(Math.random()*MOTIVATIONS.start.length)];
}

// API
const apiGoals = {
  list:      ()           => API.g('/api/goals'),
  create:    (b)          => API.p('/api/goals', b),
  del:       (id)         => API.d(`/api/goals/${id}`),
  updateDay: (id,idx,b)   => API.pa(`/api/goals/${id}/day/${idx}`, b),
  toggleDay: (id,idx)     => API.pa(`/api/goals/${id}/day/${idx}/toggle`, {}),
};

// Progress bar color based on %
function progressColor(pct){
  if(pct >= 100) return '#5ef0a0';
  if(pct >= 80)  return '#3ddbb8';
  if(pct >= 60)  return '#ffcf5c';
  if(pct >= 40)  return '#ffa048';
  if(pct >= 20)  return '#ff7744';
  return '#ff6b8a';
}

// ── RENDER ALL GOALS ──
async function loadGoals(){
  let goals = [];
  try {
    goals = await apiGoals.list();
  } catch(e){
    console.error('loadGoals error:', e);
  }
  renderGoalsList(goals);
}

function renderGoalsList(goals){
  const list  = document.getElementById('goals-list');
  const empty = document.getElementById('goals-empty');
  // Remove existing goal cards
  list.querySelectorAll('.goal-card').forEach(c=>c.remove());

  if(!goals.length){ if(empty) empty.style.display=''; return; }
  if(empty) empty.style.display='none';

  goals.forEach(g => list.appendChild(createGoalCard(g)));
}


function createGoalCard(g){
  const done    = g.days.filter(d=>d.done).length;
  const missed  = g.days.filter(d=>d.missedAt && !d.done).length;
  const pct     = g.totalDays > 0 ? Math.round((done/g.totalDays)*100) : 0;
  const color   = g.color || '#b07fff';
  const barColor = progressColor(pct);
  const todayStr = tds(state.today);
  const todayDay = g.days.find(d=>d.date===todayStr);
  const lastDay  = g.days[g.days.length-1];
  const motivation = getMotivation(g);

  const card = document.createElement('div');
  card.className = 'goal-card';
  card.dataset.id = g._id;
  card.style.cssText = `border-color:${color}33;`;

  const endLabel = lastDay
    ? `Kết thúc ${parseInt(lastDay.date.split('-')[2])}/${parseInt(lastDay.date.split('-')[1])}`
    : '';

  card.innerHTML = `
    <div class="gc-header">
      <div class="gc-emoji-wrap" style="background:${color}20">${g.emoji}</div>
      <div class="gc-info">
        <div class="gc-title">${esc(g.title)}</div>
        <div class="gc-meta">
          <span>${done}/${g.totalDays} ngày</span>
          ${missed>0?`<span class="gc-missed-badge">${missed} bỏ lỡ</span>`:''}
          <span style="color:var(--text3);font-size:10px">${endLabel}</span>
        </div>
      </div>
      <button class="gc-delete" title="Xoá">✕</button>
    </div>

    <div class="gc-progress-wrap">
      <div class="gc-progress-track">
        <div class="gc-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,${color},${barColor});box-shadow:0 0 ${4+Math.round(pct/8)}px ${color}55"></div>
      </div>
      <div class="gc-progress-row">
        <span class="gc-motivation-text">${motivation}</span>
        <span class="gc-pct-text" style="color:${barColor}">${pct}%</span>
      </div>
    </div>

    ${todayDay ? `<div class="gc-today-banner" style="border-color:${color}44;background:${color}08">
      <div class="gc-today-top">
        <span class="gc-today-tag" style="color:${color}">📅 Hôm nay — Ngày ${todayDay.dayIndex+1}</span>
        ${!todayDay.done
          ? `<button class="gc-today-tick" style="background:${color}">✓ Xong rồi!</button>`
          : `<span class="gc-today-done-tag">✅ Hoàn thành!</span>`}
      </div>
      <div class="gc-today-task-text">${todayDay.task||`<span style="color:var(--text3);font-style:italic">Chưa có kế hoạch — mở kế hoạch để thêm</span>`}</div>
    </div>` : ''}

    <button class="gc-toggle-days">
      <span class="gc-toggle-label">📋 Xem kế hoạch ${g.totalDays} ngày</span>
      <svg class="gc-toggle-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <div class="gc-days-list" style="display:none"></div>
  `;

  // Populate days list (real DOM — not innerHTML — for inputs)
  const daysList = card.querySelector('.gc-days-list');
  g.days.forEach(d => {
    daysList.appendChild(buildDayCard(d, g, todayStr, color));
  });

  // Toggle
  card.querySelector('.gc-toggle-days').addEventListener('click', ()=>{
    const open = daysList.style.display==='none';
    daysList.style.display = open ? '' : 'none';
    card.querySelector('.gc-toggle-label').textContent = open
      ? `📋 Ẩn kế hoạch`
      : `📋 Xem kế hoạch ${g.totalDays} ngày`;
    card.querySelector('.gc-toggle-arrow').style.transform = open ? 'rotate(180deg)' : '';
  });

  // Delete
  card.querySelector('.gc-delete').addEventListener('click', async()=>{
    if(!confirm(`Xoá mục tiêu "${g.title}"?`)) return;
    await apiGoals.del(g._id);
    card.style.cssText += 'opacity:0;transform:translateY(-8px);transition:all .3s;';
    setTimeout(()=>card.remove(), 300);
    toast('🗑 Đã xoá mục tiêu');
  });

  // Today tick
  card.querySelector('.gc-today-tick')?.addEventListener('click', async()=>{
    if(!todayDay) return;
    const wasDone = todayDay.done;
    const res = await apiGoals.toggleDay(g._id, todayDay.dayIndex);
    await loadGoals();
    if(!wasDone){
      const pts = res.pointsAwarded || 8;
      toast('✅ ' + MOTIVATIONS.start[Math.floor(Math.random()*MOTIVATIONS.start.length)] + ` +${pts}⭐`);
      showPointsToast(pts);
      updatePointsUI((_shopData.points||0) + pts);
      launchConfetti('medium');
      setTimeout(() => showMotivationOverlay(), 600);
      checkAndAwardBadges();
    } else {
      const pts = res.pointsDeducted || 8;
      toast(`↩️ Đã bỏ tích — trừ ${pts}⭐`);
      updatePointsUI(Math.max(0, (_shopData.points||0) - pts));
    }
  });

  return card;
}

function buildDayCard(d, g, todayStr, color){
  const isToday_  = d.date === todayStr;
  const isFuture  = d.date > todayStr;
  const [yr,mo,dy] = d.date.split('-');
  const VI_D = ['CN','T2','T3','T4','T5','T6','T7'];
  const dow  = new Date(d.date+'T00:00:00').getDay();

  const el = document.createElement('div');
  el.className = 'gc-day-card' +
    (d.done ? ' gdc-done' : '') +
    (d.missedAt&&!d.done ? ' gdc-missed' : '') +
    (isToday_ ? ' gdc-today' : '') +
    (isFuture ? ' gdc-future' : '');
  el.dataset.idx = d.dayIndex;

  if(d.done) el.style.cssText = `border-color:${color}55;background:${color}0a`;
  else if(isToday_) el.style.cssText = `border-color:${color}88;box-shadow:0 0 0 2px ${color}22`;

  // Left side
  const left = document.createElement('div');
  left.className = 'gdc-left';

  const dayNum = document.createElement('div');
  dayNum.className = 'gdc-day-num';
  dayNum.innerHTML = `<b ${isToday_?`style="color:${color}"`:''}">Ngày ${d.dayIndex+1}</b>
    ${isToday_?`<span class="gdc-today-tag" style="background:${color}22;color:${color}">Hôm nay</span>`:''}
    ${d.missedAt&&!d.done?`<span class="gdc-missed-tag">Bỏ lỡ</span>`:''}`;
  left.appendChild(dayNum);

  const dateEl = document.createElement('div');
  dateEl.className = 'gdc-date';
  dateEl.textContent = `${VI_D[dow]}, ${parseInt(dy)}/${parseInt(mo)}`;
  left.appendChild(dateEl);

  // Task — input for all days (not just future)
  const taskInput = document.createElement('input');
  taskInput.type = 'text';
  taskInput.className = 'gc-day-input';
  taskInput.placeholder = 'Kế hoạch ngày này...';
  taskInput.value = d.task || '';
  if(d.done) taskInput.disabled = true;
  let saveTimer;
  taskInput.addEventListener('input', ()=>{
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async()=>{
      await apiGoals.updateDay(g._id, d.dayIndex, { task: taskInput.value.trim() });
    }, 700);
  });
  left.appendChild(taskInput);
  el.appendChild(left);

  // Right side — check button
  const right = document.createElement('div');
  right.className = 'gdc-right';

  if(!isFuture){
    const checkBtn = document.createElement('button');
    checkBtn.className = 'gc-day-check-btn' + (d.done ? ' gdc-checked' : '');
    if(d.done) checkBtn.style.cssText = `background:${color};border-color:${color}`;
    checkBtn.innerHTML = d.done
      ? `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5.5 10L11 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : '';
    checkBtn.title = d.done ? 'Đánh dấu chưa xong' : 'Đánh dấu xong';
    checkBtn.addEventListener('click', async()=>{
      const wasDone = d.done;
      const res = await apiGoals.toggleDay(g._id, d.dayIndex);
      await loadGoals();
      if(!wasDone){
        const pts = res.pointsAwarded || 8;
        toast('✅ ' + MOTIVATIONS.start[Math.floor(Math.random()*MOTIVATIONS.start.length)] + ` +${pts}⭐`);
        showPointsToast(pts);
        updatePointsUI((_shopData.points||0) + pts);
        launchConfetti('medium');
        setTimeout(() => showMotivationOverlay(), 600);
        checkAndAwardBadges();
      } else {
        const pts = res.pointsDeducted || 8;
        toast(`↩️ Đã bỏ tích — trừ ${pts}⭐`);
        updatePointsUI(Math.max(0, (_shopData.points||0) - pts));
      }
    });
    right.appendChild(checkBtn);
  } else {
    const dot = document.createElement('div');
    dot.className = 'gdc-future-dot';
    right.appendChild(dot);
  }
  el.appendChild(right);

  return el;
}

// ── GOAL TEMPLATES ──
const GOAL_TEMPLATES = [
  { emoji:'📚', title:'30 ngày rèn luyện tiếng Anh',       days:30, color:'#5ee8f0', desc:'Học từ vựng, luyện nghe & nói mỗi ngày' },
  { emoji:'🌙', title:'30 ngày ngủ sớm trước 23h',          days:30, color:'#b07fff', desc:'Ngủ đúng giờ, dậy sớm tràn đầy năng lượng' },
  { emoji:'🏃', title:'30 ngày tập thể dục mỗi ngày',       days:30, color:'#5ef0a0', desc:'Vận động ít nhất 30 phút, cơ thể khỏe mạnh' },
  { emoji:'🥗', title:'7 ngày ăn uống giảm cân',            days:7,  color:'#3ddbb8', desc:'Ăn lành mạnh, hạn chế đồ chiên rán & ngọt' },
  { emoji:'💧', title:'30 ngày uống đủ 2L nước mỗi ngày',   days:30, color:'#5ee8f0', desc:'Giữ cơ thể đủ nước, da đẹp & sức khỏe tốt' },
  { emoji:'📖', title:'21 ngày đọc sách mỗi ngày',          days:21, color:'#ffcf5c', desc:'Ít nhất 20 trang sách mỗi ngày' },
  { emoji:'🧘', title:'21 ngày thiền định buổi sáng',        days:21, color:'#ff85c8', desc:'10 phút thiền mỗi sáng, tâm trí bình an' },
  { emoji:'💻', title:'30 ngày học lập trình',               days:30, color:'#ffa048', desc:'Code mỗi ngày, xây dựng dự án thực tế' },
  { emoji:'✍️', title:'30 ngày viết nhật ký',                days:30, color:'#b07fff', desc:'Ghi lại cảm xúc và suy nghĩ mỗi ngày' },
  { emoji:'🎨', title:'30 ngày học vẽ',                      days:30, color:'#ff85c8', desc:'Vẽ mỗi ngày, cải thiện kỹ năng từng bước' },
  { emoji:'🌱', title:'30 ngày không dùng mạng xã hội',      days:30, color:'#5ef0a0', desc:'Tập trung vào cuộc sống thực, giảm stress' },
  { emoji:'💪', title:'21 ngày thách thức bản thân',         days:21, color:'#ff6b8a', desc:'Xây dựng thói quen tốt trong 21 ngày liên tiếp' },
  { emoji:'🎵', title:'30 ngày luyện nhạc cụ',               days:30, color:'#ffa048', desc:'Tập đàn/hát mỗi ngày, tiến bộ từng chút một' },
  { emoji:'🛌', title:'7 ngày ngủ đủ 8 tiếng',               days:7,  color:'#b07fff', desc:'Ngủ đúng giờ, đủ giấc để não bộ phục hồi' },
  { emoji:'🍳', title:'14 ngày tự nấu ăn ở nhà',             days:14, color:'#ffcf5c', desc:'Ăn nhà lành mạnh hơn, tiết kiệm tiền bạc' },
  { emoji:'📝', title:'30 ngày học kỹ năng mới',             days:30, color:'#3ddbb8', desc:'Dành 1 tiếng mỗi ngày cho kỹ năng mới' },
];

// ── INIT GOALS ──
function initGoals(){
  const createBtn = document.getElementById('goal-create-btn');
  const modal     = document.getElementById('goal-modal-overlay');
  const step1     = document.getElementById('goal-step-1');
  const step2     = document.getElementById('goal-step-2');

  let selEmoji = '🎯', selColor = '#b07fff';
  let pendingDayTasks = []; // array of task strings per day

  function closeModal(){
    modal.style.display='none';
    step1.style.display=''; step2.style.display='none';
    document.getElementById('goal-title').value='';
    document.getElementById('goal-days').value='7';
    document.getElementById('goal-startdate').value='';
    document.querySelectorAll('.days-preset').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.gts-chip').forEach(c=>c.classList.remove('gts-active'));
    pendingDayTasks=[];
  }

  // Set default start date = today
  const sdInput = document.getElementById('goal-startdate');
  if(sdInput) sdInput.value = tds(state.today);

  // Build template grid
  const tplGrid = document.getElementById('goal-templates-grid');
  if(tplGrid){
    GOAL_TEMPLATES.forEach(tpl => {
      const chip = document.createElement('button');
      chip.className = 'gts-chip';
      chip.style.setProperty('--tpl-color', tpl.color);
      chip.innerHTML = `<span class="gts-chip-emoji">${tpl.emoji}</span><span class="gts-chip-text"><b>${tpl.title}</b><small>${tpl.days} ngày · ${tpl.desc}</small></span>`;
      chip.addEventListener('click', () => {
        // Fill form fields
        document.getElementById('goal-title').value = tpl.title;
        document.getElementById('goal-days').value  = tpl.days;
        // Activate day preset button if matching
        document.querySelectorAll('.days-preset').forEach(b => {
          b.classList.toggle('active', parseInt(b.dataset.d) === tpl.days);
        });
        // Select emoji
        let emojiFound = false;
        document.querySelectorAll('.goal-ep').forEach(ep => {
          const match = ep.dataset.e === tpl.emoji;
          ep.classList.toggle('selected', match);
          if(match){ selEmoji = tpl.emoji; emojiFound = true; }
        });
        if(!emojiFound){ selEmoji = tpl.emoji; } // emoji not in grid, just store it
        // Select color
        let colorFound = false;
        document.querySelectorAll('.goal-color').forEach(cp => {
          const match = cp.dataset.c === tpl.color;
          cp.classList.toggle('selected', match);
          if(match){ selColor = tpl.color; colorFound = true; }
        });
        if(!colorFound){ selColor = tpl.color; }
        // Highlight selected chip
        tplGrid.querySelectorAll('.gts-chip').forEach(c => c.classList.remove('gts-active'));
        chip.classList.add('gts-active');
        // Scroll to form
        document.getElementById('goal-title').scrollIntoView({ behavior:'smooth', block:'center' });
        document.getElementById('goal-title').focus();
      });
      tplGrid.appendChild(chip);
    });
  }

  createBtn?.addEventListener('click', ()=>{
    if(sdInput) sdInput.value = tds(state.today);
    modal.style.display='flex';
    // Reset template selection
    tplGrid?.querySelectorAll('.gts-chip').forEach(c => c.classList.remove('gts-active'));
    document.getElementById('goal-title').focus();
  });

  // Close buttons
  ['goal-modal-close','goal-modal-close2','goal-modal-cancel','goal-step2-cancel'].forEach(id=>{
    document.getElementById(id)?.addEventListener('click', closeModal);
  });
  modal?.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });

  // Day presets
  document.querySelectorAll('.days-preset').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.days-preset').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('goal-days').value = btn.dataset.d;
    });
  });

  // Emoji picker
  document.querySelectorAll('.goal-ep').forEach(ep=>{
    ep.addEventListener('click',()=>{
      document.querySelectorAll('.goal-ep').forEach(e=>e.classList.remove('selected'));
      ep.classList.add('selected'); selEmoji = ep.dataset.e;
    });
  });

  // Color picker
  document.querySelectorAll('.goal-color').forEach(cp=>{
    cp.addEventListener('click',()=>{
      document.querySelectorAll('.goal-color').forEach(c=>c.classList.remove('selected'));
      cp.classList.add('selected'); selColor = cp.dataset.c;
    });
  });

  // Step 1 → Step 2: show day plan inputs
  document.getElementById('goal-step1-next')?.addEventListener('click', ()=>{
    const title     = document.getElementById('goal-title').value.trim();
    const totalDays = parseInt(document.getElementById('goal-days').value);
    const startDate = document.getElementById('goal-startdate').value;
    if(!title){ toast('⚠ Nhập tên mục tiêu!'); return; }
    if(!totalDays||totalDays<1){ toast('⚠ Chọn số ngày!'); return; }
    if(!startDate){ toast('⚠ Chọn ngày bắt đầu!'); return; }

    // Build day list for step 2
    pendingDayTasks = Array(totalDays).fill('');
    document.getElementById('goal-step2-title').textContent = `${selEmoji} ${title}`;
    document.getElementById('gs2-subtitle').textContent =
      `${totalDays} ngày · Bắt đầu ${parseInt(startDate.split('-')[2])}/${parseInt(startDate.split('-')[1])}/${startDate.split('-')[0]}`;

    const daysList = document.getElementById('gs2-days-list');
    daysList.innerHTML = '';
    const VI_D = ['CN','T2','T3','T4','T5','T6','T7'];
    for(let i=0; i<totalDays; i++){
      const d = new Date(startDate+'T00:00:00');
      d.setDate(d.getDate()+i);
      const dow = d.getDay();
      const ds  = tds(d);
      const isToday_ = ds===tds(state.today);

      const row = document.createElement('div');
      row.className = 'gs2-day-row' + (isToday_?' gs2-today':'');
      row.style.borderLeftColor = selColor;

      const label = document.createElement('div');
      label.className = 'gs2-day-label';
      label.innerHTML = `<span class="gs2-day-num" style="${isToday_?`color:${selColor}`:''}">Ngày ${i+1}</span>
        <span class="gs2-day-date">${VI_D[dow]}, ${d.getDate()}/${d.getMonth()+1}${isToday_?' · Hôm nay':''}</span>`;

      const input = document.createElement('input');
      input.type='text'; input.className='gs2-day-input';
      input.placeholder=`Kế hoạch ngày ${i+1}...`;
      input.maxLength=200;
      const idx=i;
      input.addEventListener('input', ()=>{ pendingDayTasks[idx]=input.value; });
      input.addEventListener('keydown', e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          const next=daysList.querySelectorAll('.gs2-day-input')[idx+1];
          next?.focus();
        }
      });

      row.append(label,input);
      daysList.appendChild(row);
    }

    step1.style.display='none';
    step2.style.display='';
    daysList.querySelector('.gs2-day-input')?.focus();
  });

  // Back to step 1
  document.getElementById('goal-step2-back')?.addEventListener('click',()=>{
    step2.style.display='none'; step1.style.display='';
  });

  // Submit
  document.getElementById('goal-step2-submit')?.addEventListener('click', async()=>{
    const title     = document.getElementById('goal-title').value.trim();
    const totalDays = parseInt(document.getElementById('goal-days').value);
    const startDate = document.getElementById('goal-startdate').value;
    const submitBtn = document.getElementById('goal-step2-submit');
    submitBtn.disabled=true; submitBtn.textContent='Đang tạo...';
    try{
      const res = await fetch('/api/goals',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title, emoji:selEmoji, color:selColor, totalDays, startDate, dayTasks: pendingDayTasks }),
        credentials:'include'
      });
      const data = await res.json();
      if(!res.ok){ toast('❌ '+(data.error||'Có lỗi xảy ra')); throw new Error(data.error); }
      closeModal();
      await loadGoals();
      toast(`🎯 Đã tạo "${title}"! Hãy bắt đầu hành trình!`);
    }catch(e){ console.error(e); }
    submitBtn.disabled=false; submitBtn.textContent='Tạo mục tiêu 🎯';
  });

  loadGoals();
  if('Notification' in window && Notification.permission==='default') Notification.requestPermission();
}

// Daily notification
function checkGoalNotifications(goals){
  if(!('Notification' in window)||Notification.permission!=='granted') return;
  const todayStr=tds(state.today);
  goals.forEach(g=>{
    const todayDay=g.days.find(d=>d.date===todayStr);
    if(todayDay&&!todayDay.done){
      const msg=MOTIVATIONS.daily[Math.floor(Math.random()*MOTIVATIONS.daily.length)];
      new Notification(`🎯 ${g.emoji} ${g.title}`,{
        body:`Hôm nay: ${todayDay.task||'Chưa có kế hoạch'}\n${msg}`,icon:'/favicon.ico'
      });
    }
  });
}

// ═══════════════════════════════════════════
// SHOP & PET SYSTEM
// ═══════════════════════════════════════════

const apiShop = {
  points:      ()       => API.g('/api/shop/points'),
  catalog:     ()       => API.g('/api/shop/catalog'),
  buyPet:      (type)   => API.p('/api/shop/buy-pet', { type }),
  buyItem:     (id,qty) => API.p('/api/shop/buy-item', { itemId: id, qty }),
  buyFreeze:   ()       => API.p('/api/shop/buy-freeze', {}),
  activateFreeze: ()    => API.p('/api/shop/activate-freeze', {}),
  pets:        ()       => API.g('/api/shop/pets'),
  care:        (petId, action) => API.p('/api/shop/care', { petId, action }),
  badgesCatalog: ()     => API.g('/api/shop/badges-catalog'),
  checkBadges: (stats)  => API.p('/api/shop/check-badges', { stats }),
  addPoints:   (amt)    => API.p('/api/shop/add-points', { amount: amt }),
};

let _shopInited = false;
let _shopData = { points:0, food:0, meat:0, fish:0, seed:0, treat:0, water:0, fertilizer:0, streakFreezes:0, badges:[] };

// Update points display everywhere
function updatePointsUI(pts) {
  if (pts !== undefined) _shopData.points = pts;
  const hdr = document.getElementById('header-points-val');
  const shop = document.getElementById('shop-points-value');
  if (hdr) hdr.textContent = _shopData.points;
  if (shop) shop.textContent = _shopData.points;
}

function updateInventoryUI() {
  const ids = { food:'inv-food', meat:'inv-meat', fish:'inv-fish', seed:'inv-seed', treat:'inv-treat', water:'inv-water', fertilizer:'inv-fert', streakFreezes:'inv-freeze' };
  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = _shopData[key] || 0;
  }
  // Freeze badge in header
  updateFreezeBadge();
  // Sync global inventory shelf
  renderInventoryShelf();
}

function updateFreezeBadge() {
  const badge = document.getElementById('header-freeze-badge');
  if (!badge) return;
  if (_shopData.freezeActive && _shopData.freezeActiveUntil) {
    badge.style.display = 'flex';
    const updateTimer = () => {
      const now = new Date();
      const until = new Date(_shopData.freezeActiveUntil);
      const diff = until - now;
      if (diff <= 0) {
        badge.style.display = 'none';
        _shopData.freezeActive = false;
        clearInterval(badge._timerInterval);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      document.getElementById('header-freeze-timer').textContent = `${h}h${m}m`;
      badge.title = `Freeze: còn ${h} giờ ${m} phút`;
    };
    updateTimer();
    clearInterval(badge._timerInterval);
    badge._timerInterval = setInterval(updateTimer, 60000);
  } else {
    badge.style.display = 'none';
  }
}

// ── Points toast (floating +X) ──
let _ptsToastEl;
function showPointsToast(pts) {
  if (!_ptsToastEl) {
    _ptsToastEl = document.createElement('div');
    _ptsToastEl.className = 'points-toast';
    document.body.appendChild(_ptsToastEl);
  }
  _ptsToastEl.textContent = `+${pts} ⭐`;
  _ptsToastEl.classList.add('show');
  setTimeout(() => _ptsToastEl.classList.remove('show'), 1800);
}

// ── CONFETTI ──
function launchConfetti(intensity = 'medium') {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const counts = { low: 30, medium: 60, high: 120 };
  const count = counts[intensity] || 60;
  const colors = ['#b07fff','#ff85c8','#5ef0a0','#ffcf5c','#5ee8f0','#ff6b8a','#ffa048','#3ddbb8'];
  const pieces = [];

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      w: Math.random() * 8 + 4,
      h: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      if (p.opacity <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.rotSpeed;
      if (p.y > canvas.height) p.opacity -= 0.02;
      if (frame > 60) p.opacity -= 0.01;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 200) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

// ── SHOP INIT ──
async function initShop() {
  if (_shopInited) return;
  _shopInited = true;

  await loadShopData();
  await loadStoreCatalog();
}

async function loadShopData() {
  try {
    const data = await apiShop.points();
    _shopData = { ...data };
    updatePointsUI(data.points);
    updateInventoryUI();
  } catch(e) { console.error('loadShopData:', e); }
}

// Also load freeze info on initial points load


// Pet/plant feature descriptions for shop
const SHOP_FEATURES = {
  rabbit:  '🐰 Thỏ Bông sẽ nhảy nhót trên màn hình. Cho ăn cà rốt, thịt, hoặc bánh. Nhấn vào để nghe thỏ nói chuyện dễ thương!',
  cat:     '🐱 Mèo Mướp sẽ đi loanh quanh. Cho ăn cá, thịt. Nhấn vào để nghe meo meo nũng nịu!',
  dog:     '🐶 Cún Con chạy nhảy vui vẻ. Cho ăn thịt, bánh. Nhấn vào để chơi cùng cún!',
  hamster: '🐹 Hamster tròn lăn chạy khắp nơi. Cho ăn hạt giống, bánh. Nhấn để xem má phúng phính!',
  bird:    '🐦 Chim Non bay lượn trên màn hình. Cho ăn hạt, bánh. Nhấn để nghe chim hót!',
  tree:    '🌲 Cây Kim Tiền hút tài lộc. Nhấn vào để thấy tiền vàng rụng xuống! Tưới nước & bón phân hàng ngày.',
  kim_ngan:'🌳 Cây Kim Ngân tượng trưng giàu có. Nhấn vào thấy vàng bạc rơi! Tưới nước & bón phân.',
  ngoc_bich:'🪴 Cây Ngọc Bích mang lại hòa hợp. Nhấn thấy ngọc quý rụng! Tưới nước & bón phân.',
  flower:  '🎋 Cây Phát Tài chiêu phú quý. Nhấn thấy may mắn tỏa sáng! Tưới nước & bón phân.',
  van_loc: '🌺 Cây Vạn Lộc mang thịnh vượng. Nhấn thấy hoa may mắn rơi! Tưới nước & bón phân.',
  tree2:   '🌵 Cây Sen Đá cho sức khỏe. Nhấn thấy trái tim & sức khỏe rụng! Tưới nước & bón phân.',
  flower2: '🌼 Hoa Mai mang may mắn cả năm. Nhấn thấy cánh mai vàng rơi! Tưới nước & bón phân.',
  flower3: '🌺 Hoa Lan thanh cao sang trọng. Nhấn thấy cánh lan & vương miện rơi! Tưới nước & bón phân.',
};

function makeStoreCard(p) {
  const card = document.createElement('div');
  card.className = 'store-card';
  const feature = SHOP_FEATURES[p.type] || '';
  card.innerHTML = `
    <div class="store-emoji">${p.emoji}</div>
    <div class="store-name">${p.name}</div>
    <div class="store-desc">${p.desc}</div>
    ${feature ? `<button class="store-detail-toggle">ℹ️ Chi tiết</button><div class="store-detail"><div class="store-how">${feature}</div></div>` : ''}
    <button class="store-price" data-type="${p.type}">⭐ ${p.price} điểm</button>
  `;
  const detailToggle = card.querySelector('.store-detail-toggle');
  if (detailToggle) {
    detailToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const detail = card.querySelector('.store-detail');
      const isOpen = detail.classList.toggle('open');
      detailToggle.textContent = isOpen ? '▲ Ẩn chi tiết' : 'ℹ️ Chi tiết';
    });
  }
  card.querySelector('.store-price').addEventListener('click', async () => {
    try {
      const res = await apiShop.buyPet(p.type);
      updatePointsUI(res.points);
      toast(`🎉 Bạn đã mua ${p.name}!`);
      launchConfetti('medium');
      await loadMyPets();
      await loadShopData();
      checkAndAwardBadges();
    } catch(e) { toast('❌ ' + (e.message || 'Không đủ điểm!')); }
  });
  return card;
}

// ── STORE CATALOG ──
async function loadStoreCatalog() {
  try {
    const { pets, items, streakFreezePrice } = await apiShop.catalog();

    // Animals
    const aGrid = document.getElementById('store-animals-grid');
    aGrid.innerHTML = '';
    pets.filter(p => p.category === 'animal').forEach(p => {
      aGrid.appendChild(makeStoreCard(p));
    });

    // Plants
    const plGrid = document.getElementById('store-plants-grid');
    plGrid.innerHTML = '';
    pets.filter(p => p.category === 'plant').forEach(p => {
      plGrid.appendChild(makeStoreCard(p));
    });

    // Items with detail descriptions
    const iGrid = document.getElementById('store-items-grid');
    iGrid.innerHTML = '';
    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'store-card';
      card.innerHTML = `
        <div class="store-emoji">${it.emoji}</div>
        <div class="store-name">${it.name}</div>
        <div class="store-desc">${it.desc}</div>
        ${it.detail ? `<button class="store-detail-toggle">ℹ️ Chi tiết</button><div class="store-detail"><div class="store-how">${it.detail}</div></div>` : ''}
        <button class="store-price" data-item="${it.id}">⭐ ${it.price} điểm</button>
      `;
      const itemToggle = card.querySelector('.store-detail-toggle');
      if (itemToggle) {
        itemToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const detail = card.querySelector('.store-detail');
          const isOpen = detail.classList.toggle('open');
          itemToggle.textContent = isOpen ? '▲ Ẩn chi tiết' : 'ℹ️ Chi tiết';
        });
      }
      card.querySelector('.store-price').addEventListener('click', async () => {
        try {
          const res = await apiShop.buyItem(it.id, 1);
          updatePointsUI(res.points);
          _shopData[it.id] = res[it.id];
          updateInventoryUI();
          toast(`✅ Đã mua ${it.name}!`);
        } catch(e) { toast('❌ ' + (e.message || 'Không đủ điểm!')); }
      });
      iGrid.appendChild(card);
    });

    // Streak freeze
    const sGrid = document.getElementById('store-special-grid');
    sGrid.innerHTML = '';
    const fCard = document.createElement('div');
    fCard.className = 'store-card';
    fCard.innerHTML = `
      <div class="store-emoji">❄️</div>
      <div class="store-name">Streak Freeze</div>
      <div class="store-desc">Bảo vệ streak & thú cưng 24h khi bạn không thể dùng app</div>
      <button class="store-detail-toggle">ℹ️ Chi tiết</button>
      <div class="store-detail"><div class="store-how">Mua thẻ freeze rồi vào Hồ sơ để kích hoạt. Khi hoạt động, streak sẽ không bị mất và thú cưng sẽ không bị coi là bị bỏ rơi trong 24h. Icon ❄️ sẽ hiện trên thanh menu.</div></div>
      <button class="store-price">⭐ ${streakFreezePrice} điểm</button>
    `;
    const fToggle = fCard.querySelector('.store-detail-toggle');
    fToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const detail = fCard.querySelector('.store-detail');
      const isOpen = detail.classList.toggle('open');
      fToggle.textContent = isOpen ? '▲ Ẩn chi tiết' : 'ℹ️ Chi tiết';
    });
    fCard.querySelector('.store-price').addEventListener('click', async () => {
      try {
        const res = await apiShop.buyFreeze();
        updatePointsUI(res.points);
        _shopData.streakFreezes = res.streakFreezes;
        updateInventoryUI();
        toast('❄️ Đã mua Streak Freeze!');
      } catch(e) { toast('❌ ' + (e.message || 'Không đủ điểm!')); }
    });
    sGrid.appendChild(fCard);

  } catch(e) { console.error('loadStoreCatalog:', e); }
}

// ── PET DIALOGUE SYSTEM ──
const PET_DIALOGUES = {
  rabbit: {
    idle: ['Chủ nhân ơi~ 🥺','Cho con ăn cà rốt đi~','Con yêu chủ nhân lắm!','Nhảy nhảy~ 🐇','Chủ nhân hôm nay đẹp quá!','Con đói bụng rồi~','Chủ nhân làm task chưa?','*nhảy lên nhảy xuống*','Con nhớ chủ nhân quá!','Hôm nay vui không chủ nhân?','Ôm con đi~ 💕','*giật giật tai*','Con thích ở bên chủ nhân!','Chủ nhân giỏi quá!','*nằm lăn ra sàn*','Con muốn được vuốt ve~','Chủ nhân cố lên nha!','Hehe~ con dễ thương không?'],
    feed: ['Ngon quá chủ nhân!','Yummy~ 🥕','Con thích lắm!','Cảm ơn chủ nhân~','No bụng rồi nè!','*nhai nhai* Giòn quá!','Chủ nhân tuyệt nhất!','Con ăn hết sạch luôn~','*hạnh phúc* Ngon lắm!','Cà rốt của chủ nhân ngon nhất!'],
    water: ['Khát nước quá~','Mát quá chủ nhân!','Uống ngon lắm~','Cảm ơn nha!','*uống ừng ực*','Sảng khoái~','Nước mát quá!','Con khỏe lại rồi!']
  },
  cat: {
    idle: ['Meow~ chủ nhân 🐱','Con muốn được vuốt ve~','Meo meo~ ngủ thôi~','Chủ nhân đâu rồi?','*cuộn tròn nằm ngủ*','Con lười quá hà~','*cào cào đồ vật*','Purr purr~ 💤','Chủ nhân có nhớ con không?','*vươn vai ngáp*','Con muốn chơi cuộn len!','Meo~ gãi cằm cho con~','*nằm phơi nắng*','Chủ nhân ơi vuốt con đi~','*đuổi theo bóng*','Meo~ con buồn ngủ~','Chủ nhân làm việc giỏi quá!','*kêu ré ré đòi ăn*'],
    feed: ['Nyam nyam~ 😺','Cá ngon quá!','Chủ nhân tuyệt vời!','Meo~ thêm nữa đi~','Purr purr~','*ăn ngon lành*','Con no rồi~ purr~','Chủ nhân nấu ăn giỏi quá!','*liếm mép*','Meo yêu chủ nhân!'],
    water: ['Sữa ngon~','Lap lap~ 💧','Mát rồi~','Meow cảm ơn!','*uống từ từ*','Sữa tươi! Yummy~','Con thích lắm~','Purr~ mát quá!']
  },
  dog: {
    idle: ['Gâu gâu! Chủ nhân! 🐕','Con vui quá! *vẫy đuôi*','Đi chơi không chủ nhân?','Woof woof~!','Con nhớ chủ nhân!','*liếm tay chủ nhân*','Chủ nhân về rồi! *nhảy cẫng*','*ngoáy đuôi điên cuồng*','Con muốn đi dạo!','Chủ nhân ném bóng cho con~','*nằm lăn ra đòi xoa bụng*','Gâu! Yêu chủ nhân!','*chạy vòng vòng*','Chủ nhân là nhất! Woof!','*đặt chân lên tay chủ nhân*','Con trung thành lắm!','Gâu gâu~ chơi với con đi!','*cọ đầu vào chân chủ nhân*'],
    feed: ['Gâu! Ngon quá! 🦴','*ăn ngấu nghiến*','Con yêu chủ nhân nhất!','Woof! Thêm nữa~','Ngon tuyệt vời!','*vẫy đuôi lia lịa*','Xương ngon quá!','Con hạnh phúc quá!','*ăn sạch sành sanh*','Gâu! Chủ nhân là chef giỏi nhất!'],
    water: ['*uống ừng ực*','Sảng khoái! 💧','Gâu! Mát quá!','Cảm ơn chủ nhân!','*liếm nước tung tóe*','Woof! Đã khát!','Mát lắm chủ nhân!','*vẫy đuôi uống nước*']
  },
  hamster: {
    idle: ['Chít chít~ 🐹','*nhét hạt vào má*','Con tròn không chủ nhân?','Chạy vòng vòng~','Chủ nhân ôm con đi!','*má phúng phính*','*chạy trên bánh xe*','Con đang tập thể dục!','Chủ nhân cho con hạt đi~','*ngồi rửa mặt*','Con nhỏ nhưng ăn nhiều!','*nằm cuộn tròn ngủ*','Chít! Chủ nhân dễ thương!','*leo lên vai chủ nhân*','Hạt hướng dương đâu~?','Con muốn chui vào túi!','*phồng má nhìn chủ nhân*','Chít chít! Yêu chủ nhân!'],
    feed: ['Hạt ngon quá! 🌻','*nhét thêm vào má*','Con ăn hết rồi~','Chít chít! Ngon!','Cảm ơn chủ nhân!','*má căng phồng*','Giòn giòn! Yummy!','Con để dành ăn sau~','*nhai nhanh nhai nhanh*','Chủ nhân tốt quá!'],
    water: ['Uống tí nước~','Mát quá!','Chít~ ngon!','Cảm ơn nha!','*uống từng ngụm nhỏ*','Sảng khoái!','Con khỏe rồi!','Nước trong quá!']
  },
  bird: {
    idle: ['Chiêm chiếp~ 🐦','*vỗ cánh*','Hót cho chủ nhân nghe nè!','Chip chip~!','Con muốn bay!','*nghiêng đầu nhìn*','*đậu trên vai chủ nhân*','Chiếp! Hôm nay đẹp trời!','Con hát bài gì cho chủ nhân?','*nhảy nhảy trên cành*','Chủ nhân nghe con hót nè~','*rỉa lông*','Chip! Yêu chủ nhân!','*bay vòng vòng quanh đầu*','Con muốn ra ngoài chơi!','Chiếp chiếp! Vui quá!','*đứng một chân nhìn xa*','Chủ nhân cố gắng lên nha!'],
    feed: ['Chiếp! Ngon! 🌾','*mổ mổ ăn*','Con thích hạt này!','Chip chip! Yummy~','Cảm ơn chủ nhân!','*ăn từng hạt một*','Ngon lắm ngon lắm!','Con no rồi~ chiếp!','*sung sướng vỗ cánh*','Chủ nhân là nhất!'],
    water: ['Chip~ uống nước!','*tắm nước*','Mát quá!','Chiếp chiếp!','*vẩy nước tung tóe*','Sạch sẽ rồi!','Con thích tắm!','*rũ lông phơi khô*']
  }
};

// ── PLANT DROP EFFECTS ──
// Kim Tiền: hút tài lộc → rụng tiền vàng
// Kim Ngân: giàu có → rụng tiền, vàng
// Ngọc Bích: tiền bạc & hòa hợp → rụng ngọc, đá quý
// Phát Tài: may mắn, phú quý → rụng vàng, may mắn
// Vạn Lộc: may mắn, thịnh vượng → rụng hoa, sao may mắn
// Sen Đá: sức khỏe, bình an → rụng trái tim, sức khỏe
// Hoa Mai: may mắn cả năm → rụng cánh mai vàng
// Hoa Lan: thanh cao, sang trọng → rụng cánh lan, vương miện
const PLANT_DROP_CONFIG = {
  tree:      { items: ['💰','🪙','💵','💴','🤑','✨'], name: 'Kim Tiền — Tài Lộc', special: '💰' },
  kim_ngan:  { items: ['💰','💵','💴','🪙','🏆','💎'], name: 'Kim Ngân — Giàu Có', special: '💵' },
  ngoc_bich: { items: ['💎','💚','🔮','✨','🌿','💠'], name: 'Ngọc Bích — Hòa Hợp', special: '💎' },
  flower:    { items: ['🏅','🎖️','⭐','✨','💫','🌟'], name: 'Phát Tài — Phú Quý', special: '🏅' },
  van_loc:   { items: ['🌟','⭐','🍀','🎊','🎉','✨'], name: 'Vạn Lộc — Thịnh Vượng', special: '🍀' },
  tree2:     { items: ['❤️','💪','🧘','💚','🌿','✨'], name: 'Sen Đá — Sức Khỏe', special: '❤️' },
  flower2:   { items: ['🌼','⭐','🎊','🧧','✨','🌟'], name: 'Hoa Mai — May Mắn', special: '🧧' },
  flower3:   { items: ['👑','🎓','📚','🏛️','✨','💜'], name: 'Hoa Lan — Thanh Cao', special: '👑' },
};

function createDropParticles(container, plantType) {
  const config = PLANT_DROP_CONFIG[plantType] || { items: ['🍃','🌿'], special: '🍃' };
  const particleContainer = document.createElement('div');
  particleContainer.className = 'drop-particles';
  container.style.position = 'relative';
  container.appendChild(particleContainer);

  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'drop-particle';
    const isSpecial = Math.random() < 0.3;
    particle.textContent = isSpecial ? config.special : config.items[Math.floor(Math.random() * config.items.length)];
    const dx = (Math.random() - 0.5) * 120;
    const rot = (Math.random() - 0.5) * 720;
    particle.style.setProperty('--dx', dx + 'px');
    particle.style.setProperty('--rot', rot + 'deg');
    particle.style.animationDelay = (Math.random() * 0.3) + 's';
    particle.style.fontSize = isSpecial ? '20px' : (12 + Math.random() * 8) + 'px';
    particleContainer.appendChild(particle);
  }

  setTimeout(() => particleContainer.remove(), 2000);
}

function createFeedHearts(container) {
  const heartContainer = document.createElement('div');
  heartContainer.className = 'feed-hearts';
  container.style.position = 'relative';
  container.appendChild(heartContainer);

  const hearts = ['❤️','💕','💖','💗','🩷','✨'];
  for (let i = 0; i < 6; i++) {
    const heart = document.createElement('div');
    heart.className = 'feed-heart';
    heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    heart.style.setProperty('--hx', ((Math.random() - 0.5) * 80) + 'px');
    heart.style.animationDelay = (Math.random() * 0.4) + 's';
    heartContainer.appendChild(heart);
  }

  setTimeout(() => heartContainer.remove(), 1600);
}

// Favorite food per pet type (matches backend FAVORITE_FOOD)
const FAVORITE_FOOD = {
  rabbit:'food', cat:'fish', dog:'meat', hamster:'seed', bird:'seed',
  tree:'fertilizer', kim_ngan:'fertilizer', ngoc_bich:'fertilizer',
  flower:'fertilizer', van_loc:'fertilizer', tree2:'fertilizer',
  flower2:'fertilizer', flower3:'fertilizer',
};

const ITEM_INFO = {
  food:       { emoji:'🥕', label:'Cà rốt' },
  meat:       { emoji:'🥩', label:'Thịt' },
  fish:       { emoji:'🐟', label:'Cá' },
  seed:       { emoji:'🌻', label:'Hạt' },
  treat:      { emoji:'🍪', label:'Bánh' },
  water:      { emoji:'💧', label:'Nước' },
  fertilizer: { emoji:'🌿', label:'Phân bón' },
};

// Pet mood expressions - expanded diverse set
const PET_MOODS = {
  rabbit: {
    default:'🐰', happy:'🐇', love:'😍', eating:'😋',
    fav_food:'🥰', satisfied:'😊', greedy:'🤤', excited:'🤩',
    sleepy:'😴', surprised:'😲', shy:'🙈', water:'😌',
  },
  cat: {
    default:'🐱', happy:'😸', love:'😻', eating:'😋',
    fav_food:'😻', satisfied:'😼', greedy:'😺', excited:'🙀',
    sleepy:'😴', surprised:'🙀', shy:'🙈', water:'😊',
  },
  dog: {
    default:'🐶', happy:'🐕', love:'🥰', eating:'😋',
    fav_food:'🤩', satisfied:'😊', greedy:'🤤', excited:'🤩',
    sleepy:'😴', surprised:'😮', shy:'🙈', water:'😄',
  },
  hamster: {
    default:'🐹', happy:'🐹', love:'🥰', eating:'😋',
    fav_food:'🥰', satisfied:'😊', greedy:'🤤', excited:'🤩',
    sleepy:'😴', surprised:'😲', shy:'🙈', water:'😌',
  },
  bird: {
    default:'🐤', happy:'🐦', love:'🥰', eating:'😋',
    fav_food:'🎵', satisfied:'🦜', greedy:'🤤', excited:'🤩',
    sleepy:'😴', surprised:'😲', shy:'🙈', water:'😊',
  },
};

function setPetMood(card, petType, mood) {
  const moods = PET_MOODS[petType];
  if (!moods) return;
  const emojiEl = card.querySelector('.pet-emoji');
  if (!emojiEl) return;
  const moodEmoji = moods[mood] || moods.default;
  emojiEl.textContent = moodEmoji;
  // Reset to default after 4 seconds
  clearTimeout(emojiEl._moodTimer);
  if (mood !== 'default') {
    emojiEl._moodTimer = setTimeout(() => {
      emojiEl.textContent = moods.default;
    }, 4000);
  }
}

function showPetDialogue(card, petType, context = 'idle') {
  const dialogues = PET_DIALOGUES[petType];
  if (!dialogues) return;
  const msgs = dialogues[context] || dialogues.idle;
  const msg = msgs[Math.floor(Math.random() * msgs.length)];

  let bubble = card.querySelector('.pet-dialogue');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'pet-dialogue';
    card.appendChild(bubble);
  }
  bubble.textContent = msg;
  bubble.classList.add('show');
  clearTimeout(bubble._hideTimer);
  bubble._hideTimer = setTimeout(() => bubble.classList.remove('show'), 3000);
}

// ── BUILD BACKPACK TRAY ──
function buildBagTray(pet, category) {
  const favAction = FAVORITE_FOOD[pet.type];
  const actions = category === 'animal'
    ? ['food','meat','fish','seed','treat','water']
    : ['water','fertilizer'];

  const items = actions.map(action => {
    const info = ITEM_INFO[action];
    const cnt = _shopData[action] || 0;
    const isFav = favAction === action;
    return `
      <button class="pbt-item${isFav ? ' pbt-fav' : ''}" data-action="${action}" ${!pet.alive || cnt < 1 ? 'disabled' : ''} title="${info.label}${isFav ? ' ⭐ Yêu thích' : ''}">
        ${isFav ? '<span class="pbt-fav-badge">⭐</span>' : ''}
        <span class="pbt-emoji">${info.emoji}</span>
        <span class="pbt-count">${cnt}</span>
      </button>`;
  }).join('');

  return `
    <div class="pet-bag-tray">
      <div class="pbt-title">Chọn vật phẩm cho <b>${esc(pet.name)}</b></div>
      <div class="pbt-items">${items}</div>
    </div>`;
}

// ── MY PETS ──
async function loadMyPets() {
  try {
    const pets = await apiShop.pets();
    const grid = document.getElementById('my-pets-grid');
    const empty = document.getElementById('my-pets-empty');

    grid.querySelectorAll('.pet-card').forEach(c => c.remove());

    if (!pets.length) { if (empty) empty.style.display = ''; return; }
    if (empty) empty.style.display = 'none';

    const isAnimal = t => ['rabbit','cat','dog','hamster','bird'].includes(t);
    const TYPE_LABELS = {
      rabbit:'Thỏ', cat:'Mèo', dog:'Chó', hamster:'Hamster', bird:'Chim',
      tree:'Cây Kim Tiền', kim_ngan:'Cây Kim Ngân', ngoc_bich:'Cây Ngọc Bích',
      flower:'Cây Phát Tài', van_loc:'Cây Vạn Lộc',
      tree2:'Cây Sen Đá', flower2:'Hoa Mai', flower3:'Hoa Lan'
    };

    const hiddenPetIds = JSON.parse(localStorage.getItem('hiddenPetIds') || '[]');

    pets.forEach(pet => {
      const isHidden = hiddenPetIds.includes(pet._id);
      const category = isAnimal(pet.type) ? 'animal' : 'plant';
      const card = document.createElement('div');
      card.className = 'pet-card' + (!pet.alive ? ' pet-dead' : '') + (pet.warning ? ' pet-warning' : '') + (isHidden ? ' pet-hidden' : '');
      card.setAttribute('data-category', category);
      card.setAttribute('data-pet-type', pet.type);
      card.setAttribute('data-pet-id', pet._id);

      const ptsInLevel = pet.totalPoints % 50;
      const pctLevel = Math.min(100, Math.round((ptsInLevel / 50) * 100));
      const healthStatus = !pet.alive ? 'dead' : pet.warning ? 'warning' : 'healthy';
      const healthLabel = !pet.alive ? 'Đã mất' : pet.warning ? 'Cần chăm sóc' : 'Khỏe mạnh';

      card.innerHTML = `
        <button class="pet-visibility-btn" title="${isHidden ? 'Hiện' : 'Ẩn'} pet này">${isHidden ? '👁️‍🗨️' : '👁️'}</button>
        ${pet.warning ? '<div class="pet-warning-badge">⚠️ Cần chăm sóc!</div>' : ''}
        <div class="pet-emoji">${pet.emoji}</div>
        <div class="pet-name">${esc(pet.name)}</div>
        <div class="pet-type-label">${TYPE_LABELS[pet.type] || pet.type} · Lv.${pet.level}</div>
        <div class="pet-health-status"><span class="pet-health-dot ${healthStatus}"></span> ${healthLabel}</div>
        <div class="pet-level-bar"><div class="pet-level-fill" style="width:${pet.level >= 10 ? 100 : pctLevel}%"></div></div>
        <div class="pet-level-text">${pet.totalPoints} pts${pet.level >= 10 ? ' · MAX' : ` · ${50 - ptsInLevel} pts đến Lv.${pet.level + 1}`}</div>
        ${!pet.alive ? `<div class="pet-dead-overlay"><div style="font-size:36px">😢</div><div class="pet-dead-text">Đã mất do không được chăm sóc</div></div>` : ''}
      `;

      const emojiEl = card.querySelector('.pet-emoji');

      // Click emoji: plants drop particles, animals just show mood (no dialogue in profile)
      emojiEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!pet.alive) return;
        if (category === 'plant') {
          createDropParticles(emojiEl, pet.type);
        } else {
          const moodList = ['happy','love','excited','shy','surprised'];
          setPetMood(card, pet.type, moodList[Math.floor(Math.random() * moodList.length)]);
        }
      });

      // Visibility toggle
      card.querySelector('.pet-visibility-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const currentHidden = JSON.parse(localStorage.getItem('hiddenPetIds') || '[]');
        const idx = currentHidden.indexOf(pet._id);
        if (idx > -1) currentHidden.splice(idx, 1);
        else currentHidden.push(pet._id);
        localStorage.setItem('hiddenPetIds', JSON.stringify(currentHidden));
        loadMyPets();
        refreshFloatingPets();
      });


      grid.appendChild(card);
    });
  } catch(e) { console.error('loadMyPets:', e); }
}

// Favorite food burst — big emoji explosion above pet
function createFavFoodBurst(container, foodEmoji) {
  const burst = document.createElement('div');
  burst.className = 'fav-food-burst';
  burst.style.position = 'relative';
  container.style.position = 'relative';
  container.appendChild(burst);

  const items = [foodEmoji, '⭐', '💖', '✨', foodEmoji, '🌟', '💕'];
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div');
    p.className = 'ffb-particle';
    p.textContent = items[i % items.length];
    const angle = (i / 10) * 360;
    const dist = 50 + Math.random() * 40;
    p.style.setProperty('--dx', (Math.cos(angle * Math.PI/180) * dist) + 'px');
    p.style.setProperty('--dy', (Math.sin(angle * Math.PI/180) * dist - 40) + 'px');
    p.style.setProperty('--rot', ((Math.random()-0.5)*720) + 'deg');
    p.style.fontSize = (14 + Math.random() * 10) + 'px';
    p.style.animationDelay = (Math.random() * 0.15) + 's';
    burst.appendChild(p);
  }
  setTimeout(() => burst.remove(), 1400);
}

// Floating-safe versions — append to the floating-pets-container at (x,y) screen coords
// so we NEVER touch petEl.style.position (which would break absolute positioning)
function createFeedHeartsAt(container, x, y) {
  const hearts = ['❤️','💕','💖','💗','🩷','✨'];
  for (let i = 0; i < 6; i++) {
    const h = document.createElement('div');
    h.className = 'feed-heart';
    h.style.cssText = `position:absolute;font-size:20px;pointer-events:none;z-index:10;`;
    h.style.left = (x + (Math.random() - 0.5) * 40) + 'px';
    h.style.top = (y - 10) + 'px';
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    h.style.setProperty('--hx', ((Math.random() - 0.5) * 80) + 'px');
    h.style.animationDelay = (Math.random() * 0.4) + 's';
    container.appendChild(h);
    setTimeout(() => h.remove(), 1400);
  }
}

function createFavFoodBurstAt(container, x, y, foodEmoji) {
  const items = [foodEmoji, '⭐', '💖', '✨', foodEmoji, '🌟', '💕'];
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div');
    p.className = 'ffb-particle';
    p.style.cssText = `position:absolute;pointer-events:none;z-index:10;`;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.textContent = items[i % items.length];
    const angle = (i / 10) * 360;
    const dist = 50 + Math.random() * 50;
    p.style.setProperty('--dx', (Math.cos(angle * Math.PI/180) * dist) + 'px');
    p.style.setProperty('--dy', (Math.sin(angle * Math.PI/180) * dist - 60) + 'px');
    p.style.setProperty('--rot', ((Math.random()-0.5)*720) + 'deg');
    p.style.fontSize = (16 + Math.random() * 12) + 'px';
    p.style.animationDelay = (Math.random() * 0.15) + 's';
    container.appendChild(p);
    setTimeout(() => p.remove(), 1400);
  }
}

// ── BADGES ──
async function loadBadges() {
  try {
    const catalog = await apiShop.badgesCatalog();
    const { badges: earned } = await apiShop.points();
    const earnedIds = new Set((earned || []).map(b => b.id));

    const grid = document.getElementById('badges-grid');
    if (!grid) return;
    grid.innerHTML = '';

    catalog.forEach(badge => {
      const isEarned = earnedIds.has(badge.id);
      const card = document.createElement('div');
      card.className = 'badge-card ' + (isEarned ? 'badge-earned' : 'badge-locked');
      card.innerHTML = `
        <div class="badge-emoji">${isEarned ? badge.emoji : '🔒'}</div>
        <div class="badge-name">${badge.name}</div>
        <div class="badge-desc">${isEarned ? badge.desc : ''}</div>
        <div class="badge-requirement">${isEarned ? '' : (badge.requirement || badge.desc)}</div>
        ${isEarned ? '<div class="badge-earned-tag">✅ Đã đạt</div>' : ''}
      `;
      grid.appendChild(card);
    });
  } catch(e) { console.error('loadBadges:', e); }
}

// ── CHECK & AWARD BADGES (called after completing tasks/etc) ──
async function checkAndAwardBadges() {
  try {
    // Gather stats
    const [pointsData, pets, globalStreak, habitAnalytics] = await Promise.all([
      apiShop.points(),
      apiShop.pets(),
      apiTasks.globalStreak(),
      apiHabits.analytics().catch(() => [])
    ]);

    // Count completed tasks (approximate from totalEarned)
    const tasksCompleted = Math.floor(pointsData.totalEarned / 5); // rough estimate
    const maxHabitStreak = habitAnalytics.length > 0 ? Math.max(...habitAnalytics.map(h => h.maxStreak || 0)) : 0;

    const stats = {
      tasks: tasksCompleted,
      streak: globalStreak.maxStreak || 0,
      pets: pets.filter(p => p.alive).length,
      points: pointsData.totalEarned,
      goals: 0, // would need API to count completed goals
      habit_streak: maxHabitStreak
    };

    const res = await apiShop.checkBadges(stats);
    if (res.newBadges && res.newBadges.length > 0) {
      for (const b of res.newBadges) {
        toast(`🏅 Thành tựu mới: ${b.emoji} ${b.name}!`);
        launchConfetti('high');
      }
      await loadBadges();
    }
  } catch(e) { console.error('checkBadges:', e); }
}

// ── LOAD INITIAL POINTS (on app start) ──
async function loadInitialPoints() {
  try {
    const data = await apiShop.points();
    _shopData = { ...data };
    updatePointsUI(data.points);
    updateInventoryUI();
  } catch(e) {}
}

// ═══════════════════════════════════════════
// GLOBAL INVENTORY SHELF
// ═══════════════════════════════════════════

let _invShelfOpen = false;
let _invShelfSelected = null; // currently selected item type (e.g. 'food')

function initInventoryShelf() {
  const btn = document.getElementById('inv-shelf-btn');
  const panel = document.getElementById('inv-shelf-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    _invShelfOpen = !_invShelfOpen;
    panel.classList.toggle('open', _invShelfOpen);
    btn.textContent = _invShelfOpen ? '❌' : '🎒';
    if (!_invShelfOpen) clearShelfSelection();
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (_invShelfOpen && !document.getElementById('inv-shelf-wrap').contains(e.target)) {
      _invShelfOpen = false;
      panel.classList.remove('open');
      btn.textContent = '🎒';
      clearShelfSelection();
    }
  });

  renderInventoryShelf();
}

function clearShelfSelection() {
  _invShelfSelected = null;
  document.querySelectorAll('.isf-item').forEach(el => el.classList.remove('isf-selected'));
  // Remove feed-mode highlight from floating pets
  document.querySelectorAll('.floating-pet').forEach(el => el.classList.remove('floating-feed-ready'));
}

function renderInventoryShelf() {
  const grid = document.getElementById('inv-shelf-items');
  if (!grid) return;

  const SHELF_ITEMS = [
    { key:'food',       emoji:'🥕', label:'Cà rốt',   validFor:['animal'] },
    { key:'meat',       emoji:'🥩', label:'Thịt',      validFor:['animal'] },
    { key:'fish',       emoji:'🐟', label:'Cá',        validFor:['animal'] },
    { key:'seed',       emoji:'🌾', label:'Hạt',       validFor:['animal'] },
    { key:'treat',      emoji:'🍬', label:'Kẹo',       validFor:['animal'] },
    { key:'water',      emoji:'💧', label:'Nước',      validFor:['animal','plant'] },
    { key:'fertilizer', emoji:'🌿', label:'Phân bón',  validFor:['plant']  },
  ];

  grid.innerHTML = '';

  SHELF_ITEMS.forEach(item => {
    const cnt = _shopData[item.key] || 0;
    const isSelected = _invShelfSelected === item.key;
    const div = document.createElement('div');
    div.className = 'isf-item' + (isSelected ? ' isf-selected' : '') + (cnt < 1 ? ' isf-empty' : '');
    div.setAttribute('data-item', item.key);
    div.draggable = cnt > 0;
    div.innerHTML = `
      <span class="isf-emoji">${item.emoji}</span>
      <span class="isf-label">${item.label}</span>
      <span class="isf-count">${cnt}</span>
    `;

    // Click to select
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      const liveCnt = _shopData[item.key] || 0;
      if (liveCnt < 1) { toast('❌ Hết ' + item.label + '!'); return; }
      if (_invShelfSelected === item.key) {
        clearShelfSelection();
      } else {
        _invShelfSelected = item.key;
        document.querySelectorAll('.isf-item').forEach(el => el.classList.remove('isf-selected'));
        div.classList.add('isf-selected');
        // Highlight valid floating pets
        document.querySelectorAll('.floating-pet').forEach(el => {
          const cat = el.getAttribute('data-category');
          if (item.validFor.includes(cat)) el.classList.add('floating-feed-ready');
          else el.classList.remove('floating-feed-ready');
        });
        toast(`${item.emoji} Chọn thú cưng để cho ăn!`);
      }
    });

    // Drag start — custom ghost: only the food emoji
    div.addEventListener('dragstart', (e) => {
      if ((_shopData[item.key] || 0) < 1) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', item.key);
      e.dataTransfer.effectAllowed = 'copy';
      _invShelfSelected = item.key;
      div.classList.add('isf-selected');

      // Create emoji-only ghost image
      const ghost = document.createElement('div');
      ghost.textContent = item.emoji;
      ghost.style.cssText = 'position:fixed;top:-200px;left:-200px;font-size:40px;pointer-events:none;opacity:.92;filter:drop-shadow(0 2px 8px rgba(0,0,0,.4));';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 20);
      // Remove ghost after browser has captured the drag image
      setTimeout(() => ghost.remove(), 0);
    });
    div.addEventListener('dragend', () => {
      div.classList.remove('isf-selected');
      _invShelfSelected = null;
      document.querySelectorAll('.floating-pet').forEach(el => el.classList.remove('floating-feed-ready'));
    });

    grid.appendChild(div);
  });
}

function isValidAction(petCategory, action) {
  if (petCategory === 'plant') return ['water', 'fertilizer'].includes(action);
  // Animals: food, meat, fish, seed, treat, water — no fertilizer
  return ['food', 'meat', 'fish', 'seed', 'treat', 'water'].includes(action);
}

async function handleFloatingPetFeed(petEl, action) {
  const petId = petEl.getAttribute('data-pet-id');
  const petType = petEl.getAttribute('data-pet-type');
  const category = petEl.getAttribute('data-category');

  if (!isValidAction(category, action)) {
    toast('❌ Thú cưng này không dùng vật phẩm đó!');
    return;
  }
  if ((_shopData[action] || 0) < 1) {
    toast('❌ Hết vật phẩm!');
    return;
  }

  petEl.classList.remove('floating-feed-ready');
  petEl.classList.add('floating-drop-target');

  try {
    const res = await apiShop.care(petId, action);
    Object.assign(_shopData, res.inventory);
    updateInventoryUI();

    // Visual feedback
    const fpContainer = document.getElementById('floating-pets-container');
    const px = petEl.offsetLeft + petEl.offsetWidth * 0.5;
    const py = petEl.offsetTop;

    if (category === 'animal') {
      // Pick correct dialogue context: water→water, everything else→feed
      const dialogues = PET_DIALOGUES[petType];
      const dialogCtx = (action === 'water') ? 'water' : 'feed';
      const msgs = (dialogues && (dialogues[dialogCtx] || dialogues.idle)) || ['😋'];

      let bubble = petEl.querySelector('.floating-dialogue');
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'floating-dialogue';
        petEl.appendChild(bubble);
      }
      bubble.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      bubble.classList.add('show');
      clearTimeout(bubble._timer);
      bubble._timer = setTimeout(() => bubble.classList.remove('show'), 3000);

      // Spawn particles IN THE CONTAINER at pet's coords (never touch petEl.style.position)
      if (res.isFavorite) {
        createFavFoodBurstAt(fpContainer, px, py, ITEM_INFO[action]?.emoji || '✨');
      } else {
        createFeedHeartsAt(fpContainer, px, py);
      }
    } else {
      // Plant: drop particles at pet coords in container
      const config = PLANT_DROP_CONFIG[petType] || { items: ['🍃','💧'], special: '✨' };
      const count = 8 + Math.floor(Math.random() * 4);
      for (let j = 0; j < count; j++) {
        const p = document.createElement('div');
        p.className = 'floating-drop';
        p.textContent = Math.random() < 0.3 ? config.special : config.items[Math.floor(Math.random() * config.items.length)];
        p.style.left = (px + (Math.random() - 0.5) * 40) + 'px';
        p.style.top = py + 'px';
        p.style.setProperty('--dx', ((Math.random() - 0.5) * 100) + 'px');
        p.style.setProperty('--rot', ((Math.random() - 0.5) * 600) + 'deg');
        p.style.fontSize = (16 + Math.random() * 10) + 'px';
        p.style.animationDelay = (Math.random() * 0.25) + 's';
        fpContainer.appendChild(p);
        setTimeout(() => p.remove(), 1500);
      }
    }

    const bonusText = res.isFavorite ? ` ⭐ +${res.pointsGain}pts YÊU THÍCH!` : ` +${res.pointsGain}pts`;
    toast(`${ITEM_INFO[action]?.emoji || ''} ${ITEM_INFO[action]?.label}${bonusText}`);
    if (res.isFavorite) launchConfetti('low');

  } catch(e) {
    toast('❌ ' + (e.message || 'Không thể cho ăn!'));
  } finally {
    petEl.classList.remove('floating-drop-target');
    clearShelfSelection();
  }
}

// FLOATING PETS SYSTEM (visible on all pages)
// ═══════════════════════════════════════════

let _floatingPetsLoaded = false;
const _floatingPetPositions = {};

async function loadFloatingPets() {
  const container = document.getElementById('floating-pets-container');
  if (!container) return;
  container.innerHTML = '';

  try {
    const pets = await apiShop.pets();
    const hiddenIds = JSON.parse(localStorage.getItem('hiddenPetIds') || '[]');
    const visiblePets = pets.filter(p => p.alive && !hiddenIds.includes(p._id));

    if (!visiblePets.length) return;

    const isAnimal = t => ['rabbit','cat','dog','hamster','bird'].includes(t);

    visiblePets.forEach((pet, i) => {
      const el = document.createElement('div');
      const category = isAnimal(pet.type) ? 'animal' : 'plant';
      el.className = 'floating-pet';
      el.setAttribute('data-category', category);
      el.setAttribute('data-pet-type', pet.type);
      el.setAttribute('data-pet-id', pet._id);
      el.textContent = pet.emoji;

      // Restore saved position or set default (bottom-right)
      const savedPos = _floatingPetPositions[pet._id];
      if (savedPos) {
        el.style.left = savedPos.x + 'px';
        el.style.top = savedPos.y + 'px';
      } else {
        const rightZone = window.innerWidth - 200;
        const bottomZone = window.innerHeight - 160;
        el.style.left = (rightZone + Math.random() * 120) + 'px';
        el.style.top = (bottomZone + Math.random() * 60) + 'px';
      }

      // Stagger animations
      el.style.animationDelay = (i * 0.3) + 's';

      // Animals walk randomly, plants stay put (user can drag plants)
      if (category === 'animal') {
        const walkInterval = setInterval(() => {
          if (el._isDragging) return;
          const margin = 60;
          const newX = margin + Math.random() * (window.innerWidth - margin * 2 - 80);
          const newY = (window.innerHeight * 0.55) + Math.random() * (window.innerHeight * 0.35);
          // Set direction via CSS variable — no transform conflict
          const curX = parseFloat(el.style.left) || el.offsetLeft;
          el.style.setProperty('--dir', newX < curX ? '-1' : '1');
          el.classList.add('walking');
          el.style.left = newX + 'px';
          el.style.top = newY + 'px';
          setTimeout(() => el.classList.remove('walking'), 3200);
        }, 5000 + Math.random() * 5000);
        el._walkInterval = walkInterval;
      }

      // Drag to reposition
      let isDragging = false, dragX, dragY, startX, startY;
      el.addEventListener('pointerdown', (e) => {
        isDragging = true;
        el._isDragging = true;
        dragX = e.clientX - el.offsetLeft;
        dragY = e.clientY - el.offsetTop;
        startX = e.clientX;
        startY = e.clientY;
        el.style.transition = 'none'; // stop smooth movement during drag
        el.style.zIndex = '60';
        el.classList.remove('walking');
        el.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      el.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const x = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragX));
        const y = Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragY));
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      });
      el.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        el._isDragging = false;
        el.style.zIndex = '';
        el.style.transition = ''; // restore CSS-defined transition
        // Save position
        _floatingPetPositions[pet._id] = { x: el.offsetLeft, y: el.offsetTop };

        // If barely moved = click
        const dist = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
        if (dist < 8) {
          // If item is selected in inventory shelf → feed with it
          if (_invShelfSelected) {
            handleFloatingPetFeed(el, _invShelfSelected);
            return;
          }
          if (category === 'plant') {
            // Drop particles from plant
            const config = PLANT_DROP_CONFIG[pet.type] || { items: ['🍃','🌿'], special: '🍃' };
            for (let j = 0; j < 6; j++) {
              const p = document.createElement('div');
              p.className = 'floating-drop';
              p.textContent = Math.random() < 0.3 ? config.special : config.items[Math.floor(Math.random() * config.items.length)];
              p.style.left = el.offsetLeft + 'px';
              p.style.top = el.offsetTop + 'px';
              p.style.setProperty('--dx', ((Math.random() - 0.5) * 80) + 'px');
              p.style.setProperty('--rot', ((Math.random() - 0.5) * 600) + 'deg');
              p.style.animationDelay = (Math.random() * 0.2) + 's';
              container.appendChild(p);
              setTimeout(() => p.remove(), 1500);
            }
          } else {
            // Show dialogue for animals
            let bubble = el.querySelector('.floating-dialogue');
            if (!bubble) {
              bubble = document.createElement('div');
              bubble.className = 'floating-dialogue';
              el.appendChild(bubble);
            }
            const dialogues = PET_DIALOGUES[pet.type];
            if (dialogues) {
              const msgs = dialogues.idle;
              bubble.textContent = msgs[Math.floor(Math.random() * msgs.length)];
              bubble.classList.add('show');
              clearTimeout(bubble._timer);
              bubble._timer = setTimeout(() => bubble.classList.remove('show'), 3000);
            }
          }
        }
      });

      // Drag-and-drop from inventory shelf onto floating pet
      el.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          el.classList.add('floating-drop-target');
        }
      });
      el.addEventListener('dragleave', () => {
        el.classList.remove('floating-drop-target');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('floating-drop-target');
        const action = e.dataTransfer.getData('text/plain');
        if (action) handleFloatingPetFeed(el, action);
      });

      container.appendChild(el);
    });

    _floatingPetsLoaded = true;

    // Warn about hidden pets that are sick or close to death
    const hiddenSick = pets.filter(p => hiddenIds.includes(p._id) && p.alive && p.warning);
    const hiddenDead = pets.filter(p => hiddenIds.includes(p._id) && !p.alive);
    if (hiddenDead.length > 0) {
      toast(`😢 ${hiddenDead.length} thú cưng/cây đang ẩn đã mất vì không được chăm sóc!`);
    } else if (hiddenSick.length > 0) {
      toast(`⚠️ ${hiddenSick.length} thú cưng/cây đang ẩn cần được chăm sóc!`);
    }
  } catch(e) { /* not logged in yet */ }
}

// Reload floating pets when visibility changes
function refreshFloatingPets() {
  loadFloatingPets();
}

// ── Profile Freeze Activation ──
function renderProfileFreeze() {
  const wrap = document.getElementById('profile-freeze-wrap');
  if (!wrap) return;
  const hasFreeze = (_shopData.streakFreezes || 0) > 0;
  const freezeActive = _shopData.freezeActive;

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
      <div style="font-size:32px">${freezeActive ? '🛡️✅' : '❄️'}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${freezeActive ? 'Freeze đang hoạt động' : 'Streak Freeze'}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${freezeActive ? 'Streak & thú cưng đang được bảo vệ 24h!' : hasFreeze ? `Bạn có ${_shopData.streakFreezes} thẻ freeze. Kích hoạt để bảo vệ streak & thú cưng 24h.` : 'Chưa có thẻ freeze. Hãy mua ở cửa hàng!'}</div>
      </div>
      <button class="psb-save-btn" id="profile-activate-freeze" style="background:${freezeActive ? 'linear-gradient(135deg,#5ef0a0,#3ddbb8)' : hasFreeze ? 'linear-gradient(135deg,#5ee8f0,#3ddbb8)' : 'var(--bg4)'};white-space:nowrap;" ${!hasFreeze || freezeActive ? 'disabled' : ''}>
        ${freezeActive ? '✅ Đang hoạt động' : hasFreeze ? '❄️ Kích hoạt' : '🔒 Cần mua'}
      </button>
    </div>
  `;

  if (hasFreeze && !freezeActive) {
    wrap.querySelector('#profile-activate-freeze').addEventListener('click', async () => {
      try {
        const res = await apiShop.activateFreeze();
        _shopData.streakFreezes = res.streakFreezes;
        _shopData.freezeActive = true;
        _shopData.freezeActiveUntil = res.freezeActiveUntil;
        updateInventoryUI();
        toast('❄️ Freeze đã kích hoạt! Bảo vệ 24h');
        launchConfetti('low');
        renderProfileFreeze();
      } catch(e) { toast('❌ ' + (e.message || 'Không có thẻ freeze!')); }
    });
  }
}

// ── Hook into navigateTo for shop/profile pages ──
const _origNavigateTo = navigateTo;
let _profilePetsInited = false;
navigateTo = function(page) {
  _origNavigateTo(page);
  if (page === 'shop') {
    initShop();
  }
  if (page === 'profile') {
    renderProfileFreeze();
    if (!_profilePetsInited) {
      _profilePetsInited = true;
      loadMyPets();
      loadBadges();
    }
  }
};
