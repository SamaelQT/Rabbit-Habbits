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
const apiHabits={
  list:()=>API.g('/api/habits'),
  add:(b)=>API.p('/api/habits',b),
  del:(id)=>API.d(`/api/habits/${id}`),
  logs:(s,e)=>API.g(`/api/habits/logs?startDate=${s}&endDate=${e}`),
  toggleLog:(hid,d)=>API.p('/api/habits/logs/toggle',{habitId:hid,date:d}),
  stats:(s,e)=>API.g(`/api/habits/stats?startDate=${s}&endDate=${e}`),
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
  if(task.completed) toast('🌸 Task hoàn thành!');
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
  // Heatmap is rendered separately - don't call here to avoid ResizeObserver conflict
}

async function renderStats(stats,s,e,globalStreak){
  document.getElementById('stat-total').textContent=stats.overall.total;
  document.getElementById('stat-done').textContent=stats.overall.completed;
  document.getElementById('stat-rate').textContent=stats.overall.rate+'%';
  // Global streak
  const gs=globalStreak?.currentStreak||0, gm=globalStreak?.maxStreak||0;
  document.getElementById('stat-streak').textContent=(gs>0?gs:gm);
  if(gs>=3){
    document.getElementById('global-streak-badge').style.display='flex';
    document.getElementById('global-streak-text').textContent=`🔥 ${gs} ngày liên tiếp`;
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
    card.className='ttc'; // top-task-card
    card.innerHTML=`
      <div class="ttc-top">
        <div class="ttc-rank">${i+1}</div>
        <div class="ttc-name" title="${esc(t.title)}">${esc(t.title)}</div>
        <div class="ttc-meta">
          <span class="ttc-count">${t.total}×</span>
          <span class="ttc-rate" style="color:${rc}">${rate}%</span>
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

  const CELL = 16, GAP = 3;
  const DAY_W = 28, PAD = 36;
  // Measure panel width NOW (layout already settled)
  const panelW = panel.offsetWidth;
  if(panelW === 0) return; // not visible yet, skip
  const availW = panelW - DAY_W - PAD;
  const WEEKS  = Math.max(16, Math.min(52, Math.floor(availW / (CELL + GAP))));

  // Date range
  const endDow     = state.today.getDay();
  const lastSunday = addDays(state.today, endDow === 0 ? 0 : 7 - endDow);
  const rawStart   = addDays(lastSunday, -(WEEKS * 7 - 1));
  const rsDow      = rawStart.getDay();
  const alignStart = addDays(rawStart, -(rsDow === 0 ? 6 : rsDow - 1));

  const data = await apiTasks.heatmap(tds(alignStart), tds(lastSunday));

  // Build columns
  let cur = new Date(alignStart), lastMo = -1;
  const cols = [];
  for(let w = 0; w < WEEKS; w++){
    const cells = [];
    let monthLabel = '';
    if(cur.getMonth() !== lastMo){
      monthLabel = VI_MONTHS[cur.getMonth()].replace('Tháng ','T');
      lastMo = cur.getMonth();
    }
    for(let d = 0; d < 7; d++){
      const day = addDays(cur, d), ds = tds(day);
      const bd  = data[ds], fut = day > state.today;
      let lv = 0;
      if(!fut && bd && bd.total > 0){ const r = bd.completed/bd.total; lv = r>=1?4:r>=.66?3:r>=.33?2:1; }
      cells.push({ day, ds, lv, bd, fut });
    }
    cols.push({ cells, monthLabel });
    cur = addDays(cur, 7);
  }

  // DOM — build off-screen fragment first, then swap in one shot
  const frag = document.createDocumentFragment();
  const wrap = document.createElement('div');
  wrap.className = 'heatmap-wrapper';

  // Day labels
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
  cols.forEach(({ cells, monthLabel }) => {
    const col = document.createElement('div'); col.className = 'hm-col';
    const mo  = document.createElement('div'); mo.className = 'hm-month-lbl'; mo.textContent = monthLabel;
    col.appendChild(mo);
    cells.forEach(c => {
      const dot = document.createElement('div'); dot.className = 'hmap-day';
      dot.setAttribute('data-level', c.fut ? 'future' : c.lv);
      dot.title = `${c.day.getDate()}/${c.day.getMonth()+1}: ${c.bd
        ? c.bd.completed+'/'+c.bd.total+' tasks' : 'chưa có task'}`;
      col.appendChild(dot);
    });
    area.appendChild(col);
  });
  wrap.appendChild(area);
  frag.appendChild(wrap);

  // Single DOM write
  grid.innerHTML = '';
  grid.appendChild(frag);

  // Update title to show actual weeks
  const titleEl = document.querySelector('.heatmap-panel .heatmap-panel-header .chart-panel-title');
  if(titleEl) titleEl.textContent = `🗓 ${WEEKS} tuần gần đây`;

  // Legend
  const leg = document.getElementById('heatmap-legend');
  if(leg) leg.innerHTML = `
    <span style="font-size:10px;color:var(--text3)">Ít</span>
    ${[0,1,2,3,4].map(l=>`<div class="hmap-day" data-level="${l}" style="cursor:default"></div>`).join('')}
    <span style="font-size:10px;color:var(--text3)">Nhiều</span>`;
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
  document.getElementById('habit-week-header').innerHTML=`
    <div style="display:flex;align-items:center">
      <div style="flex:1;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3)">THÓI QUEN</div>
      <div style="display:flex;gap:2px">
        ${wd.map(d=>`<div style="width:24px;text-align:center;font-size:8.5px;font-weight:700;text-transform:uppercase;color:${tds(d)===todayStr?'var(--accent2)':'var(--text3)'}">
          ${VI_DAYS[d.getDay()]}<br><span style="font-size:8px;font-family:'JetBrains Mono',monospace">${d.getDate()}</span>
        </div>`).join('')}
      </div>
    </div>`;
  const wrap=document.getElementById('habits-rows-wrap');
  const empty=document.getElementById('habits-empty');
  wrap.querySelectorAll('.habit-row').forEach(r=>r.remove());
  if(!state.habits.length){if(empty)empty.style.display='';return;}
  if(empty)empty.style.display='none';
  state.habits.forEach(h=>{
    const row=document.createElement('div'); row.className='habit-row';
    const cellsHtml=wd.map(d=>{
      const ds=tds(d),done=state.habitLogs[`${h._id}_${ds}`]===true;
      const fut=new Date(ds)>state.today;
      return `<div class="hr-day-cell${done?' done':''}${fut?' future':''}${ds===todayStr?' is-today-cell':''}"
        data-hid="${h._id}" data-date="${ds}" style="${done?`background:${h.color};`:''}">${done?'✓':''}</div>`;
    }).join('');
    row.innerHTML=`
      <div class="hr-emoji">${h.emoji}</div>
      <div class="hr-name" title="${esc(h.name)}">${esc(h.name)}</div>
      <div class="hr-days">${cellsHtml}</div>
      <button class="hr-delete" data-hid="${h._id}">✕</button>`;
    row.querySelectorAll('.hr-day-cell:not(.future)').forEach(cell=>{
      cell.addEventListener('click',async()=>{
        const log=await apiHabits.toggleLog(cell.dataset.hid,cell.dataset.date);
        const key=`${cell.dataset.hid}_${cell.dataset.date}`;
        state.habitLogs[key]=log.done;
        cell.classList.toggle('done',log.done);
        cell.textContent=log.done?'✓':''; cell.style.background=log.done?h.color:'';
        renderHabitsStats(); toast(log.done?`${h.emoji} Đã ghi nhận!`:`${h.emoji} Đã bỏ chọn`);
      });
    });
    row.querySelector('.hr-delete').addEventListener('click',async()=>{
      if(!confirm(`Xoá thói quen "${h.name}"?`)) return;
      await apiHabits.del(h._id); await loadHabits(); toast('🗑 Đã xóa thói quen');
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
  const [wD,cmD,pmD]=await Promise.all([apiHabits.stats(ws,we),apiHabits.stats(cms,cme),apiHabits.stats(pms,pme)]);
  mkHabitChart('chart-habit-week',wD);
  mkHabitChart('chart-habit-curmonth',cmD);
  mkHabitChart('chart-habit-prevmonth',pmD);
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

// ─── MOOD ─────────────────────────────────────────────────
function initMood(){
  const key='mood-'+tds(state.today);
  const saved=localStorage.getItem(key);
  if(saved) document.querySelectorAll('.mood-btn').forEach(b=>b.classList.toggle('selected',b.dataset.mood===saved));
  document.querySelectorAll('.mood-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      localStorage.setItem(key,btn.dataset.mood);
      toast(`${btn.dataset.mood} Đã lưu tâm trạng!`);
    });
  });
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

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async ()=>{
  // ── AUTH CHECK ── redirect to /auth.html if not logged in
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if(!r.ok){ window.location.href = '/auth.html'; return; }
    const { user } = await r.json();
    // Show user name + logout in header
    const headerRight = document.getElementById('header-right-extra');
    if(headerRight){
      headerRight.innerHTML = `
        <span style="font-size:12px;color:var(--text2);font-family:'JetBrains Mono',monospace">
          🐰 ${esc(user.displayName||user.username)}
        </span>
        <button id="logout-btn" style="
          padding:5px 12px;background:var(--bg3);border:1px solid var(--border2);
          border-radius:20px;color:var(--text2);font-size:11.5px;font-weight:600;
          font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all .2s;
        ">Đăng xuất</button>`;
      document.getElementById('logout-btn').addEventListener('click', async ()=>{
        await fetch('/api/auth/logout',{ method:'POST', credentials:'include' });
        window.location.href = '/auth.html';
      });
    }
  } catch(e){ window.location.href = '/auth.html'; return; }

  // Apply saved theme
  applyTheme(state.theme);

  // Header date
  const days=['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  const now=state.today;
  document.getElementById('header-date').textContent=`${days[now.getDay()]}, ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

  // Theme toggle
  document.getElementById('theme-btn')?.addEventListener('click',toggleTheme);

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

  initMood();
  initHabitsForm();
  initMobileSidebar();
  loadAndRender();
  loadHabits();

  // Render heatmap once after layout is ready, and on window resize (debounced)
  setTimeout(()=> _buildHeatmap(), 400);
  window.addEventListener('resize', scheduleHeatmap, {passive:true});
});
