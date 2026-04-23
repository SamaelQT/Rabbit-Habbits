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
  add:(t,d,p,cat)=>API.p('/api/tasks',{title:t,date:d,priority:p||0,category:cat||'other'}),
  toggle:(id)=>API.pa(`/api/tasks/${id}/toggle`,{}),
  del:(id)=>API.d(`/api/tasks/${id}`),
  upd:(id,fields)=>API.pa(`/api/tasks/${id}`,fields),
  stats:(s,e)=>API.g(`/api/tasks/stats?startDate=${s}&endDate=${e}`),
  streak:(t)=>API.g(`/api/tasks/streak?title=${encodeURIComponent(t)}`),
  globalStreak:()=>API.g('/api/tasks/global-streak'),
  heatmap:(s,e)=>API.g(`/api/tasks/heatmap?startDate=${s}&endDate=${e}`),
  report:(s,e)=>API.g(`/api/tasks/report?startDate=${s}&endDate=${e}`),
  productiveHours:(s,e)=>API.g(`/api/tasks/productive-hours?startDate=${s}&endDate=${e}`),
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

/**
 * refreshAll — gọi sau mọi thao tác mutate data để đồng bộ toàn bộ UI.
 * Dùng fire-and-forget (không cần await ở nơi gọi) nếu muốn non-blocking.
 */
async function refreshAll() {
  await loadAndRender();
  quickNotifCheck();
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
      <!-- Row 3: category selector -->
      <div class="task-cat-row">
        <div class="task-cat-grid">
          <button class="tcat-btn" data-cat="work">💼<span>Công việc</span></button>
          <button class="tcat-btn" data-cat="health">🩺<span>Sức khỏe</span></button>
          <button class="tcat-btn" data-cat="sport">🏃<span>Thể thao</span></button>
          <button class="tcat-btn" data-cat="shopping">🛒<span>Mua sắm</span></button>
          <button class="tcat-btn" data-cat="learning">📚<span>Học tập</span></button>
          <button class="tcat-btn" data-cat="personal">🏠<span>Cá nhân</span></button>
          <button class="tcat-btn" data-cat="other">🎯<span>Khác</span></button>
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

  // Category picker
  let selCat = null; // null = not yet chosen (will auto-detect on submit)
  let catManual = false;

  const allCatBtns = () => col.querySelectorAll('.tcat-btn');

  allCatBtns().forEach(btn => {
    btn.addEventListener('click', () => {
      selCat = btn.dataset.cat;
      catManual = true;
      allCatBtns().forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const inp = col.querySelector('.add-task-input');

  // Auto-highlight category as user types (if not manually chosen)
  inp.addEventListener('input', () => {
    if (catManual) return;
    if (!inp.value.trim()) { allCatBtns().forEach(b => b.classList.remove('active')); return; }
    const detected = autoCategory(inp.value);
    allCatBtns().forEach(b => b.classList.remove('active'));
    col.querySelector(`.tcat-btn[data-cat="${detected}"]`)?.classList.add('active');
  });

  function doAddTask() {
    const cat = selCat || autoCategory(inp.value) || 'other';
    addTask(ds, inp, selPrio, cat);
    selCat = null; catManual = false;
    allCatBtns().forEach(b => b.classList.remove('active'));
  }

  col.querySelector('.add-task-btn').addEventListener('click', doAddTask);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doAddTask(); });
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
const CAT_META={
  work:     {icon:'💼',label:'Công việc', color:'#7eb8f7'},
  health:   {icon:'🩺',label:'Sức khỏe', color:'#5ef0a0'},
  sport:    {icon:'🏃',label:'Thể thao',  color:'#ff9f5c'},
  shopping: {icon:'🛒',label:'Mua sắm',   color:'#f7c97e'},
  learning: {icon:'📚',label:'Học tập',   color:'#ffcf5c'},
  personal: {icon:'🏠',label:'Cá nhân',   color:'#f79cf7'},
  other:    {icon:'🎯',label:'Khác',      color:'#999'},
};

// Auto-categorization keywords (Vietnamese + English)
const CAT_KEYWORDS={
  work:[
    'làm việc','công việc','báo cáo','họp','meeting','email','dự án','project',
    'code','coding','lập trình','web','app','thiết kế','design','deadline',
    'khách hàng','client','hợp đồng','contract','phỏng vấn','interview','cv',
    'văn phòng','office','trình bày','presentation','excel','word','powerpoint',
    'budget','ngân sách','doanh thu','sale','bán hàng','marketing','quảng cáo',
    'sếp','đồng nghiệp','kế hoạch công','seo','ads','server','database','deploy',
    'bug','fix lỗi','task công','sprint','jira','figma','canva bài'
  ],
  health:[
    'khám bệnh','bệnh viện','thuốc','uống thuốc','dinh dưỡng','vitamin',
    'sức khỏe','y tế','bác sĩ','nha sĩ','tiêm','xét nghiệm','khám','detox',
    'giảm cân','tăng cân','cân nặng','bmi','protein','calories','ăn sáng',
    'ăn trưa','ăn tối','bữa ăn','uống nước','nước lọc','ngủ sớm','ngủ đủ giấc',
    'nghỉ ngơi sức','huyết áp','đường huyết','omega','collagen','supplement'
  ],
  sport:[
    'gym','tập gym','chạy bộ','bơi lội','đạp xe','yoga','thể dục','bóng đá',
    'tennis','cầu lông','bóng rổ','leo núi','đi bộ','tập luyện','thể thao',
    'workout','exercise','cardio','push up','plank','squat','chạy','bơi',
    'tập thể','thi đấu','giải đấu','training','zumba','pilates','boxing',
    'kickboxing','taekwondo','karate','golf','cầu lông','pickleball','chèo',
    'leo','đá bóng','đánh cầu','đánh tennis','tập yoga','tập cardio'
  ],
  shopping:[
    'mua','siêu thị','cửa hàng','đặt hàng','order','chợ','shopping','thanh toán',
    'hóa đơn','nạp tiền','tiền điện','tiền nước','tiền internet','bill','trả tiền',
    'nộp tiền','mua sắm','ship','giao hàng','shopee','lazada','tiki','amazon',
    'grab food','foody','beedeilvery','thuê nhà','tiền nhà','tiền phòng',
    'gia hạn','subscribe','đăng ký dịch','mua vé','đặt vé','booking'
  ],
  learning:[
    'học','đọc sách','khóa học','nghiên cứu','ôn thi','luyện tập','study',
    'course','bài tập','bài học','tự học','tiếng anh','ngoại ngữ','certificate',
    'chứng chỉ','ielts','toeic','toán','lý','hóa','văn','sử','địa','sinh',
    'đại học','cao học','luận văn','đề tài','ôn bài','kiểm tra','bài kiểm',
    'flashcard','anki','podcast học','xem tutorial','đọc tài liệu','ghi chú học',
    'python','javascript','react','sql','data','ai học','machine learning học'
  ],
  personal:[
    'gia đình','bạn bè','gặp gỡ','du lịch','sở thích','sinh nhật','tiệc',
    'hẹn hò','gọi điện','nhắn tin','giúp đỡ','từ thiện','tình nguyện',
    'dọn dẹp','giặt đồ','nấu ăn','sửa chữa','trang trí','vệ sinh nhà',
    'thú cưng','tưới cây','chụp ảnh','vẽ','nhạc','xem phim','chơi game',
    'viết blog','nhật ký','diary','thiền','meditiate','dạo chơi','picnic',
    'họ hàng','ba mẹ','anh chị em','con cái','hàng xóm'
  ]
};

function autoCategory(title){
  const t=title.toLowerCase().normalize('NFC');
  for(const [cat,kws] of Object.entries(CAT_KEYWORDS)){
    if(kws.some(kw=>t.includes(kw))) return cat;
  }
  return 'other';
}
function mkTaskItem(task){
  const p=task.priority||0;
  const cat=task.category||'other';
  const cm=CAT_META[cat]||CAT_META.other;
  const item=document.createElement('div');
  item.className='task-item'+(task.completed?' completed':'')+(p>0?` prio-${p}`:'');
  item.dataset.id=task._id;
  const prioIndicator=p>0?`<div class="task-prio-dot" style="background:${PRIORITY_COLORS[p]}" title="${PRIORITY_LABELS[p]}"></div>`:'';
  item.innerHTML=`
    ${prioIndicator}
    <div class="task-checkbox"><div class="task-checkbox-check"></div></div>
    <span class="task-title">${esc(task.title)}</span>
    <div class="task-actions">
      <div class="task-cat-menu">
        <button class="task-cat-toggle" title="Đổi danh mục" style="color:${cm.color}">${cm.icon}</button>
        <div class="task-cat-dropdown">
          <div class="tcd-item" data-cat="work">💼 Công việc</div>
          <div class="tcd-item" data-cat="health">🩺 Sức khỏe</div>
          <div class="tcd-item" data-cat="sport">🏃 Thể thao</div>
          <div class="tcd-item" data-cat="shopping">🛒 Mua sắm</div>
          <div class="tcd-item" data-cat="learning">📚 Học tập</div>
          <div class="tcd-item" data-cat="personal">🏠 Cá nhân</div>
          <div class="tcd-item" data-cat="other">🎯 Khác</div>
        </div>
      </div>
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

  // Category dropdown
  const catMenu=item.querySelector('.task-cat-menu');
  const catToggle=item.querySelector('.task-cat-toggle');
  const catDrop=item.querySelector('.task-cat-dropdown');
  catToggle.addEventListener('click',e=>{e.stopPropagation();catDrop.classList.toggle('open');});
  catDrop.querySelectorAll('.tcd-item').forEach(opt=>{
    opt.addEventListener('click',async e=>{
      e.stopPropagation();
      const nc=opt.dataset.cat;
      await apiTasks.upd(task._id,{category:nc});
      task.category=nc;
      const ncm=CAT_META[nc]||CAT_META.other;
      catToggle.textContent=ncm.icon;
      catToggle.style.color=ncm.color;
      catToggle.title=`Danh mục: ${ncm.label}`;
      catDrop.classList.remove('open');
      toast(`🏷️ Danh mục: ${ncm.icon} ${ncm.label}`);
    });
  });
  document.addEventListener('click',()=>catDrop.classList.remove('open'));

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

async function addTask(ds,inp,prio=0,cat='other'){
  const title=inp.value.trim(); if(!title) return;
  if(inp.dataset.busy) return; inp.dataset.busy='1';
  inp.value='';
  const btn=inp.closest('.add-task-area')?.querySelector('.add-task-btn');
  if(btn){ btn.disabled=true; btn.style.opacity='.5'; }
  try {
  const task=await apiTasks.add(title,ds,prio,cat);
  if(!state.tasks[ds]) state.tasks[ds]=[];
  state.tasks[ds].push(task);
  state.tasks[ds].sort((a,b)=>(b.priority||0)-(a.priority||0));
  const list=document.getElementById(`tasks-${ds}`);
  list.querySelector('.empty-state')?.remove();
  list.innerHTML=''; state.tasks[ds].forEach(t=>list.appendChild(mkTaskItem(t)));
  refreshDonut(ds); toast('✓ Đã thêm task');
  refreshAll().catch(()=>{});          // sync stats + calendar + badge
  } finally {
    delete inp.dataset.busy;
    if(btn){ btn.disabled=false; btn.style.opacity=''; }
  }
}
async function toggleTask(id,itemEl){
  const task=await apiTasks.toggle(id);
  itemEl.classList.toggle('completed',task.completed);
  const ds=itemEl.closest('.day-column').dataset.date;
  const t=state.tasks[ds]?.find(t=>t._id===id); if(t) t.completed=task.completed;
  refreshDonut(ds);
  if(task.completed){
    const pts = task.pointsAwarded || 5;
    toast(`🌸 Task hoàn thành! +${pts}⭐`);
    showPointsToast(pts);
    updatePointsUI((_shopData.points||0) + pts);
    const intensity = task.priority >= 3 ? 'high' : task.priority >= 2 ? 'medium' : 'low';
    launchConfetti(intensity);
    setTimeout(() => showMotivationOverlay(), 600);
    checkAndAwardBadges();
    if (task.leveledUp) setTimeout(() => showLevelUpAnimation(task.oldLevel, task.newLevel), 800);
  } else {
    const pts = task.pointsDeducted || 5;
    toast(`↩️ Đã bỏ tích — trừ ${pts}⭐`);
    updatePointsUI(Math.max(0, (_shopData.points||0) - pts));
  }
  refreshAll().catch(()=>{});          // sync calendar + stats + badge
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
    refreshAll().catch(()=>{});        // sync calendar + stats + badge
  },220);
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
  // Journey + new stat panels
  loadJourneyStats();
  loadMonthlyProgress();
  loadLifeBalance();
  loadUpcomingMilestones();
  // Original report panels
  loadWeeklyReport();
  loadWeekComparison();
  loadMoodLineChart();
  loadProductiveHours();
  loadGoalArchiveStats();
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

// ─── WEEKLY REPORT CARD ──────────────────────────────────
async function loadWeeklyReport() {
  try {
    const card = document.getElementById('weekly-report-card');
    if (!card) return;
    const weekDates = getWeekDates(0);
    const ws = tds(weekDates[0]), we = tds(weekDates[6]);
    document.getElementById('report-week-label').textContent = `${ws.split('-').reverse().join('/')} – ${we.split('-').reverse().join('/')}`;

    const [report, journalEntries, globalStreak] = await Promise.all([
      apiTasks.report(ws, we),
      apiJournal.range(ws, we),
      apiTasks.globalStreak()
    ]);

    // Dominant mood
    const moodCounts = {};
    const MOOD_INFO = {
      '🌸': 'Tuyệt vời', '😊': 'Vui vẻ', '😌': 'Bình thường',
      '😴': 'Mệt mỏi', '😤': 'Căng thẳng', '😢': 'Buồn',
    };
    (journalEntries || []).forEach(e => { if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1; });
    const topMoodEntry = Object.entries(moodCounts).sort((a,b) => b[1] - a[1])[0];
    const topMood = topMoodEntry ? `${topMoodEntry[0]} ${MOOD_INFO[topMoodEntry[0]] || ''}` : '—';
    const journalDays = (journalEntries || []).filter(e => e.mood).length;

    const body = document.getElementById('report-week-body');
    const rateColor = report.rate >= 80 ? 'var(--green)' : report.rate >= 50 ? 'var(--amber)' : 'var(--red)';
    body.innerHTML = `
      <div class="report-grid">
        <div class="report-stat">
          <div class="report-stat-value" style="color:${rateColor}">${report.completed}/${report.total}</div>
          <div class="report-stat-label">Tasks hoàn thành</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-value" style="color:${rateColor}">${report.rate}%</div>
          <div class="report-stat-label">Tỉ lệ</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-value">🔥 ${report.maxStreak}</div>
          <div class="report-stat-label">Streak cao nhất</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-value">${report.activeDays}/${report.totalDays}</div>
          <div class="report-stat-label">Ngày hoạt động</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-value">+${report.pointsEarned}</div>
          <div class="report-stat-label">Điểm kiếm được</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-value">${topMood}</div>
          <div class="report-stat-label">Mood chủ đạo</div>
        </div>
      </div>
      <div class="report-summary">
        Tuần này bạn hoàn thành <b>${report.completed}/${report.total}</b> tasks, streak <b>${report.maxStreak} ngày</b>, viết nhật ký <b>${journalDays}/7</b> ngày${topMoodEntry ? `, mood chủ đạo: ${topMoodEntry[0]}` : ''}.
        ${report.rate >= 80 ? ' Tuyệt vời! 🎉' : report.rate >= 50 ? ' Khá tốt, cố lên! 💪' : ' Hãy cố gắng hơn nhé! 🐰'}
      </div>
    `;
  } catch(e) { console.error('loadWeeklyReport:', e); }
}

// ─── WEEK vs WEEK COMPARISON ─────────────────────────────
async function loadWeekComparison() {
  try {
    const body = document.getElementById('week-comparison-body');
    if (!body) return;
    const thisWeek = getWeekDates(0);
    const lastWeek = getWeekDates(-1);
    const [thisReport, lastReport] = await Promise.all([
      apiTasks.report(tds(thisWeek[0]), tds(thisWeek[6])),
      apiTasks.report(tds(lastWeek[0]), tds(lastWeek[6]))
    ]);

    function pctChange(curr, prev) {
      if (prev === 0 && curr === 0) return { val: 0, text: '—', cls: 'neutral' };
      if (prev === 0) return { val: 100, text: '+100%', cls: 'up' };
      const p = Math.round(((curr - prev) / prev) * 100);
      return { val: p, text: (p >= 0 ? '+' : '') + p + '%', cls: p > 0 ? 'up' : p < 0 ? 'down' : 'neutral' };
    }

    const metrics = [
      { label: 'Tasks hoàn thành', curr: thisReport.completed, prev: lastReport.completed },
      { label: 'Tỉ lệ hoàn thành', curr: thisReport.rate, prev: lastReport.rate, suffix: '%' },
      { label: 'Streak cao nhất', curr: thisReport.maxStreak, prev: lastReport.maxStreak },
      { label: 'Ngày hoạt động', curr: thisReport.activeDays, prev: lastReport.activeDays },
      { label: 'Điểm kiếm được', curr: thisReport.pointsEarned, prev: lastReport.pointsEarned },
    ];

    body.innerHTML = `<div class="comparison-grid">
      ${metrics.map(m => {
        const chg = pctChange(m.curr, m.prev);
        const arrow = chg.cls === 'up' ? '↑' : chg.cls === 'down' ? '↓' : '→';
        return `<div class="comparison-item">
          <div class="comparison-label">${m.label}</div>
          <div class="comparison-values">
            <span class="comparison-prev">${m.prev}${m.suffix || ''}</span>
            <span class="comparison-arrow comparison-${chg.cls}">${arrow}</span>
            <span class="comparison-curr">${m.curr}${m.suffix || ''}</span>
          </div>
          <div class="comparison-change comparison-${chg.cls}">${chg.text} so với tuần trước</div>
        </div>`;
      }).join('')}
    </div>`;
  } catch(e) { console.error('loadWeekComparison:', e); }
}

// ─── MOOD LINE CHART 30 DAYS ─────────────────────────────
async function loadMoodLineChart() {
  try {
    const end = tds(state.today);
    const start = tds(addDays(state.today, -29));
    const entries = await apiJournal.range(start, end);

    const MOOD_SCORE = { '🌸': 5, '😊': 4, '😌': 3, '😴': 2, '😤': 1, '😢': 0 };
    const MOOD_LABELS = { 5: '🌸', 4: '😊', 3: '😌', 2: '😴', 1: '😤', 0: '😢' };
    const MOOD_COLORS = { '🌸': '#ff85c8', '😊': '#ffcf5c', '😌': '#b07fff', '😴': '#5ee8f0', '😤': '#ff9900', '😢': '#7cb9ff' };

    const moodByDate = {};
    if (entries?.length) {
      entries.forEach(e => { if (e.mood && e.date) moodByDate[e.date.slice(0,10)] = e.mood; });
    }

    const labels = [], data = [], pointColors = [], dayOfWeekScores = {};
    for (let i = 0; i < 30; i++) {
      const d = addDays(state.today, -29 + i);
      const ds = tds(d);
      labels.push(d.getDate() + '/' + (d.getMonth()+1));
      const mood = moodByDate[ds];
      if (mood && MOOD_SCORE[mood] !== undefined) {
        data.push(MOOD_SCORE[mood]);
        pointColors.push(MOOD_COLORS[mood] || '#b07fff');
        const dow = d.getDay();
        if (!dayOfWeekScores[dow]) dayOfWeekScores[dow] = [];
        dayOfWeekScores[dow].push(MOOD_SCORE[mood]);
      } else {
        data.push(null);
        pointColors.push('transparent');
      }
    }

    const ctx = document.getElementById('chart-mood-line')?.getContext('2d');
    if (!ctx) return;
    if (state.charts['mood-line']) state.charts['mood-line'].destroy();
    const c = chartColors();

    state.charts['mood-line'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Cảm xúc',
          data,
          borderColor: '#b07fff',
          backgroundColor: 'rgba(176,127,255,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          spanGaps: true,
          pointHoverRadius: 9,
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
              label: ct => {
                const score = ct.parsed.y;
                return score !== null ? ` ${MOOD_LABELS[score] || ''} (${score}/5)` : ' Không có dữ liệu';
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.tick, font: { size: 9 }, maxRotation: 45 } },
          y: {
            min: -0.5, max: 5.5,
            grid: { color: c.grid },
            ticks: {
              color: c.tick, font: { size: 12 }, stepSize: 1,
              callback: v => MOOD_LABELS[v] || ''
            }
          }
        }
      }
    });

    // Trend summary — find worst day of week
    const summary = document.getElementById('mood-trend-summary');
    if (summary) {
      const DOW_NAMES = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dowAvg = {};
      Object.entries(dayOfWeekScores).forEach(([dow, scores]) => {
        dowAvg[dow] = scores.reduce((a,b) => a+b, 0) / scores.length;
      });
      const sorted = Object.entries(dowAvg).sort((a,b) => a[1] - b[1]);
      const validEntries = data.filter(d => d !== null).length;

      if (sorted.length >= 2) {
        const worst = sorted[0], best = sorted[sorted.length - 1];
        const worstMood = MOOD_LABELS[Math.round(worst[1])] || '';
        const bestMood = MOOD_LABELS[Math.round(best[1])] || '';
        summary.innerHTML = `📊 ${validEntries}/30 ngày có dữ liệu · Bạn thường vui nhất vào <b>${DOW_NAMES[best[0]]}</b> ${bestMood} · Thấp nhất vào <b>${DOW_NAMES[worst[0]]}</b> ${worstMood}`;
      } else if (validEntries > 0) {
        summary.textContent = `📊 ${validEntries}/30 ngày có dữ liệu. Viết nhật ký thường xuyên hơn để thấy xu hướng!`;
      } else {
        summary.textContent = 'Chưa có dữ liệu cảm xúc. Hãy viết nhật ký mỗi ngày nhé!';
      }
    }
  } catch(e) { console.error('loadMoodLineChart:', e); }
}

// ─── PRODUCTIVE HOURS CHART ──────────────────────────────
async function loadProductiveHours() {
  try {
    const end = tds(state.today);
    const start = tds(addDays(state.today, -29));
    const data = await apiTasks.productiveHours(start, end);

    const ctx = document.getElementById('chart-productive-hours')?.getContext('2d');
    if (!ctx) return;
    if (state.charts['productive-hours']) state.charts['productive-hours'].destroy();
    const c = chartColors();

    const labels = [];
    const barColors = [];
    const maxCount = Math.max(...data.byHour, 1);
    for (let h = 0; h < 24; h++) {
      labels.push(h + 'h');
      // Gradient: low = dim purple, high = bright green
      const intensity = data.byHour[h] / maxCount;
      if (data.peakHours.length > 0 && data.peakHours[0].hour === h) {
        barColors.push('#5ef0a0'); // Peak hour = green
      } else if (intensity > 0.6) {
        barColors.push('#3ddbb8');
      } else if (intensity > 0.3) {
        barColors.push('#b07fff');
      } else if (data.byHour[h] > 0) {
        barColors.push('rgba(176,127,255,0.5)');
      } else {
        barColors.push('rgba(176,127,255,0.15)');
      }
    }

    state.charts['productive-hours'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Tasks hoàn thành',
          data: data.byHour,
          backgroundColor: barColors,
          borderRadius: 4,
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
            callbacks: { label: ct => ` ${ct.parsed.y} task${ct.parsed.y !== 1 ? 's' : ''}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.tick, font: { size: 9 } } },
          y: { grid: { color: c.grid }, ticks: { color: c.tick, font: { size: 10 }, stepSize: 1 }, beginAtZero: true }
        }
      }
    });

    // Summary
    const summary = document.getElementById('productive-hours-summary');
    if (summary) {
      if (data.totalCompleted === 0) {
        summary.textContent = 'Chưa có dữ liệu. Hoàn thành tasks để thấy phân tích!';
      } else if (data.peakHours.length > 0) {
        const peakLabels = data.peakHours.map(p => {
          const h = p.hour;
          const period = h < 6 ? '🌙 Đêm' : h < 12 ? '🌅 Sáng' : h < 18 ? '☀️ Chiều' : '🌆 Tối';
          return `<b>${h}:00-${h}:59</b> (${p.count} tasks, ${period})`;
        });
        summary.innerHTML = `⏰ Giờ hiệu quả nhất: ${peakLabels.join(' · ')} — Tổng ${data.totalCompleted} tasks trong 30 ngày`;
      }
    }
  } catch(e) { console.error('loadProductiveHours:', e); }
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
    const streakLookup = t.isGroup && t.groupTitles ? t.groupTitles[0] : t.title;
    try{sd=await apiTasks.streak(streakLookup);}catch(_){}
    const card=document.createElement('div');
    card.className='ttc';
    const groupTag = t.isGroup ? `<div class="ttc-group-badge">📂 Nhóm: ${t.groupTitles.length} tasks</div>` : '';
    const groupMembers = t.isGroup && t.groupTitles ? `<div class="ttc-group-members">${t.groupTitles.map(m=>`<span class="ttc-member">${esc(m)}</span>`).join('')}</div>` : '';
    // For grouped tasks, use the first member title for streak lookup
    const streakTitle = t.isGroup && t.groupTitles ? t.groupTitles[0] : t.title;
    card.innerHTML=`
      <div class="ttc-top">
        <div class="ttc-rank">${i+1}</div>
        <div class="ttc-name" title="${esc(t.title)}">${esc(t.isGroup ? t.groupTitles[0] : t.title)}${t.isGroup ? ` <span style="color:var(--text3);font-size:11px">(+${t.groupTitles.length-1})</span>` : ''}</div>
        <div class="ttc-meta">
          <span class="ttc-count">${t.total}×</span>
          <span class="ttc-fire">${streakFlames(sd.currentStreak||0)}</span>
        </div>
      </div>
      ${groupMembers}
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

// ─── STREAK TIER SYSTEM (milestones at 10, 20, 30 ...) ───────────────────────
function getStreakTier(n) {
  if (n >= 50) return 6;
  if (n >= 40) return 5;
  if (n >= 30) return 4;
  if (n >= 20) return 3;
  if (n >= 10) return 2;
  return 1;
}

// Flame sizes per tier (px)
const FLAME_SIZES = [20, 24, 28, 33, 38, 44];

// Duolingo-style streak flame: single animated emoji + bold count
function streakFlames(n) {
  if (n <= 0) return '<span style="color:var(--text3);font-size:12px">—</span>';
  const tier = getStreakTier(n);
  const sz   = FLAME_SIZES[tier - 1];
  // milestone label at exact multiples of 10
  const isMilestone = n > 0 && n % 10 === 0;
  const milestone = isMilestone ? `<span class="sfl-milestone sfl-milestone-t${tier}">🏆 ${n} ngày!</span>` : '';
  return `<span class="sfl sfl-t${tier}" style="font-size:${sz}px" title="${n} ngày streak">🔥</span><span class="sfl-count sfl-count-t${tier}">${n}</span>${milestone}`;
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

  // pct fills to tier cap (50 days = 100%)
  const pct = Math.min(100, Math.round((n / 50) * 100));

  // Color stops: 1 day = pale yellow, 31 days = deep red
  // We interpolate 5 color zones
  const stops = getFireStops(n);

  // Glow intensity grows with n (cap at 50 days)
  const glowAlpha = Math.min(0.85, 0.15 + (n / 50) * 0.7);
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
  // Tier-of-10 milestones
  if(n >= 50) return { left:'#cc0000', mid:'#ff2200', right:'#ff8800', glow:'rgba(255,0,0,.85)' };
  if(n >= 40) return { left:'#dd1100', mid:'#ff3300', right:'#ff8800', glow:'rgba(255,30,0,.75)' };
  if(n >= 30) return { left:'#ff1100', mid:'#ff5500', right:'#ffaa00', glow:'rgba(255,50,0,.7)' };
  if(n >= 20) return { left:'#ff4400', mid:'#ff7700', right:'#ffcc00', glow:'rgba(255,80,0,.6)' };
  if(n >= 10) return { left:'#ff7700', mid:'#ffaa00', right:'#ffe044', glow:'rgba(255,140,0,.5)' };
              return { left:'#ffaa00', mid:'#ffcc55', right:'#fff0aa', glow:'rgba(255,200,0,.35)' };
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
  if(totalTasks === 0){
    summary.innerHTML = `<span class="hms-item hms-empty">🌱 Chưa có task nào trong 3 tháng qua — hãy bắt đầu ngay hôm nay!</span>`;
  } else {
    summary.innerHTML = `
      <span class="hms-item">📅 <b>${WEEKS * 7}</b> ngày</span>
      <span class="hms-sep">·</span>
      <span class="hms-item">⚡ <b>${activeDays}</b> ngày hoạt động</span>
      <span class="hms-sep">·</span>
      <span class="hms-item">✅ <b>${totalDone}</b>/<b>${totalTasks}</b> tasks</span>
      <span class="hms-sep">·</span>
      <span class="hms-item hms-rate" style="color:${rate>=80?'var(--green)':rate>=50?'var(--accent)':'var(--text3)'}"><b>${rate}%</b> hoàn thành</span>
    `;
  }
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
          if (log.leveledUp) setTimeout(() => showLevelUpAnimation(log.oldLevel, log.newLevel), 800);
        } else {
          const pts = log.pointsDeducted || 5;
          toast(`${h.emoji} Đã bỏ tích — trừ ${pts}⭐`);
          updatePointsUI(Math.max(0, (_shopData.points||0) - pts));
        }
        refreshAll().catch(()=>{});    // sync calendar indicators + stats + badge
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
    // Distinct, high-contrast colors for each line (avoids same-color problem)
    const TREND_COLORS = ['#5ef0a0','#ff85c8','#ffcf5c','#5ee8f0','#ff6b8a','#b07fff','#ffa048','#7cb9ff'];
    const datasets = ana.slice(0,4).map((h,i)=>{
      const lineColor = TREND_COLORS[i % TREND_COLORS.length];
      return {
        label:`${h.emoji} ${h.name}`,
        data: h.weeklyData.map(w=>w.rate),
        borderColor: lineColor, backgroundColor: lineColor+'20',
        borderWidth:2.5, pointRadius:4, pointBackgroundColor:lineColor, tension:.4, fill:false
      };
    });
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
    const habitCat=document.querySelector('#habit-category-selector .cat-btn.active')?.dataset.cat||'other';
    await apiHabits.add({name,emoji:state.selectedEmoji,color:state.selectedColor,category:habitCat});
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
  document.querySelectorAll('#habit-category-selector .cat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('#habit-category-selector .cat-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
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
  document.getElementById('jp-save-btn').addEventListener('click', async(e)=>{
    const btn = e.currentTarget;
    if(btn.dataset.busy) return;
    const mood    = document.querySelector('.jp-mood-btn.active')?.dataset.mood||'';
    const content = document.getElementById('jp-textarea').value.trim();
    if(!mood){ toast('Chọn tâm trạng trước nhé!'); return; }
    btn.dataset.busy='1'; btn.disabled=true; btn.textContent='Đang lưu...';
    try {
      await apiJournal.save(dateStr, mood, content);
      showJournalSaved(mood, content);
      toast('✍️ Đã lưu nhật ký!');
      renderCalendar();                // cập nhật emoji tâm trạng trong lịch
      quickNotifCheck();
    } finally {
      delete btn.dataset.busy; btn.disabled=false; btn.textContent='Lưu ✓';
    }
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
  if (page === 'garden' && _gardenData) {
    setTimeout(() => _initGarden3D(), 100);
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

  // Notification bell
  const _bellBtn    = document.getElementById('notif-bell-btn');
  const _notifPanel = document.getElementById('notif-panel');
  const _notifClose = document.getElementById('notif-panel-close');
  _bellBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = _notifPanel.style.display !== 'none';
    if (isOpen) {
      _notifPanel.style.display = 'none';
    } else {
      _notifPanel.style.display = 'flex';
      loadNotifications();
    }
  });
  _notifClose?.addEventListener('click', () => { _notifPanel.style.display = 'none'; });

  // Notif detail overlay
  const _notifDetailOverlay = document.getElementById('notif-detail-overlay');
  const _notifDetailBack    = document.getElementById('notif-detail-back');
  _notifDetailBack?.addEventListener('click', () => {
    if (_notifDetailOverlay) _notifDetailOverlay.style.display = 'none';
  });
  _notifDetailOverlay?.addEventListener('click', (e) => {
    if (e.target === _notifDetailOverlay) _notifDetailOverlay.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (_notifPanel && _notifPanel.style.display !== 'none' && !e.target.closest('#notif-bell-wrap')) {
      _notifPanel.style.display = 'none';
    }
  });

  // Level badge click → go to gamification page
  document.getElementById('header-level-badge')?.addEventListener('click', () => navigateTo('gamification'));

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
  // Initial notification badge check (fast, no panel render)
  setTimeout(() => quickNotifCheck(), 2500);
  // Check fire/friend notifications on load (shows overlay if needed)
  setTimeout(() => checkFireNotifications(), 3500);
  setTimeout(() => checkGiftNotifications(), 4500);
  // Poll notification badge every 45 seconds
  setInterval(() => quickNotifCheck(), 45000);

  // Fire overlay buttons + gift modal — init here so they work on ANY page
  initFireOverlay();
  initGiftModal();
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

const CHANGELOG = [
  { version:'v2.5', date:'17/04/2026', icon:'🌿', title:'Cây cối chuyển sang Vườn', isNew:true,
    desc:'Toàn bộ cây cối (cây cảnh, hoa...) nay chỉ xuất hiện trong tab Vườn — không còn chạy trên màn hình. Nếu bạn từng mua cây, điểm đã được hoàn lại tự động.' },
  { version:'v2.4', date:'03/04/2026', icon:'📊', title:'Thống kê nâng cao', isNew:false,
    desc:'Hành trình cá nhân (ngày dùng app, tổng tasks, habits, điểm), tiến bộ theo tháng (line chart 12 tháng), cân bằng cuộc sống (radar chart 5 danh mục), cột mốc sắp tới với progress bar.' },
  { version:'v2.4', date:'03/04/2026', icon:'🏆', title:'Kho lưu trữ mục tiêu', isNew:false,
    desc:'Mục tiêu đã kết thúc (dù bỏ lỡ vài ngày) có thể lưu vào kho. Xem lại lịch sử với thống kê: tổng mục tiêu, ngày hoàn thành, tỉ lệ TB, mục tiêu hoàn hảo.' },
  { version:'v2.3', date:'03/04/2026', icon:'🎁', title:'Hiệu ứng quà tặng', isNew:false,
    desc:'Mỗi vật phẩm tặng bạn bè có hiệu ứng riêng: ⭐ Sao mở lì xì random 10-100 điểm, 🍫 Socola bay trái tim, 🌹 Hoa rơi cánh, 🐇 Thỏ chạy ngang màn hình, 🐟 Cá nhảy lên...' },
  { version:'v2.3', date:'02/04/2026', icon:'💬', title:'Nhắn tin bạn bè', isNew:false,
    desc:'Chat trực tiếp với từng người bạn. Cửa sổ chat toàn màn hình, tin nhắn cập nhật mỗi 4 giây, hiển thị chuỗi lửa 🔥 của cả hai.' },
  { version:'v2.2', date:'02/04/2026', icon:'🐾', title:'Biến thể thú cưng', isNew:false,
    desc:'10 biến thể tên + emoji riêng cho mỗi loài động vật. Cây cối có tint màu CSS độc đáo. Vòng cổ tên hiển thị dưới thú cưng floating. Modal đặt tên với gợi ý theo loài.' },
  { version:'v2.1', date:'01/04/2026', icon:'🎮', title:'Thử thách tuần & Leaderboard', isNew:false,
    desc:'Nhiệm vụ ngẫu nhiên mỗi tuần (hoàn thành task, ghi nhật ký, duy trì thói quen...). Bảng xếp hạng bạn bè theo tổng điểm.' },
  { version:'v2.0', date:'28/03/2026', icon:'🔥', title:'Truyền lửa & Gamification', isNew:false,
    desc:'50 câu động viên ngẫu nhiên. Người nhận có hiệu ứng lửa toàn màn hình. Hệ thống level 20 cấp, tiền thưởng task tăng theo level. Huy hiệu thành tích.' },
];

const USAGE_GUIDE = [
  { icon:'📋', title:'Tasks & Danh mục',
    desc:'Tạo task hàng ngày với 4 mức ưu tiên. Gán danh mục (Công việc / Sức khỏe / Học tập / Cá nhân) để xem biểu đồ cân bằng cuộc sống trong Thống kê.' },
  { icon:'🐇', title:'Thói quen (Habits)',
    desc:'Tick mỗi ngày để duy trì streak 🔥. Mua Streak Freeze Card ở Cửa hàng để bảo vệ chuỗi khi bận. Xem heatmap và xu hướng 8 tuần trong Thống kê.' },
  { icon:'🎯', title:'Mục tiêu dài hạn',
    desc:'Tạo kế hoạch nhiều ngày, đặt task cho từng ngày. Khi hết thời hạn nhấn 🏆 để lưu vào Kho lưu trữ. Mục tiêu 100% sẽ được ghi nhận là Hoàn hảo 💯.' },
  { icon:'🐾', title:'Thú cưng',
    desc:'Mua ở Cửa hàng, đặt tên khi nhận. Động vật cần ăn mỗi ngày, cây cần tưới nước. Bỏ bê 3 ngày → mất điểm, 7 ngày → thú cưng qua đời 😢.' },
  { icon:'🎁', title:'Tặng quà & Truyền lửa',
    desc:'Nhấn 🎁 để tặng vật phẩm từ kho của bạn — mỗi vật phẩm có hiệu ứng riêng trên màn hình người nhận. Nhấn 🔥 để gửi câu động viên, 1 lần/ngày/người.' },
  { icon:'📊', title:'Thống kê & Tiến bộ',
    desc:'Xem hành trình từ ngày đầu, điểm tiến bộ 12 tháng, cân bằng cuộc sống, và cột mốc sắp tới. Tất cả trong tab Thống kê.' },
];

async function loadNotifications() {
  const body  = document.getElementById('notif-panel-body');
  const badge = document.getElementById('notif-bell-badge');
  if (!body) return;

  let urgentCount = 0;
  let html = '';
  const todayStr = tds(state.today);

  // ─── Fetch all social + task data in parallel ───────────────────────────────
  const [notifRes, convosRes, firesRes, overdueRes, petsRes, todayTasksRes] = await Promise.allSettled([
    apiGamification.notifications(),
    apiGamification.conversations(),
    apiGamification.getFires(),
    API.g('/api/tasks/overdue'),
    apiShop.pets(),
    API.g(`/api/tasks?startDate=${todayStr}&endDate=${todayStr}`)
  ]);
  const notifData    = notifRes.status    === 'fulfilled' ? notifRes.value    : {};
  const convos       = convosRes.status   === 'fulfilled' ? convosRes.value   : [];
  const fires        = firesRes.status    === 'fulfilled' ? firesRes.value    : [];
  const overdue      = overdueRes.status  === 'fulfilled' ? overdueRes.value  : [];
  const pets         = petsRes.status     === 'fulfilled' ? petsRes.value     : [];
  const todayTasks   = todayTasksRes.status === 'fulfilled' ? todayTasksRes.value : [];

  // ─── 1. FRIEND REQUESTS ─────────────────────────────────────────────────────
  const reqCount = notifData.requestCount || 0;
  if (reqCount > 0) {
    urgentCount += reqCount;
    html += `<div class="notif-section-title">👥 Lời mời kết bạn</div>
    <div class="notif-item notif-urgent notif-goto" data-goto-tab="game">
      <span class="notif-item-icon">🤝</span>
      <div class="notif-item-body">
        <div class="notif-item-title">${reqCount} lời mời kết bạn đang chờ</div>
        <div class="notif-item-sub">Nhấn để vào trang Bạn bè &amp; chấp nhận</div>
      </div>
      <span class="notif-arrow">›</span>
    </div>`;
  }

  // ─── 2. RECEIVED FIRES ──────────────────────────────────────────────────────
  if (fires.length > 0) {
    urgentCount += fires.length;
    html += `<div class="notif-section-title">🔥 Lửa nhận được (${fires.length})</div>`;
    fires.slice(0, 4).forEach(f => {
      const msg = (f.message || '').slice(0, 60);
      const detailTitle = encodeURIComponent(`🔥 ${esc(f.fromName)} truyền lửa!`);
      const detailBody  = encodeURIComponent(
        `<p><span class="notif-detail-badge">🔥 Ngọn lửa từ ${esc(f.fromName)}</span></p>` +
        `<p><strong>${esc(f.fromName)}</strong> ${esc(f.message)}</p>` +
        `<p style="font-size:12px;color:#aaa">Hãy truyền lửa lại để giữ chuỗi lửa chung!</p>`
      );
      const alreadySent = f.alreadySentBack
        ? `<span style="font-size:10px;color:#5ef0a0">✅ Đã gửi lại</span>`
        : `<span style="font-size:10px;color:#ffaa44">🔥 Gửi lại ngay</span>`;
      html += `<div class="notif-item notif-urgent notif-fire-item clickable" data-detail-title="${detailTitle}" data-detail-body="${detailBody}">
        <span class="notif-item-icon">🔥</span>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(f.fromName)} truyền lửa cho bạn!</div>
          <div class="notif-item-sub">${esc(msg)}${f.message.length > 60 ? '…' : ''}</div>
        </div>
        <div style="flex-shrink:0;text-align:right">${alreadySent}</div>
      </div>`;
    });
    if (fires.length > 4) html += `<div class="notif-more">+${fires.length-4} lửa khác…</div>`;
  }

  // ─── 3. UNREAD MESSAGES ─────────────────────────────────────────────────────
  const unreadConvos = convos.filter(c => c.unread > 0);
  if (unreadConvos.length > 0) {
    const totalMsg = unreadConvos.reduce((s, c) => s + c.unread, 0);
    urgentCount += totalMsg;
    html += `<div class="notif-section-title">💬 Tin nhắn chưa đọc (${totalMsg})</div>`;
    unreadConvos.slice(0, 5).forEach(c => {
      const lastMsg = c.lastMessage?.content || '';
      const initials = (c.friendName||'?').slice(0,2).toUpperCase();
      html += `<div class="notif-item notif-urgent notif-msg-item" data-open-chat="${c.friendId}" data-fname="${esc(c.friendName)}" data-online="${c.isOnline}">
        <div class="notif-msg-avatar">${initials}</div>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(c.friendName)} <span class="notif-msg-count">${c.unread}</span></div>
          <div class="notif-item-sub">${esc(lastMsg).slice(0,55)}${lastMsg.length>55?'…':''}</div>
        </div>
        <span class="notif-arrow">›</span>
      </div>`;
    });
  }

  // ─── 3b. GARDEN VISITS ──────────────────────────────────────────────────────
  const gardenVisitCount = notifData.gardenVisitCount || 0;
  if (gardenVisitCount > 0) {
    urgentCount += gardenVisitCount;
    const visitsRes = await apiGamification.gardenVisits().catch(() => []);
    html += `<div class="notif-section-title">🌿 Bạn bè thăm vườn của bạn</div>`;
    (visitsRes || []).slice(0, 5).forEach(v => {
      const timeAgo = timeAgoVi(new Date(v.visitedAt));
      html += `<div class="notif-item notif-urgent notif-garden-visit notif-goto" data-goto-tab="garden">
        <span class="notif-item-icon">🌿</span>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(v.fromName)} đã thăm vườn của bạn!</div>
          <div class="notif-item-sub">${timeAgo} · Nhấn để vào vườn</div>
        </div>
        <span class="notif-arrow">›</span>
      </div>`;
    });
    if (gardenVisitCount > 5) html += `<div class="notif-more">+${gardenVisitCount - 5} lượt thăm khác…</div>`;
    // Mark as seen
    apiGamification.gardenVisitsSeen().catch(() => {});
  }

  // ─── 4. DEAD PETS ───────────────────────────────────────────────────────────
  const dead = pets.filter(p => !p.alive);
  const seenDead = JSON.parse(localStorage.getItem('rh-seen-dead-pets') || '[]');
  const newDead  = dead.filter(p => !seenDead.includes(p._id));
  if (newDead.length) {
    urgentCount += newDead.length;
    html += `<div class="notif-section-title">💀 Thú cưng/Cây đã mất</div>`;
    newDead.forEach(p => {
      const detailTitle = encodeURIComponent(`😢 ${p.name} đã qua đời`);
      const detailBody  = encodeURIComponent(`<p><span class="notif-detail-badge">${p.emoji} ${esc(p.name)}</span></p><p><strong>${esc(p.name)}</strong> đã mất vì không được chăm sóc trong quá lâu.</p><p>Bạn có thể mua thú cưng/cây mới tại tab <strong>Cửa hàng</strong> và chăm sóc chúng mỗi ngày để tránh điều này xảy ra lần nữa.</p><p style="color:#ff6b8a;font-size:12px">💡 Động vật cần ăn mỗi ngày, cây cần tưới nước — bỏ bê 3 ngày mất điểm, 7 ngày thú cưng qua đời.</p>`);
      html += `<div class="notif-item notif-urgent clickable" data-detail-title="${detailTitle}" data-detail-body="${detailBody}" data-mark-dead="${p._id}">
        <span class="notif-item-icon" style="opacity:.5">${p.emoji}</span>
        <div class="notif-item-body">
          <div class="notif-item-title" style="color:#ff6b8a">${esc(p.name)} đã qua đời 😢</div>
          <div class="notif-item-sub">Không được chăm sóc — Nhấn để xem chi tiết</div>
        </div>
      </div>`;
    });
  }

  // ─── 5. SICK PETS (chỉ động vật) ───────────────────────────────────────────
  const isAnimalType = t => ['rabbit','cat','dog','hamster','bird'].includes(t);
  const sick = pets.filter(p => p.alive && !p.hidden && p.health < 70 && isAnimalType(p.type));
  if (sick.length) {
    urgentCount += sick.length;
    html += `<div class="notif-section-title">🐾 Thú cưng cần chăm sóc</div>`;
    sick.forEach(p => {
      const detailTitle = encodeURIComponent(`${p.emoji} ${p.name} cần chăm sóc`);
      const detailBody  = encodeURIComponent(`<p><span class="notif-detail-badge">${p.emoji} ${esc(p.name)}</span></p><p>Sức khỏe hiện tại: <strong>${p.health}%</strong></p><p>${p.health < 30 ? '⚠️ <strong>Nguy hiểm!</strong> Thú cưng sắp qua đời.' : '⚠️ Thú cưng cần được chăm sóc ngay hôm nay.'}</p><p>Hãy vào tab <strong>Thú cưng</strong> để cho ${['rabbit','cat','dog','hamster','bird'].includes(p.type)?'ăn 🍎':'uống nước 💧'}.</p>`);
      html += `<div class="notif-item notif-urgent clickable" data-detail-title="${detailTitle}" data-detail-body="${detailBody}">
        <span class="notif-item-icon">${p.emoji}</span>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(p.name)}</div>
          <div class="notif-item-sub">Sức khỏe: ${p.health}% — Cần chăm sóc ngay!</div>
        </div>
      </div>`;
    });
  }

  // ─── 6. OVERDUE TASKS (tất cả task chưa hoàn thành trước hôm nay) ───────────
  if (overdue.length > 0) {
    urgentCount += overdue.length;
    html += `<div class="notif-section-title">⚠️ Task chưa hoàn thành (${overdue.length})</div>`;
    html += `<div class="notif-push-bar">
      <span class="notif-push-info">📅 Đẩy tất cả ${overdue.length} task lên hôm nay?</span>
      <button class="notif-push-btn" id="notif-push-today-btn">Đẩy lên hôm nay</button>
    </div>`;
    const prioLabels = ['Bình thường','Thấp','Trung bình','Cao'];
    const prioIcons  = ['⚪','🟡','🟠','🔴'];
    overdue.slice(0, 6).forEach(t => {
      const d = new Date(t.date + 'T00:00:00');
      const daysAgo = Math.round((state.today - d) / 86400000);
      const dLabel  = daysAgo === 1 ? 'Hôm qua' : `${daysAgo} ngày trước`;
      const detailTitle = encodeURIComponent(`⚠️ ${esc(t.title)}`);
      const detailBody  = encodeURIComponent(
        `<p><span class="notif-detail-badge">${prioIcons[t.priority]||'⚪'} ${prioLabels[t.priority]||'Bình thường'} · ${dLabel}</span></p>` +
        `<p>Task <strong>"${esc(t.title)}"</strong> từ <strong>${dLabel}</strong> vẫn chưa hoàn thành.</p>` +
        `<p>Bạn có thể hoàn thành task này trong tab <strong>Hôm nay</strong> hoặc xoá nếu không còn phù hợp.</p>`
      );
      html += `<div class="notif-item notif-overdue clickable" data-detail-title="${detailTitle}" data-detail-body="${detailBody}">
        <span class="notif-item-icon">${prioIcons[t.priority]||'⚪'}</span>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(t.title)}</div>
          <div class="notif-item-sub">${dLabel} · ${prioLabels[t.priority]||'Bình thường'}</div>
        </div>
      </div>`;
    });
    if (overdue.length > 6) html += `<div class="notif-more">+${overdue.length-6} task khác…</div>`;
  }

  // ─── 7. TODAY'S INCOMPLETE TASKS ────────────────────────────────────────────
  const incomplete = (todayTasks||[]).filter(t => !t.completed);
  if (incomplete.length) {
    urgentCount += incomplete.length;
    const prioLabels = ['Bình thường','Thấp','Trung bình','Cao'];
    const prioIcons  = ['⚪','🟡','🟠','🔴'];
    const pts        = [5,5,8,12];
    html += `<div class="notif-section-title">📋 Task hôm nay chưa xong (${incomplete.length})</div>`;
    incomplete.slice(0, 5).forEach(t => {
      const detailTitle = encodeURIComponent(`📋 ${esc(t.title)}`);
      const detailBody  = encodeURIComponent(
        `<p><span class="notif-detail-badge">${prioIcons[t.priority]||'⚪'} Độ ưu tiên: ${prioLabels[t.priority]||'Bình thường'}</span></p>` +
        `<p>Task <strong>"${esc(t.title)}"</strong> chưa được hoàn thành hôm nay.</p>` +
        `<p>Hoàn thành để nhận <strong>+${pts[t.priority]||5} điểm</strong>.</p>`
      );
      html += `<div class="notif-item clickable" data-detail-title="${detailTitle}" data-detail-body="${detailBody}">
        <span class="notif-item-icon">⬜</span>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(t.title)}</div>
          <div class="notif-item-sub">${prioLabels[t.priority]||'Bình thường'} · +${pts[t.priority]||5} điểm</div>
        </div>
      </div>`;
    });
    if (incomplete.length > 5) html += `<div class="notif-more">+${incomplete.length-5} task khác…</div>`;
  }

  // ─── 8. PENDING GIFTS (UNOPENED) ────────────────────────────────────────────
  const pendingGifts = JSON.parse(localStorage.getItem('rh-pending-gifts') || '[]');
  if (pendingGifts.length) {
    urgentCount += pendingGifts.length;
    html += `<div class="notif-section-title">🎁 Quà chưa mở</div>`;
    pendingGifts.forEach((g, idx) => {
      html += `<div class="notif-item notif-urgent" data-pending-gift="${idx}" style="cursor:pointer">
        <span class="notif-item-icon">${g.itemEmoji}</span>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(g.fromName)} tặng ${g.qty}× ${g.itemName}</div>
          <div class="notif-item-sub">Nhấn để mở quà ✨</div>
        </div>
        <span class="notif-arrow">›</span>
      </div>`;
    });
  }

  // ─── 9. SYSTEM NOTIFICATIONS ────────────────────────────────────────────────
  const sysNotifCount = notifData.systemNotifCount || 0;
  if (sysNotifCount > 0) {
    const sysNotifs = await apiGamification.systemNotifications().catch(() => []);
    if (sysNotifs.length > 0) {
      urgentCount += sysNotifs.length;
      html += `<div class="notif-section-title">📢 Thông báo hệ thống</div>`;
      sysNotifs.forEach(n => {
        const detailTitle = encodeURIComponent(`${n.emoji} Thông báo hệ thống`);
        const detailBody  = encodeURIComponent(`<p><span class="notif-detail-badge">${n.emoji} Hệ thống</span></p><p>${esc(n.message)}</p>`);
        html += `<div class="notif-item notif-urgent clickable" data-detail-title="${detailTitle}" data-detail-body="${detailBody}" data-sys-notif="${n._id}">
          <span class="notif-item-icon">${n.emoji}</span>
          <div class="notif-item-body">
            <div class="notif-item-title">Thông báo từ hệ thống</div>
            <div class="notif-item-sub">${esc((n.message||'').slice(0, 70))}${(n.message||'').length > 70 ? '…' : ''}</div>
          </div>
        </div>`;
      });
      apiGamification.markSystemNotifSeen().catch(() => {});
    }
  }

  // ─── 10. CHANGELOG / NEW FEATURES ───────────────────────────────────────────
  html += `<div class="notif-section-title">✨ Bản cập nhật</div>`;
  CHANGELOG.forEach(c => {
    const newBadge    = c.isNew ? `<span class="notif-version-badge notif-update-new">MỚI</span> ` : '';
    const verBadge    = `<span class="notif-version-badge">${c.version}</span>`;
    const detailTitle = encodeURIComponent(`${c.icon} ${c.title} — ${c.version}`);
    const detailBody  = encodeURIComponent(`<p><span class="notif-detail-badge">${c.icon} ${c.version} · ${c.date}${c.isNew?' · <strong style="color:#5ef0a0">MỚI</strong>':''}</span></p><p>${c.desc}</p>`);
    html += `<div class="notif-item${c.isNew?' notif-update-new':''} clickable" data-detail-title="${detailTitle}" data-detail-body="${detailBody}">
      <span class="notif-item-icon">${c.icon}</span>
      <div class="notif-item-body">
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:3px">${newBadge}${verBadge}<span style="font-size:10px;color:var(--text3);padding-top:1px">${c.date}</span></div>
        <div class="notif-item-title">${c.title}</div>
        <div class="notif-item-sub">${c.desc}</div>
      </div>
    </div>`;
  });

  // ─── 10. USAGE GUIDE ─────────────────────────────────────────────────────────
  html += `<div class="notif-section-title">📖 Hướng dẫn sử dụng</div>`;
  USAGE_GUIDE.forEach(g => {
    const detailTitle = encodeURIComponent(`${g.icon} ${g.title}`);
    const detailBody  = encodeURIComponent(`<p>${g.desc}</p>`);
    html += `<div class="notif-item notif-guide-item clickable" data-detail-title="${detailTitle}" data-detail-body="${detailBody}">
      <div class="notif-item-icon">${g.icon}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${g.title}</div>
        <div class="notif-item-sub">${g.desc}</div>
      </div>
    </div>`;
  });

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  body.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--text3)">Không có thông báo nào 🎉</div>';

  // Wire up detail overlay clicks
  body.querySelectorAll('.clickable[data-detail-title]').forEach(el => {
    el.addEventListener('click', () => {
      const title   = decodeURIComponent(el.dataset.detailTitle || '');
      const bodyHtml = decodeURIComponent(el.dataset.detailBody || '');
      const overlay  = document.getElementById('notif-detail-overlay');
      const titleEl  = document.getElementById('notif-detail-title');
      const bodyEl   = document.getElementById('notif-detail-body');
      if (!overlay||!titleEl||!bodyEl) return;
      titleEl.textContent = title;
      bodyEl.innerHTML    = bodyHtml;
      overlay.style.display = 'flex';
      if (el.dataset.markDead) {
        const seen = JSON.parse(localStorage.getItem('rh-seen-dead-pets') || '[]');
        if (!seen.includes(el.dataset.markDead)) { seen.push(el.dataset.markDead); localStorage.setItem('rh-seen-dead-pets', JSON.stringify(seen)); }
        el.style.transition = 'opacity .4s';
        setTimeout(() => { el.style.opacity = '0.35'; }, 300);
      }
    });
  });

  // Wire up pending gift clicks
  body.querySelectorAll('[data-pending-gift]').forEach(el => {
    el.addEventListener('click', () => {
      const idx     = parseInt(el.dataset.pendingGift);
      const pending = JSON.parse(localStorage.getItem('rh-pending-gifts') || '[]');
      const g       = pending[idx];
      if (!g) return;
      pending.splice(idx, 1);
      localStorage.setItem('rh-pending-gifts', JSON.stringify(pending));
      document.getElementById('notif-panel').style.display = 'none';
      showGiftReceivedEffect(g);
      loadNotifications();
    });
  });

  // Wire up chat opens from message notifications
  body.querySelectorAll('.notif-msg-item[data-open-chat]').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('notif-panel').style.display = 'none';
      const page = document.getElementById('page-game');
      if (page && page.style.display === 'none') document.querySelector('[data-tab="game"]')?.click();
      setTimeout(() => openChatWindow(el.dataset.openChat, el.dataset.fname, el.dataset.online === 'true'), 150);
    });
  });

  // Wire up tab-navigation shortcuts
  body.querySelectorAll('.notif-goto[data-goto-tab]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      document.getElementById('notif-panel').style.display = 'none';
      document.querySelector(`[data-tab="${el.dataset.gotoTab}"]`)?.click();
    });
  });

  // Wire up "push all to today" button
  const pushBtn = document.getElementById('notif-push-today-btn');
  if (pushBtn) {
    pushBtn.addEventListener('click', async () => {
      pushBtn.disabled    = true;
      pushBtn.textContent = 'Đang xử lý…';
      try {
        const res = await API.p('/api/tasks/push-to-today', {});
        pushBtn.textContent = `✅ Đã đẩy ${res.updated} task lên hôm nay`;
        pushBtn.style.background = 'var(--success, #22c55e)';
        setTimeout(() => {
          document.getElementById('notif-panel').style.display = 'none';
          refreshAll();
        }, 800);
      } catch(e) {
        pushBtn.textContent = '❌ Lỗi, thử lại';
        pushBtn.disabled = false;
      }
    });
  }

  // Mark fires as seen after showing them in panel
  if (fires.length > 0) apiGamification.markFiresSeen().catch(() => {});

  // ─── BELL VISUAL STATE ───────────────────────────────────────────────────────
  _updateBellBadge(urgentCount);
}

/** Lightweight badge update — called from polling & after user actions */
async function quickNotifCheck() {
  try {
    const notifData   = await apiGamification.notifications();
    const petsRaw     = await apiShop.pets().catch(() => []);
    const pendingGifts = JSON.parse(localStorage.getItem('rh-pending-gifts') || '[]');
    const isAnimalT = t => ['rabbit','cat','dog','hamster','bird'].includes(t);
    const sick    = petsRaw.filter(p => p.alive && !p.hidden && p.health < 70 && isAnimalT(p.type)).length;
    const newDead = petsRaw.filter(p => !p.alive && isAnimalT(p.type) && !JSON.parse(localStorage.getItem('rh-seen-dead-pets')||'[]').includes(p._id)).length;
    const todayStr = tds(state.today);
    const todayTasks = await API.g(`/api/tasks?startDate=${todayStr}&endDate=${todayStr}`).catch(() => []);
    const overdueCount = await API.g('/api/tasks/overdue').catch(() => []);
    const incomplete  = (todayTasks||[]).filter(t => !t.completed).length;
    const urgentCount =
      (notifData.requestCount||0) +
      (notifData.fireCount||0) +
      (notifData.messageCount||0) +
      (notifData.gardenVisitCount||0) +
      (notifData.systemNotifCount||0) +
      sick + newDead + pendingGifts.length +
      incomplete + (overdueCount?.length||0);
    _updateBellBadge(urgentCount);
    // Update overdue banner on home page
    _updateOverdueBanner(overdueCount?.length || 0);
    // Update tab dot
    const dot = document.getElementById('tnav-notif-dot');
    if (dot) dot.style.display = notifData.total > 0 ? 'inline-block' : 'none';
    updateFriendNotifBadge(notifData.requestCount||0);
    // Update chat unread badge
    const chatBadge = document.getElementById('gf-chat-unread-badge');
    if (chatBadge) {
      const mc = notifData.messageCount || 0;
      chatBadge.textContent = mc;
      chatBadge.style.display = mc > 0 ? 'inline-flex' : 'none';
    }
  } catch(e) {}
}

function _updateBellBadge(count) {
  const badge   = document.getElementById('notif-bell-badge');
  const bellBtn = document.getElementById('notif-bell-btn');
  if (bellBtn) bellBtn.classList.toggle('has-notif', count > 0);
  if (badge) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? '' : 'none';
  }
}

let _overdueBannerWired = false;
function _updateOverdueBanner(count) {
  const banner = document.getElementById('overdue-banner');
  const text   = document.getElementById('overdue-banner-text');
  if (!banner) return;
  if (count <= 0) { banner.style.display = 'none'; return; }
  if (text) text.textContent = `⚠️ Bạn có ${count} task chưa hoàn thành từ các ngày trước`;
  banner.style.display = 'flex';
  if (!_overdueBannerWired) {
    _overdueBannerWired = true;
    document.getElementById('overdue-banner-btn')?.addEventListener('click', async function() {
      this.disabled    = true;
      this.textContent = 'Đang xử lý…';
      try {
        const res = await API.p('/api/tasks/push-to-today', {});
        this.textContent = `✅ Đã đẩy ${res.updated} task!`;
        this.style.background = 'var(--success, #22c55e)';
        setTimeout(() => {
          banner.style.display = 'none';
          _overdueBannerWired = false;
          refreshAll();
        }, 800);
      } catch(e) {
        this.textContent = '❌ Lỗi';
        this.disabled = false;
      }
    });
  }
}

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
  archive:   (id)         => API.pa(`/api/goals/${id}/archive`, {}),
  getArchive:()           => API.g('/api/goals/archive'),
  archiveStats:()         => API.g('/api/goals/archive/stats'),
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

async function loadGoalArchiveSection(){
  const section = document.getElementById('goals-archive-section');
  if(!section) return;
  try {
    const archived = await apiGoals.getArchive();
    if(!archived.length){ section.style.display='none'; return; }
    section.style.display='';

    // Toggle button
    const toggleBtn = document.getElementById('goal-archive-toggle-btn');
    const archiveList = document.getElementById('goals-archive-list');
    const archiveStats = document.getElementById('goals-archive-stats');

    toggleBtn.onclick = async () => {
      const open = archiveList.style.display !== 'none';
      if(open){
        archiveList.style.display='none';
        archiveStats.style.display='none';
        toggleBtn.textContent='Xem kho';
      } else {
        archiveList.style.display='';
        toggleBtn.textContent='Ẩn kho';
        renderGoalArchiveList(archived, archiveList);
        renderGoalArchiveStats(archiveStats);
      }
    };
  } catch(e){ console.error('loadGoalArchiveSection error:', e); }
}

function renderGoalArchiveList(goals, container){
  container.innerHTML = '';
  goals.forEach(g => {
    const done = g.days.filter(d=>d.done).length;
    const pct  = g.totalDays > 0 ? Math.round((done/g.totalDays)*100) : 0;
    const color = g.color || '#b07fff';
    const barColor = progressColor(pct);
    const perfect = pct === 100;
    const startD = g.startDate ? g.startDate.split('-').slice(1).reverse().join('/') : '';
    const lastDay = g.days[g.days.length-1];
    const endD = lastDay ? lastDay.date.split('-').slice(1).reverse().join('/') : '';
    const card = document.createElement('div');
    card.className = 'goal-archive-card';
    card.style.cssText = `border-color:${color}33`;
    card.innerHTML = `
      <div class="gac-emoji" style="background:${color}18">${g.emoji}</div>
      <div class="gac-body">
        <div class="gac-title">${esc(g.title)}</div>
        <div class="gac-meta">${startD} → ${endD} &nbsp;·&nbsp; ${g.totalDays} ngày</div>
        <div class="gac-bar-wrap">
          <div class="gac-bar-track">
            <div class="gac-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${color},${barColor})"></div>
          </div>
          <div class="gac-pct-badge" style="color:${barColor};background:${barColor}18;border:1px solid ${barColor}33">
            ${perfect ? '💯' : pct + '%'}
          </div>
        </div>
        <div class="gac-days-tag" style="color:${color};border-color:${color}33;background:${color}0a">
          ✓ ${done}/${g.totalDays} ngày
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function renderGoalArchiveStats(container){
  container.style.display='';
  try {
    const s = await apiGoals.archiveStats();
    const chips = [
      { icon:'🎯', val: s.totalGoals,         lbl:'Mục tiêu',          color:'#b07fff', bg:'rgba(176,127,255,.12)' },
      { icon:'📅', val: s.totalDaysCompleted,  lbl:'Ngày hoàn thành',   color:'#5ee8f0', bg:'rgba(94,232,240,.12)' },
      { icon:'📊', val: s.avgCompletion+'%',   lbl:'Tỷ lệ TB',          color:'#ffcf5c', bg:'rgba(255,207,92,.12)'  },
      { icon:'💯', val: s.perfectGoals,        lbl:'Hoàn hảo',          color:'#5ef0a0', bg:'rgba(94,240,160,.12)' },
      { icon:'🏅', val: s.longestGoal+' ngày', lbl:'Dài nhất',          color:'#ff85c8', bg:'rgba(255,133,200,.12)' },
    ];
    container.innerHTML = chips.map(c=>`
      <div class="ga-stat-chip">
        <div class="ga-stat-icon" style="background:${c.bg}">${c.icon}</div>
        <div class="ga-stat-text">
          <div class="ga-stat-val" style="color:${c.color}">${c.val}</div>
          <div class="ga-stat-lbl">${c.lbl}</div>
        </div>
      </div>
    `).join('');
  } catch(e){ container.innerHTML = '<div style="color:var(--text3);font-size:13px">Chưa có dữ liệu</div>'; }
}

async function loadGoalArchiveStats(){
  const body = document.getElementById('goal-archive-stats-body');
  if(!body) return;
  try {
    const s = await apiGoals.archiveStats();
    if(!s.totalGoals){
      body.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:4px 0">Chưa có mục tiêu nào được lưu vào kho.</div>';
      return;
    }
    const chips = [
      { icon:'🎯', val: s.totalGoals,         lbl:'Mục tiêu lưu kho',  color:'#b07fff', bg:'rgba(176,127,255,.12)' },
      { icon:'📅', val: s.totalDaysCompleted,  lbl:'Ngày hoàn thành',   color:'#5ee8f0', bg:'rgba(94,232,240,.12)'  },
      { icon:'📊', val: s.avgCompletion+'%',   lbl:'Tỷ lệ TB',          color:'#ffcf5c', bg:'rgba(255,207,92,.12)'  },
      { icon:'💯', val: s.perfectGoals,        lbl:'Hoàn hảo',          color:'#5ef0a0', bg:'rgba(94,240,160,.12)'  },
      { icon:'🏅', val: s.longestGoal+' ngày', lbl:'Mục tiêu dài nhất', color:'#ff85c8', bg:'rgba(255,133,200,.12)' },
    ];
    body.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;padding:14px 16px 18px';
    body.innerHTML = chips.map(c=>`
      <div class="ga-stat-chip">
        <div class="ga-stat-icon" style="background:${c.bg}">${c.icon}</div>
        <div class="ga-stat-text">
          <div class="ga-stat-val" style="color:${c.color}">${c.val}</div>
          <div class="ga-stat-lbl">${c.lbl}</div>
        </div>
      </div>
    `).join('');
  } catch(e){ body.innerHTML = '<div style="color:var(--text3);font-size:13px">Lỗi tải dữ liệu</div>'; }
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
      ${!g.completed && lastDay && lastDay.date <= todayStr ? `<button class="gc-archive-btn" title="Lưu vào kho">🏆</button>` : ''}
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

  // Archive button (only on 100% complete goals)
  card.querySelector('.gc-archive-btn')?.addEventListener('click', async()=>{
    if(!confirm(`Lưu mục tiêu "${g.title}" vào kho lưu trữ?`)) return;
    await apiGoals.archive(g._id);
    card.style.cssText += 'opacity:0;transform:translateY(-8px);transition:all .3s;';
    setTimeout(()=>card.remove(), 300);
    toast('🏆 Đã lưu vào kho lưu trữ!');
    launchConfetti('medium');
    loadGoalArchiveSection();
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
      if (res.leveledUp) setTimeout(() => showLevelUpAnimation(res.oldLevel, res.newLevel), 800);
    } else {
      const pts = res.pointsDeducted || 8;
      toast(`↩️ Đã bỏ tích — trừ ${pts}⭐`);
      updatePointsUI(Math.max(0, (_shopData.points||0) - pts));
    }
    refreshAll().catch(()=>{});        // sync stats + badge
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
        if (res.leveledUp) setTimeout(() => showLevelUpAnimation(res.oldLevel, res.newLevel), 800);
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
  loadGoalArchiveSection();
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
  buyGardenSeed: (id, qty=1) => API.p('/api/shop/buy-garden-seed', { seedId: id, qty }),
  buyGardenPot:  (id, qty=1) => API.p('/api/shop/buy-garden-pot',  { potId:  id, qty }),
  pets:        ()       => API.g('/api/shop/pets'),
  care:        (petId, action) => API.p('/api/shop/care', { petId, action }),
  setPetVisibility: (id, hidden) => API.pa(`/api/shop/pet/${id}/visibility`, { hidden }),
  buryPet:     (id)    => API.d(`/api/shop/pets/${id}`).then(r => r.json()),
  badgesCatalog: ()     => API.g('/api/shop/badges-catalog'),
  checkBadges: (stats)  => API.p('/api/shop/check-badges', { stats }),
  addPoints:   (amt)    => API.p('/api/shop/add-points', { amount: amt }),
};

let _shopInited = false;
let _shopData = { points:0, food:0, meat:0, fish:0, seed:0, treat:0, water:0, fertilizer:0, streakFreezes:0, badges:[], gardenSeeds:{}, gardenPots:{} };

// Update points display everywhere — animates the badge on change
function updatePointsUI(pts) {
  if (pts !== undefined) _shopData.points = pts;
  const hdr = document.getElementById('header-points-val');
  const shop = document.getElementById('shop-points-value');
  if (hdr) {
    if (hdr.textContent !== String(_shopData.points)) {
      hdr.textContent = _shopData.points;
      const badge = document.getElementById('header-points-badge');
      if (badge) {
        badge.classList.remove('pts-bump');
        void badge.offsetWidth; // reflow to restart animation
        badge.classList.add('pts-bump');
      }
    }
  }
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

  _setupShopTabs();
  await loadShopData();
  await loadStoreCatalog();
}

function _setupShopTabs() {
  document.querySelectorAll('.shop-tab[data-stab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shop-tab[data-stab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.stab;
      document.getElementById('shop-tab-pets').style.display    = tab === 'pets'    ? '' : 'none';
      document.getElementById('shop-tab-garden').style.display  = tab === 'garden'  ? '' : 'none';
      document.getElementById('shop-tab-items').style.display   = tab === 'items'   ? '' : 'none';
    });
  });
  // Garden seed filter buttons
  document.querySelectorAll('.sgf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sgf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _renderStoreSeedsGrid(btn.dataset.scat);
    });
  });
}

async function loadShopData() {
  try {
    const data = await apiShop.points();
    _shopData = { ...data, gardenSeeds: data.gardenSeeds || {}, gardenPots: data.gardenPots || {} };
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
  ngoc_bich:'🎍 Cây Ngọc Bích mang lại hòa hợp. Nhấn thấy ngọc quý rụng! Tưới nước & bón phân.',
  flower:  '🎋 Cây Phát Tài chiêu phú quý. Nhấn thấy may mắn tỏa sáng! Tưới nước & bón phân.',
  van_loc: '🌺 Cây Vạn Lộc mang thịnh vượng. Nhấn thấy hoa may mắn rơi! Tưới nước & bón phân.',
  tree2:   '🌵 Cây Sen Đá cho sức khỏe. Nhấn thấy trái tim & sức khỏe rụng! Tưới nước & bón phân.',
  flower2: '🌼 Hoa Mai mang may mắn cả năm. Nhấn thấy cánh mai vàng rơi! Tưới nước & bón phân.',
  flower3: '🌺 Hoa Lan thanh cao sang trọng. Nhấn thấy cánh lan & vương miện rơi! Tưới nước & bón phân.',
};

// ── PET NAMING MODAL ──
const PET_NAME_SUGGESTIONS = {
  rabbit:   ['Bông','Mochi','Caramel','Snowball','Latte','Pudding','Cinnamon','Peanut','Hazel','Daisy'],
  cat:      ['Miu','Luna','Sushi','Mochi','Cleo','Simba','Nala','Whiskers','Kitty','Shadow'],
  dog:      ['Buddy','Max','Coco','Bear','Charlie','Rocky','Milo','Biscuit','Toby','Zeus'],
  hamster:  ['Pip','Nugget','Cashew','Biscuit','Peanut','Dumpling','Noodle','Chip','Waffles','Pretzel'],
  bird:     ['Kiwi','Mango','Sora','Azure','Sunny','Lemon','Peach','Sky','Chirp','Zephyr'],
  tree:     ['Xanh Lá','Bách Tùng','Cổ Thụ','Trường Xanh','Thái Bình','Vĩnh Cửu','Đại Thụ','Trường Sinh','Minh Quang','Phúc Lộc'],
  flower:   ['Hồng Nhung','Tím Mộng','Vàng Hoa','Thanh Khiết','Diễm Lệ','Ngọc Lan','Bạch Liên','Phù Dung','Hương Nhi','Mỹ Linh'],
  tree2:    ['Lộc Vừng','Thần Mộc','Tiên Thụ','Thanh Tùng','Phúc Mộc','Ngọc Thụ','Vân Sam','Huyền Bí','Đại Cổ','Linh Mộc'],
  flower2:  ['Sen Trắng','Quỳnh Hương','Phong Lan','Mai Vàng','Hoa Cúc','Thủy Tiên','Violette','Jasmine','Iris','Dahlia'],
  flower3:  ['Bồng Lai','Thiên Lý','Ngọc Liên','Xuân Hoa','Thu Cúc','Đông Mai','Hạ Hồng','Bướm Bay','Nàng Thơ','Tiểu Mỹ'],
  kim_ngan: ['Kim Ngân','Phú Quý','Vàng Rực','Tiền Lộc','Hoàng Kim','Tài Lộc','Kim Bảo','Ngọc Phú','Vàng Son','Lộc Tài'],
  ngoc_bich:['Ngọc Bích','Lục Ngọc','Cẩm Thạch','Jade','Bích Ngọc','Thanh Ngọc','Lam Ngọc','Lá Xanh','Thúy Ngọc','Ngọc Lam'],
  van_loc:  ['Vạn Lộc','Phúc Đức','Trường Thọ','Cát Tường','An Khang','Bình An','Thịnh Vượng','Trường Lộc','Phúc Thọ','Như Ý'],
};

function openPetNameModal(p, onConfirm) {
  const modal   = document.getElementById('pet-name-modal');
  const preview = document.getElementById('pnm-preview');
  const variant = document.getElementById('pnm-variant');
  const input   = document.getElementById('pnm-input');
  const suggs   = document.getElementById('pnm-suggestions');
  const sub     = document.getElementById('pnm-sub');
  if (!modal) return;

  // Pick preview emoji from first stage of this type
  preview.textContent = p.stages?.[0] || p.emoji || '🐾';
  variant.textContent = p.name;
  sub.textContent = `Tên sẽ hiển thị trên vòng cổ`;
  input.value = '';

  // Suggestions
  const names = PET_NAME_SUGGESTIONS[p.type] || PET_NAME_SUGGESTIONS.rabbit;
  suggs.innerHTML = names.slice(0, 5).map(n =>
    `<button class="pnm-sugg-btn">${n}</button>`
  ).join('');
  suggs.querySelectorAll('.pnm-sugg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.textContent;
      input.focus();
      suggs.querySelectorAll('.pnm-sugg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 100);

  const close = () => { modal.style.display = 'none'; };
  const confirm = () => {
    const name = input.value.trim();
    close();
    onConfirm(name);
  };

  document.getElementById('pnm-cancel').onclick  = close;
  document.getElementById('pnm-confirm').onclick = confirm;
  modal.querySelector('.pet-name-backdrop').onclick = close;
  input.onkeydown = (e) => { if (e.key === 'Enter') confirm(); };
}

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
  card.querySelector('.store-price').addEventListener('click', () => {
    openPetNameModal(p, async (name) => {
      try {
        const res = await fetch('/api/shop/buy-pet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: p.type, name: name || undefined }),
          credentials: 'include'
        }).then(r => r.json());
        if (res.error) throw new Error(res.error);
        updatePointsUI(res.points);
        const vName = res.variantName || p.name;
        toast(`🎉 Bạn nhận được: ${vName}!${res.remaining != null ? ` (còn ${res.remaining} biến thể chưa mở)` : ''}`);
        launchConfetti('medium');
        await loadMyPets();
        await loadShopData();
        checkAndAwardBadges();
      } catch(e) { toast('❌ ' + (e.message || 'Không đủ điểm!')); }
    });
  });
  return card;
}

// ── STORE CATALOG ──
let _storeCatalog = null; // cache for garden seed/pot rendering

async function loadStoreCatalog() {
  try {
    const { pets, items, streakFreezePrice, gardenSeeds, gardenPots } = await apiShop.catalog();
    _storeCatalog = { gardenSeeds, gardenPots };

    // Animals
    const aGrid = document.getElementById('store-animals-grid');
    aGrid.innerHTML = '';
    pets.filter(p => p.category === 'animal').forEach(p => {
      aGrid.appendChild(makeStoreCard(p));
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

    // Garden seeds & pots
    _renderStoreSeedsGrid('all');
    _renderStorePotsGrid();

  } catch(e) { console.error('loadStoreCatalog:', e); }
}

// ── GARDEN SHOP SECTIONS ──
const GARDEN_CAT_INFO = {
  vegetable: { emoji:'🥬', label:'Rau', color:'#4caf50' },
  fruit:     { emoji:'🍎', label:'Quả', color:'#ff7043' },
  flower:    { emoji:'🌸', label:'Hoa', color:'#e91e8c' },
  fengshui:  { emoji:'🎍', label:'Phong thủy', color:'#b07fff' },
};

function _renderStoreSeedsGrid(cat = 'all') {
  const grid = document.getElementById('store-seeds-grid');
  if (!grid || !_storeCatalog) return;
  const seeds = cat === 'all'
    ? _storeCatalog.gardenSeeds
    : _storeCatalog.gardenSeeds.filter(s => s.category === cat);

  grid.innerHTML = '';
  seeds.forEach(s => {
    const ci = GARDEN_CAT_INFO[s.category] || {};
    const owned = _shopData.gardenSeeds[s.id] || 0;
    const harvestNote = s.harvestable
      ? `<div class="seed-harvest-note">🌾 Thu hoạch: +${s.harvestPoints}đ</div>`
      : `<div class="seed-harvest-note">🌀 Cây cảnh</div>`;
    const card = document.createElement('div');
    card.className = 'store-card';
    card.innerHTML = `
      <div class="store-emoji">${s.emoji}</div>
      <div class="store-name">${s.name}</div>
      <div class="store-cat-badge" style="background:${ci.color||'#b07fff'}22;color:${ci.color||'#b07fff'}">${ci.emoji||''} ${ci.label||''}</div>
      <div class="store-desc">${s.desc}</div>
      ${harvestNote}
      <div class="store-owned-badge" id="seed-owned-${s.id}">Bạn có: <b>${owned}</b></div>
      <button class="store-price" data-seedid="${s.id}">⭐ ${s.price} điểm</button>
    `;
    card.querySelector('.store-price').addEventListener('click', async () => {
      try {
        const res = await apiShop.buyGardenSeed(s.id, 1);
        _shopData.gardenSeeds = res.gardenSeeds;
        updatePointsUI(res.points);
        const badge = document.getElementById(`seed-owned-${s.id}`);
        if (badge) badge.innerHTML = `Bạn có: <b>${res.gardenSeeds[s.id] || 0}</b>`;
        toast(`🌱 Đã mua hạt giống ${s.name}!`);
        quickNotifCheck();
      } catch(e) { toast('❌ ' + (e.message || 'Không đủ điểm!')); }
    });
    grid.appendChild(card);
  });
}

function _renderStorePotsGrid() {
  const grid = document.getElementById('store-pots-grid');
  if (!grid || !_storeCatalog) return;
  grid.innerHTML = '';
  _storeCatalog.gardenPots.forEach(p => {
    const owned = _shopData.gardenPots[p.id] || 0;
    const card = document.createElement('div');
    card.className = 'store-card';
    card.innerHTML = `
      <div class="store-emoji">${p.emoji}</div>
      <div class="store-name">${p.name}</div>
      <div class="store-desc">${p.desc}</div>
      <div class="store-owned-badge" id="pot-owned-${p.id}">Bạn có: <b>${owned}</b></div>
      <button class="store-price" data-potid="${p.id}">⭐ ${p.price} điểm</button>
    `;
    card.querySelector('.store-price').addEventListener('click', async () => {
      try {
        const res = await apiShop.buyGardenPot(p.id, 1);
        _shopData.gardenPots = res.gardenPots;
        updatePointsUI(res.points);
        const badge = document.getElementById(`pot-owned-${p.id}`);
        if (badge) badge.innerHTML = `Bạn có: <b>${res.gardenPots[p.id] || 0}</b>`;
        toast(`🪴 Đã mua ${p.name}!`);
        quickNotifCheck();
      } catch(e) { toast('❌ ' + (e.message || 'Không đủ điểm!')); }
    });
    grid.appendChild(card);
  });
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

// ── BURIAL (chôn cất thú cưng/cây đã mất) ──
async function buryPetAction(petId, petName, petEmoji, cardEl) {
  // Show confirmation modal
  const existing = document.getElementById('bury-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'bury-modal';
  modal.className = 'bury-modal-backdrop';
  modal.innerHTML = `
    <div class="bury-modal-card">
      <div class="bury-modal-emoji" id="bury-modal-emoji">${petEmoji}</div>
      <div class="bury-modal-title">Chôn cất ${esc(petName)}</div>
      <div class="bury-modal-sub">
        Bạn muốn tiễn đưa <strong>${esc(petName)}</strong> về nơi an nghỉ cuối cùng?<br>
        <span style="font-size:11px;color:var(--text3)">Hành động này không thể hoàn tác.</span>
      </div>
      <div class="bury-modal-btns">
        <button class="bury-cancel-btn" id="bury-cancel">Để sau</button>
        <button class="bury-confirm-btn" id="bury-confirm">🪦 Chôn cất</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('bury-show'));

  document.getElementById('bury-cancel').addEventListener('click', () => {
    modal.classList.remove('bury-show');
    setTimeout(() => modal.remove(), 300);
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('bury-show');
      setTimeout(() => modal.remove(), 300);
    }
  });

  document.getElementById('bury-confirm').addEventListener('click', async () => {
    const confirmBtn = document.getElementById('bury-confirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳';

    // Animate the emoji ascending
    const emojiEl = document.getElementById('bury-modal-emoji');
    if (emojiEl) emojiEl.classList.add('bury-ascend');

    setTimeout(async () => {
      try {
        await apiShop.buryPet(petId);

        // Update modal to tombstone
        modal.querySelector('.bury-modal-card').innerHTML = `
          <div class="bury-tombstone-anim">🪦</div>
          <div class="bury-modal-title" style="color:var(--text2)">Nghỉ bình yên, ${esc(petName)}</div>
          <div class="bury-modal-sub" style="font-size:12px">
            Cảm ơn những kỷ niệm đẹp 🌸<br>
            <span style="font-size:11px;color:var(--text3)">Bạn có thể mua thú cưng mới tại Cửa hàng.</span>
          </div>`;

        // Also remove from dead-pets localStorage
        const seen = JSON.parse(localStorage.getItem('rh-seen-dead-pets') || '[]');
        const idx = seen.indexOf(petId);
        if (idx > -1) { seen.splice(idx, 1); localStorage.setItem('rh-seen-dead-pets', JSON.stringify(seen)); }

        // Animate card out
        if (cardEl) {
          cardEl.style.transition = 'all .5s ease';
          cardEl.style.opacity = '0';
          cardEl.style.transform = 'scale(.85)';
          setTimeout(() => cardEl.remove(), 500);
        }

        // Close modal after showing tombstone
        setTimeout(() => {
          modal.classList.remove('bury-show');
          setTimeout(() => modal.remove(), 300);
        }, 2200);

        // Refresh
        loadMyPets();
        quickNotifCheck();
        toast(`🪦 ${petName} đã được an táng.`);
      } catch(e) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '🪦 Chôn cất';
        toast('❌ ' + (e.message || 'Lỗi khi chôn cất'));
      }
    }, 800);
  });
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

    // Chỉ hiển thị động vật — cây cối chỉ xuất hiện trong Vườn
    const animalPets = pets.filter(p => isAnimal(p.type));
    if (!animalPets.length) { if (empty) empty.style.display = ''; return; }

    animalPets.forEach(pet => {
      const isHidden = pet.hidden;
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

      const tintStyle = (pet.colorTint != null && pet.colorTint !== 0) ? `filter:hue-rotate(${pet.colorTint}deg) saturate(1.2) brightness(1.1)` : '';
      card.innerHTML = `
        <button class="pet-visibility-btn" title="${isHidden ? 'Hiện' : 'Ẩn'} pet này">${isHidden ? '👁️‍🗨️' : '👁️'}</button>
        ${pet.warning ? '<div class="pet-warning-badge">⚠️ Cần chăm sóc!</div>' : ''}
        <div class="pet-emoji" style="${tintStyle}">${pet.emoji}</div>
        <div class="pet-name">${esc(pet.name)}</div>
        <div class="pet-type-label">${pet.variantName || TYPE_LABELS[pet.type] || pet.type} · Lv.${pet.level}</div>
        <div class="pet-health-status"><span class="pet-health-dot ${healthStatus}"></span> ${healthLabel}</div>
        <div class="pet-level-bar"><div class="pet-level-fill" style="width:${pet.level >= 10 ? 100 : pctLevel}%"></div></div>
        <div class="pet-level-text">${pet.totalPoints} pts${pet.level >= 10 ? ' · MAX' : ` · ${50 - ptsInLevel} pts đến Lv.${pet.level + 1}`}</div>
        ${!pet.alive ? `<div class="pet-dead-overlay">
          <div style="font-size:36px">😢</div>
          <div class="pet-dead-text">Đã mất do không được chăm sóc</div>
          <button class="pet-bury-btn" data-pet-id="${pet._id}" data-pet-name="${esc(pet.name)}" data-pet-emoji="${pet.emoji}" title="Chôn cất ${esc(pet.name)}">🪦 Chôn cất</button>
        </div>` : ''}
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

      // Visibility toggle — persists to server
      card.querySelector('.pet-visibility-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const newHidden = !pet.hidden;
        try {
          const res = await apiShop.setPetVisibility(pet._id, newHidden);
          if (!res.ok) throw new Error(res.error || 'Server error');
          pet.hidden = newHidden;
          // Also update localStorage for immediate floating pets sync
          const currentHidden = JSON.parse(localStorage.getItem('hiddenPetIds') || '[]');
          if (newHidden && !currentHidden.includes(pet._id)) currentHidden.push(pet._id);
          else if (!newHidden) {
            const idx = currentHidden.indexOf(pet._id);
            if (idx > -1) currentHidden.splice(idx, 1);
          }
          localStorage.setItem('hiddenPetIds', JSON.stringify(currentHidden));
          loadMyPets();
          refreshFloatingPets();
        } catch(err) { toast('❌ Lỗi: ' + (err.message || 'Không thể thay đổi!')); }
      });


      // Bury button — only on dead pets
      const buryBtn = card.querySelector('.pet-bury-btn');
      if (buryBtn) {
        buryBtn.addEventListener('click', e => {
          e.stopPropagation();
          buryPetAction(buryBtn.dataset.petId, buryBtn.dataset.petName, buryBtn.dataset.petEmoji, card);
        });
      }

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
    updateHeaderLevel(data.level || 1);
  } catch(e) {}
}

function updateHeaderLevel(lvl) {
  const LEVEL_EMOJIS = ['🌱','🌿','🍀','🌸','⚔️','🛡️','🦸','🏆','👑','💎','🌟','⚡','🐉','🔮','🌌','🏛️','🦅','💫','🌈','🐰'];
  const el = document.getElementById('header-level-val');
  const emojiEl = document.getElementById('header-level-emoji');
  if (el) el.textContent = 'Lv' + lvl;
  if (emojiEl) emojiEl.textContent = LEVEL_EMOJIS[Math.min(lvl - 1, LEVEL_EMOJIS.length - 1)] || '🌱';
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
      const dir = getComputedStyle(petEl).getPropertyValue('--dir').trim() || '1';
      bubble.style.setProperty('--counter-dir', dir);
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

function _savePetPos(id, x, y) {
  // Store as ratio so position scales with viewport
  const rx = x / window.innerWidth;
  const ry = y / window.innerHeight;
  _floatingPetPositions[id] = { x, y };
  try {
    const all = JSON.parse(localStorage.getItem('rh-pet-pos') || '{}');
    all[id] = { rx, ry };
    localStorage.setItem('rh-pet-pos', JSON.stringify(all));
  } catch(e) {}
}

function _loadPetPos(id) {
  if (_floatingPetPositions[id]) return _floatingPetPositions[id];
  try {
    const all = JSON.parse(localStorage.getItem('rh-pet-pos') || '{}');
    if (all[id]) {
      // Convert ratio back to pixels for current viewport
      const x = all[id].rx * window.innerWidth;
      const y = all[id].ry * window.innerHeight;
      // Clamp so pet stays visible
      const cx = Math.max(8, Math.min(window.innerWidth - 80, x));
      const cy = Math.max(8, Math.min(window.innerHeight - 80, y));
      _floatingPetPositions[id] = { x: cx, y: cy };
      return { x: cx, y: cy };
    }
  } catch(e) {}
  return null;
}

// Track cursor position to avoid covering it
let _cursorX = -9999, _cursorY = -9999;
document.addEventListener('mousemove', e => { _cursorX = e.clientX; _cursorY = e.clientY; });

// Pick a position along screen edges/corners, far from cursor
function _pickEdgePos() {
  const W = window.innerWidth, H = window.innerHeight;
  const S = 60; // pet size approx
  const m = 16; // margin from edge
  // Define candidate zones along edges
  const candidates = [
    // Corners
    { x: m,           y: H - S - m },
    { x: W - S - m,   y: H - S - m },
    { x: m,           y: H * 0.35 },
    { x: W - S - m,   y: H * 0.35 },
    // Bottom edge (spread)
    { x: W * 0.25,    y: H - S - m },
    { x: W * 0.5,     y: H - S - m },
    { x: W * 0.75 - S,y: H - S - m },
    // Left edge
    { x: m,           y: H * 0.55 },
    { x: m,           y: H * 0.7  },
    // Right edge
    { x: W - S - m,   y: H * 0.55 },
    { x: W - S - m,   y: H * 0.7  },
  ];
  // Add jitter
  const jittered = candidates.map(c => ({
    x: c.x + (Math.random() - 0.5) * 40,
    y: c.y + (Math.random() - 0.5) * 20,
  }));
  // Filter positions far enough from cursor (>180px)
  const safe = jittered.filter(c => {
    const dx = c.x + S/2 - _cursorX, dy = c.y + S/2 - _cursorY;
    return Math.sqrt(dx*dx + dy*dy) > 180;
  });
  const pool = safe.length ? safe : jittered;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function loadFloatingPets() {
  const container = document.getElementById('floating-pets-container');
  if (!container) return;
  container.innerHTML = '';

  try {
    const pets = await apiShop.pets();
    // Use server-side hidden flag, sync to localStorage for offline reference
    const hiddenIds = pets.filter(p => p.hidden).map(p => p._id);
    localStorage.setItem('hiddenPetIds', JSON.stringify(hiddenIds));
    const isAnimal = t => ['rabbit','cat','dog','hamster','bird'].includes(t);
    const visiblePets = pets.filter(p => p.alive && !p.hidden && isAnimal(p.type));

    if (!visiblePets.length) return;

    visiblePets.forEach((pet, i) => {
      const el = document.createElement('div');
      const category = isAnimal(pet.type) ? 'animal' : 'plant';
      el.className = 'floating-pet';
      el.setAttribute('data-category', category);
      el.setAttribute('data-pet-type', pet.type);
      el.setAttribute('data-pet-id', pet._id);
      // Use inner structure: emoji + name collar
      el.innerHTML = `
        <span class="fp-emoji">${pet.emoji}</span>
        <span class="fp-collar">${esc(pet.name)}</span>
      `;
      // Apply CSS hue tint for plant variants
      if (pet.colorTint != null && pet.colorTint !== 0) {
        el.querySelector('.fp-emoji').style.filter = `hue-rotate(${pet.colorTint}deg) saturate(1.2) brightness(1.1)`;
      }

      // Restore saved position (localStorage) or default to bottom-right corner
      const savedPos = _loadPetPos(pet._id);
      if (savedPos) {
        el.style.left = savedPos.x + 'px';
        el.style.top  = savedPos.y + 'px';
      } else {
        // Default: stagger along bottom-right
        const W = window.innerWidth, H = window.innerHeight;
        const x = W - 90 - (i % 4) * 70;
        const y = H - 120 - Math.floor(i / 4) * 80;
        el.style.left = x + 'px';
        el.style.top  = y + 'px';
      }

      // Stagger animations
      el.style.animationDelay = (i * 0.3) + 's';

      // Animals walk randomly, plants stay put (user can drag plants)
      if (category === 'animal') {
        // Initial delay so pets don't all move at the same time
        const initialDelay = 3000 + i * 2000 + Math.random() * 4000;
        let walkTimer;
        const scheduleWalk = () => {
          walkTimer = setTimeout(() => {
            if (!el._isDragging) {
              const pos = _pickEdgePos();
              const curX = parseFloat(el.style.left) || el.offsetLeft;
              el.style.setProperty('--dir', pos.x < curX ? '-1' : '1');
              el.classList.add('walking');
              el.style.left = pos.x + 'px';
              el.style.top  = pos.y + 'px';
              setTimeout(() => el.classList.remove('walking'), 3200);
            }
            scheduleWalk(); // next walk in 18–35 seconds
          }, 18000 + Math.random() * 17000);
        };
        setTimeout(scheduleWalk, initialDelay);
        el._stopWalk = () => clearTimeout(walkTimer);
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
        // Save position to memory + localStorage
        _savePetPos(pet._id, el.offsetLeft, el.offsetTop);

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
              // Counter-flip text so it's always readable regardless of pet direction
              const dir = getComputedStyle(el).getPropertyValue('--dir').trim() || '1';
              bubble.style.setProperty('--counter-dir', dir);
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

    // Dead pet alerts are handled silently in the notification panel only
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

// ═══════════════════════════════════════════
// GAMIFICATION PAGE
// ═══════════════════════════════════════════

const apiGamification = {
  level:          () => API.g('/api/gamification/level'),
  weekly:         () => API.g('/api/gamification/weekly'),
  claimWeekly:    (id) => API.p('/api/gamification/weekly/claim', { challengeId: id }),
  friendCode:     () => API.g('/api/gamification/friend-code'),
  sendRequest:    (code) => API.p('/api/gamification/friend-request', { friendCode: code }),
  friendRequests: () => API.g('/api/gamification/friend-requests'),
  acceptFriend:   (id) => API.p('/api/gamification/friend-accept', { userId: id }),
  rejectFriend:   (id) => API.p('/api/gamification/friend-reject', { userId: id }),
  removeFriend:   (id) => API.p('/api/gamification/friend-remove', { userId: id }),
  leaderboard:    () => API.g('/api/gamification/leaderboard'),
  friendsList:    () => API.g('/api/gamification/friends-list'),
  sendFire:       (id) => API.p('/api/gamification/send-fire', { toUserId: id }),
  getFires:       () => API.g('/api/gamification/fires'),
  markFiresSeen:  () => API.p('/api/gamification/fires/seen', {}),
  giftItem:       (toUserId, itemId, qty) => API.p('/api/gamification/gift-item', { toUserId, itemId, qty }),
  getGifts:       () => API.g('/api/gamification/gifts'),
  markGiftsSeen:  () => API.p('/api/gamification/gifts/seen', {}),
  notifications:  () => API.g('/api/gamification/notifications'),
  achievementStats: () => API.g('/api/gamification/achievement-stats'),
  conversations:    () => API.g('/api/gamification/conversations'),
  messages:         (fid, before) => API.g(`/api/gamification/messages/${fid}${before ? '?before=' + encodeURIComponent(before) : ''}`),
  sendMessage:      (toId, content) => API.p('/api/gamification/messages', { toUserId: toId, content }),
  unreadMessages:   () => API.g('/api/gamification/unread-messages'),
  fireStreak:       (fid) => API.g(`/api/gamification/fire-streak/${fid}`),
  gardenVisits:         ()  => API.g('/api/gamification/garden-visits'),
  gardenVisitsSeen:     ()  => API.p('/api/gamification/garden-visits/seen', {}),
  systemNotifications:  ()  => API.g('/api/gamification/system-notifications'),
  markSystemNotifSeen:  ()  => API.p('/api/gamification/system-notifications/seen', {}),
};

// ═══════════════════════════════════════════
// STATS API + FUNCTIONS
// ═══════════════════════════════════════════

const apiStats = {
  journey: ()      => API.g('/api/stats/journey'),
  monthly: ()      => API.g('/api/stats/monthly'),
  balance: (month) => API.g('/api/stats/balance' + (month ? `?month=${month}` : '')),
};

async function loadJourneyStats() {
  const body = document.getElementById('journey-stats-body');
  if (!body) return;
  try {
    const s = await apiStats.journey();
    const chips = [
      { icon:'📅', val: s.daysSince,          lbl:'Ngày đồng hành',         color:'#b07fff', bg:'rgba(176,127,255,.12)' },
      { icon:'✅', val: s.totalTasksDone,      lbl:'Tasks hoàn thành',        color:'#5ef0a0', bg:'rgba(94,240,160,.12)' },
      { icon:'🔥', val: s.totalHabitDays,      lbl:'Ngày duy trì thói quen',  color:'#ffcf5c', bg:'rgba(255,207,92,.12)' },
      { icon:'🎯', val: s.totalGoalsArchived,  lbl:'Mục tiêu đã đạt',         color:'#5ee8f0', bg:'rgba(94,232,240,.12)' },
      { icon:'⭐', val: s.totalEarned,          lbl:'Tổng điểm kiếm được',     color:'#ff85c8', bg:'rgba(255,133,200,.12)' },
    ];
    body.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
    body.innerHTML = chips.map(c => `
      <div class="ga-stat-chip">
        <div class="ga-stat-icon" style="background:${c.bg}">${c.icon}</div>
        <div class="ga-stat-text">
          <div class="ga-stat-val" style="color:${c.color}">${c.val.toLocaleString()}</div>
          <div class="ga-stat-lbl">${c.lbl}</div>
        </div>
      </div>
    `).join('');
  } catch(e) { console.error('loadJourneyStats:', e); }
}

async function loadMonthlyProgress() {
  const canvas = document.getElementById('chart-monthly-progress');
  if (!canvas) return;
  try {
    const data = await apiStats.monthly();
    const VI_MO = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
    const labels = data.map(d => { const [,m] = d.month.split('-'); return VI_MO[parseInt(m)-1]; });
    const scores = data.map(d => d.score);
    if (window._chartMonthly) window._chartMonthly.destroy();
    window._chartMonthly = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Điểm hoạt động',
          data: scores,
          borderColor: '#b07fff',
          backgroundColor: 'rgba(176,127,255,.12)',
          borderWidth: 2,
          pointBackgroundColor: '#b07fff',
          pointRadius: 4,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => ` ${ctx.raw} điểm` }
        }},
        scales: {
          x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8b8fa8' } },
          y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8b8fa8' }, beginAtZero: true }
        }
      }
    });
  } catch(e) { console.error('loadMonthlyProgress:', e); }
}

const CAT_CONFIG = {
  work:     { label: '💼 Công việc', color: '#5ee8f0' },
  health:   { label: '🩺 Sức khỏe', color: '#5ef0a0' },
  sport:    { label: '🏃 Thể thao',  color: '#ff9f5c' },
  shopping: { label: '🛒 Mua sắm',   color: '#f7c97e' },
  learning: { label: '📚 Học tập',   color: '#ffcf5c' },
  personal: { label: '🏠 Cá nhân',   color: '#ff85c8' },
  other:    { label: '🎯 Khác',      color: '#b07fff' },
};

// Balance month navigation state
let _balanceMonth = null; // null = current month
function _balanceMonthKey(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function _balanceMonthLabel(key) {
  const [y, m] = key.split('-');
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (key === curKey) return 'Tháng này';
  const names = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                     'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  return `${names[parseInt(m)]} ${y}`;
}

async function loadLifeBalance(month) {
  const canvas = document.getElementById('chart-life-balance');
  const legend = document.getElementById('life-balance-legend');
  const monthLabel = document.getElementById('bal-month-label');
  const nextBtn = document.getElementById('bal-next-btn');
  if (!canvas) return;

  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (!month) month = curKey;
  _balanceMonth = month;

  if (monthLabel) monthLabel.textContent = _balanceMonthLabel(month);
  if (nextBtn) nextBtn.disabled = (month >= curKey);

  // Wire nav buttons (idempotent via replacing)
  const prevBtn = document.getElementById('bal-prev-btn');
  if (prevBtn && !prevBtn._wired) {
    prevBtn._wired = true;
    prevBtn.addEventListener('click', () => {
      const [y, m] = _balanceMonth.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      const prev = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      // Limit to 12 months back
      const minKey = _balanceMonthKey(-11);
      if (prev >= minKey) loadLifeBalance(prev);
    });
  }
  if (nextBtn && !nextBtn._wired) {
    nextBtn._wired = true;
    nextBtn.addEventListener('click', () => {
      const [y, m] = _balanceMonth.split('-').map(Number);
      const d = new Date(y, m, 1);
      const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (next <= curKey) loadLifeBalance(next);
    });
  }

  try {
    const res  = await apiStats.balance(month);
    const data = res.counts || res; // backwards compat
    const keys   = ['work','health','sport','shopping','learning','personal','other'];
    const values = keys.map(k => data[k] || 0);
    const total  = values.reduce((a,b)=>a+b, 0);

    if (window._chartBalance) window._chartBalance.destroy();

    if (total === 0) {
      if (legend) legend.innerHTML = `<div style="color:var(--text3);font-size:12px;text-align:center">Chưa có dữ liệu tháng này</div>`;
      // Draw empty chart
      window._chartBalance = new Chart(canvas, {
        type:'radar', data:{ labels: keys.map(k=>CAT_CONFIG[k].label),
          datasets:[{data:keys.map(()=>0), backgroundColor:'rgba(176,127,255,.08)',
            borderColor:'rgba(176,127,255,.2)', borderWidth:1, pointRadius:3}]},
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{legend:{display:false}},
          scales:{r:{grid:{color:'rgba(255,255,255,.06)'},
            angleLines:{color:'rgba(255,255,255,.06)'},ticks:{display:false},
            pointLabels:{color:'#5a5d6e',font:{size:11}}}}}
      });
      return;
    }

    window._chartBalance = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: keys.map(k => CAT_CONFIG[k].label),
        datasets: [{
          data: values,
          backgroundColor: 'rgba(176,127,255,.15)',
          borderColor: '#b07fff',
          borderWidth: 2,
          pointBackgroundColor: keys.map(k => CAT_CONFIG[k].color),
          pointRadius: 5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            grid: { color: 'rgba(255,255,255,.08)' },
            angleLines: { color: 'rgba(255,255,255,.08)' },
            ticks: { display: false },
            pointLabels: { color: '#8b8fa8', font: { size: 11 } },
          }
        }
      }
    });
    if (legend) {
      legend.innerHTML = keys.map((k,i) => `
        <div style="display:flex;align-items:center;gap:8px;font-size:12px">
          <div style="width:9px;height:9px;border-radius:50%;background:${CAT_CONFIG[k].color};flex-shrink:0"></div>
          <span style="color:var(--text2)">${CAT_CONFIG[k].label}</span>
          <span style="color:var(--text);font-weight:600;margin-left:auto">${values[i]}</span>
        </div>
      `).join('');
    }
  } catch(e) { console.error('loadLifeBalance:', e); }
}

async function loadUpcomingMilestones() {
  const body = document.getElementById('milestones-body');
  if (!body) return;
  try {
    const [levelData, journey] = await Promise.all([apiGamification.level(), apiStats.journey()]);
    const thresholds = levelData.thresholds || [];
    const lvl = levelData.level || 1;
    const totalEarned = levelData.totalEarned || 0;
    const milestones = [];

    // Next level
    if (lvl < thresholds.length) {
      const nextThresh = thresholds[lvl] || thresholds[thresholds.length-1];
      const prevThresh = thresholds[lvl-1] || 0;
      milestones.push({
        icon: levelData.emojis?.[lvl] || '⭐',
        label: `Level ${lvl+1} — ${levelData.names?.[lvl] || ''}`,
        current: totalEarned - prevThresh,
        target: nextThresh - prevThresh,
        color: '#b07fff',
      });
    }

    // Tasks milestone
    const taskMilestones = [10,50,100,250,500,1000];
    const nextTaskM = taskMilestones.find(m => m > (journey.totalTasksDone||0));
    if (nextTaskM) {
      const prev = taskMilestones[taskMilestones.indexOf(nextTaskM)-1] || 0;
      milestones.push({
        icon:'✅', label:`Hoàn thành ${nextTaskM} tasks`,
        current: journey.totalTasksDone - prev, target: nextTaskM - prev,
        color:'#5ef0a0',
      });
    }

    // Goals milestone
    const goalMilestones = [1,3,5,10,20];
    const nextGoalM = goalMilestones.find(m => m > (journey.totalGoalsArchived||0));
    if (nextGoalM) {
      const prev = goalMilestones[goalMilestones.indexOf(nextGoalM)-1] || 0;
      milestones.push({
        icon:'🎯', label:`Lưu kho ${nextGoalM} mục tiêu`,
        current: journey.totalGoalsArchived - prev, target: nextGoalM - prev,
        color:'#5ee8f0',
      });
    }

    // Habit days milestone
    const habitMilestones = [10,30,100,365,1000];
    const nextHabitM = habitMilestones.find(m => m > (journey.totalHabitDays||0));
    if (nextHabitM) {
      const prev = habitMilestones[habitMilestones.indexOf(nextHabitM)-1] || 0;
      milestones.push({
        icon:'🔥', label:`${nextHabitM} ngày duy trì thói quen`,
        current: journey.totalHabitDays - prev, target: nextHabitM - prev,
        color:'#ffcf5c',
      });
    }

    const top = milestones.slice(0, 4);
    body.innerHTML = top.map(m => {
      const pct = Math.min(100, Math.round((Math.max(0,m.current) / m.target) * 100));
      return `
        <div class="milestone-item">
          <div class="milestone-top">
            <span class="milestone-icon">${m.icon}</span>
            <span class="milestone-label">${m.label}</span>
            <span class="milestone-pct" style="color:${m.color}">${pct}%</span>
          </div>
          <div class="milestone-track">
            <div class="milestone-fill" style="width:${pct}%;background:${m.color}"></div>
          </div>
          <div class="milestone-sub">${Math.max(0,m.current)}/${m.target}${m.target - m.current > 0 ? ` — còn ${m.target - m.current} nữa` : ' 🎉 Đã đạt!'}</div>
        </div>
      `;
    }).join('');
  } catch(e) { console.error('loadUpcomingMilestones:', e); }
}

let _gfInited = false;

async function initGamification() {
  if (_gfInited) { refreshGamification(); return; }
  _gfInited = true;

  // Friend add button
  document.getElementById('gf-friend-add-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('gf-friend-input');
    const btn = document.getElementById('gf-friend-add-btn');
    const code = input.value.trim().toUpperCase();
    if (!code) { toast('⚠ Nhập mã bạn bè!'); return; }
    btn.disabled = true; btn.textContent = '...';
    try {
      const res = await apiGamification.sendRequest(code);
      if (res.error) {
        toast('❌ ' + res.error);
      } else if (res.accepted) {
        toast('🎉 Đã kết bạn thành công!');
        launchConfetti('medium');
        loadLeaderboard(); loadFriendsList();
        input.value = '';
        loadFriendRequests();
      } else {
        toast('✅ Đã gửi lời mời kết bạn!');
        input.value = '';
        loadFriendRequests();
      }
    } catch(e) { toast('❌ ' + (e.error || e.message || 'Lỗi!')); }
    finally { btn.disabled = false; btn.textContent = 'Kết bạn'; }
  });

  // Copy friend code
  document.getElementById('gf-fc-copy')?.addEventListener('click', () => {
    const code = document.getElementById('gf-fc-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      toast('📋 Đã sao chép mã!');
      const btn = document.getElementById('gf-fc-copy');
      btn.textContent = '✅ Đã sao chép';
      setTimeout(() => btn.textContent = '📋 Sao chép', 2000);
    }).catch(() => {});
  });

  // Share friend code
  document.getElementById('gf-fc-share')?.addEventListener('click', () => {
    const code = document.getElementById('gf-fc-code').textContent;
    const text = `🐰 Kết bạn với tôi trên Rabbit Habits!\nMã bạn bè: ${code}\nCùng nhau xây dựng thói quen tốt nhé! 🔥`;
    if (navigator.share) {
      navigator.share({ title: 'Rabbit Habits', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => toast('📤 Đã sao chép link chia sẻ!')).catch(() => {});
    }
  });

  initChat();
  refreshGamification();
  // Check fires on init
  setTimeout(checkFireNotifications, 1500);
}

async function refreshGamification() {
  loadLevelCard();
  loadWeeklyChallenges();
  loadLeaderboard();
  loadFriendCode();
  loadFriendRequests();
  loadFriendsList();
  loadConversations();
  loadAchievements();
}

// ── LEVEL CARD ──
async function loadLevelCard() {
  try {
    const data = await apiGamification.level();
    const lvl = data.level || 1;
    document.getElementById('gf-level-emoji').textContent = data.emoji || '🌱';
    document.getElementById('gf-level-num').textContent = lvl;
    document.getElementById('gf-level-name').textContent = data.name || 'Tân binh';
    document.getElementById('gf-level-points').textContent = (data.totalEarned || 0) + ' điểm';

    const cur = data.currentThreshold || 0;
    const next = data.nextThreshold;
    const bar = document.getElementById('gf-level-bar');
    const progText = document.getElementById('gf-level-progress-text');

    if (next) {
      const pct = Math.min(100, ((data.totalEarned - cur) / (next - cur)) * 100);
      bar.style.width = pct + '%';
      progText.textContent = `${data.totalEarned} / ${next} điểm đến Level ${lvl + 1}`;
    } else {
      bar.style.width = '100%';
      progText.textContent = 'MAX LEVEL! 🐰';
    }

    // Roadmap
    renderLevelRoadmap(data);
  } catch(e) { console.error('loadLevelCard:', e); }
}

function renderLevelRoadmap(data) {
  const wrap = document.getElementById('gf-level-roadmap');
  if (!wrap) return;
  const thresholds = data.thresholds || [];
  const names = data.names || [];
  const emojis = data.emojis || [];
  const currentLevel = data.level || 1;

  wrap.innerHTML = '';
  const maxShow = Math.min(thresholds.length, 20);
  for (let i = 0; i < maxShow; i++) {
    const lvl = i + 1;
    const reached = currentLevel >= lvl;
    const isCurrent = currentLevel === lvl;
    const node = document.createElement('div');
    node.className = 'gf-rm-node' + (reached ? ' reached' : '') + (isCurrent ? ' current' : '');
    node.innerHTML = `
      <div class="gf-rm-emoji">${emojis[i] || '?'}</div>
      <div class="gf-rm-lvl">Lv${lvl}</div>
      <div class="gf-rm-name">${names[i] || ''}</div>
      <div class="gf-rm-pts">${thresholds[i]} pts</div>
    `;
    wrap.appendChild(node);
  }
}

// ── WEEKLY CHALLENGES ──
async function loadWeeklyChallenges() {
  try {
    const data = await apiGamification.weekly();
    const wrap = document.getElementById('gf-challenges');
    const weekLabel = document.getElementById('gf-week-label');
    if (!wrap) return;

    // Week label
    if (weekLabel && data.weekStart) {
      const ws = new Date(data.weekStart);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      weekLabel.textContent = `${ws.getDate()}/${ws.getMonth()+1} – ${we.getDate()}/${we.getMonth()+1}`;
    }

    wrap.innerHTML = '';
    (data.challenges || []).forEach(c => {
      const pct = Math.min(100, (c.progress / c.target) * 100);
      const done = c.completed;
      const claimed = !!c.claimedAt;

      const card = document.createElement('div');
      card.className = 'gf-challenge-card' + (done ? ' done' : '') + (claimed ? ' claimed' : '');
      card.innerHTML = `
        <div class="gf-ch-top">
          <div class="gf-ch-emoji">${c.emoji}</div>
          <div class="gf-ch-info">
            <div class="gf-ch-title">${c.title}</div>
            <div class="gf-ch-progress-text">${c.progress}/${c.target}</div>
          </div>
          <div class="gf-ch-reward">
            ${claimed ? '<span class="gf-ch-claimed-tag">✅ Đã nhận</span>' :
              done ? `<button class="gf-ch-claim-btn" data-id="${c.id}">🎁 Nhận ${c.reward} pts</button>` :
              `<span class="gf-ch-reward-label">🎁 ${c.reward} pts</span>`}
          </div>
        </div>
        <div class="gf-ch-bar-wrap">
          <div class="gf-ch-bar" style="width:${pct}%;background:${done ? 'var(--accent)' : 'var(--primary)'}"></div>
        </div>
      `;

      // Claim button
      const claimBtn = card.querySelector('.gf-ch-claim-btn');
      if (claimBtn) {
        claimBtn.addEventListener('click', async () => {
          try {
            const res = await apiGamification.claimWeekly(c.id);
            toast(`🎉 +${res.reward} điểm!`);
            launchConfetti('medium');
            updatePointsUI(res.points);
            if (res.leveledUp) {
              showLevelUpAnimation(res.oldLevel, res.newLevel);
            }
            loadWeeklyChallenges();
            loadLevelCard();
          } catch(e) { toast('❌ ' + (e.error || e.message || 'Lỗi!')); }
        });
      }
      wrap.appendChild(card);
    });
  } catch(e) { console.error('loadWeeklyChallenges:', e); }
}

// ── LEVEL UP ANIMATION ──
function showLevelUpAnimation(oldLvl, newLvl) {
  updateHeaderLevel(newLvl);
  const overlay = document.createElement('div');
  overlay.className = 'gf-levelup-overlay';
  overlay.innerHTML = `
    <div class="gf-levelup-card">
      <div class="gf-levelup-emoji">🎉</div>
      <div class="gf-levelup-title">LEVEL UP!</div>
      <div class="gf-levelup-levels">
        <span class="gf-levelup-old">Lv${oldLvl}</span>
        <span class="gf-levelup-arrow">→</span>
        <span class="gf-levelup-new">Lv${newLvl}</span>
      </div>
      <div class="gf-levelup-sub">Tiếp tục phấn đấu nhé! 🐰</div>
      <button class="gf-levelup-close">Tuyệt vời!</button>
    </div>
  `;
  document.body.appendChild(overlay);
  launchConfetti('high');
  setTimeout(() => overlay.classList.add('show'), 10);
  const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 300); };
  overlay.querySelector('.gf-levelup-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  setTimeout(close, 5000);
}

// ── LEADERBOARD ──
async function loadLeaderboard() {
  try {
    const board = await apiGamification.leaderboard();
    const wrap = document.getElementById('gf-leaderboard');
    if (!wrap) return;

    if (board.length === 0) {
      wrap.innerHTML = '<div class="gf-empty">Kết bạn để xem bảng xếp hạng!</div>';
      return;
    }

    const rankEmojis = ['🥇','🥈','🥉'];
    wrap.innerHTML = board.map(b => `
      <div class="gf-lb-row${b.isMe ? ' me' : ''}">
        <div class="gf-lb-rank">${rankEmojis[b.rank-1] || '#'+b.rank}</div>
        <div class="gf-lb-info">
          <div class="gf-lb-name">${esc(b.displayName)}${b.isMe ? ' <span class="gf-lb-me-tag">(bạn)</span>' : ''}</div>
          <div class="gf-lb-sub">Lv${b.level} · ${b.totalEarned} pts · ${b.badges} 🏅</div>
        </div>
        <div class="gf-lb-pts">${b.totalEarned}<span class="gf-lb-pts-label"> pts</span></div>
      </div>
    `).join('');
  } catch(e) { console.error('loadLeaderboard:', e); }
}

// ── FRIEND CODE ──
async function loadFriendCode() {
  try {
    const { friendCode } = await apiGamification.friendCode();
    document.getElementById('gf-fc-code').textContent = friendCode;
  } catch(e) {}
}

// ── FRIEND REQUESTS ──
async function loadFriendRequests() {
  try {
    const reqs = await apiGamification.friendRequests();
    const wrap = document.getElementById('gf-friend-requests');
    if (!wrap) return;
    // Update badge
    updateFriendNotifBadge(reqs.length);
    if (!reqs || reqs.length === 0) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = `
      <div class="gf-req-header">
        <span class="gf-req-title">🔔 Lời mời kết bạn</span>
        <span class="gf-req-count">${reqs.length}</span>
      </div>` +
      reqs.map(r => {
        const name = esc(r.from?.displayName || r.from?.username || '?');
        const initials = name.slice(0,2).toUpperCase();
        const id = r.from?._id || r.from;
        const timeAgo = r.createdAt ? timeAgoVi(new Date(r.createdAt)) : '';
        return `
        <div class="gf-fr-card" data-id="${id}">
          <div class="gf-fr-avatar">${initials}</div>
          <div class="gf-fr-info">
            <div class="gf-fr-name">${name}</div>
            ${timeAgo ? `<div class="gf-fr-time">${timeAgo}</div>` : ''}
          </div>
          <div class="gf-fr-actions">
            <button class="gf-fr-accept" data-id="${id}" title="Chấp nhận">✅</button>
            <button class="gf-fr-reject" data-id="${id}" title="Từ chối">✕</button>
          </div>
        </div>`;
      }).join('');

    wrap.querySelectorAll('.gf-fr-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        await apiGamification.acceptFriend(btn.dataset.id);
        toast('🎉 Đã kết bạn!');
        launchConfetti('low');
        loadFriendRequests(); loadLeaderboard(); loadFriendsList();
      });
    });
    wrap.querySelectorAll('.gf-fr-reject').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.closest('.gf-fr-card').style.opacity = '0.4';
        await apiGamification.rejectFriend(btn.dataset.id);
        loadFriendRequests();
      });
    });
  } catch(e) {}
}

// ── FRIENDS LIST ──
async function loadFriendsList() {
  try {
    const friends = await apiGamification.friendsList();
    const wrap = document.getElementById('gf-friends-list');
    if (!wrap) return;
    if (!friends || friends.length === 0) {
      wrap.innerHTML = `
        <div class="gf-friends-empty">
          <div class="gf-fe-icon">🤝</div>
          <div class="gf-fe-text">Chưa có bạn bè</div>
          <div class="gf-fe-sub">Chia sẻ mã bạn bè để kết nối và truyền lửa cho nhau!</div>
        </div>`;
      return;
    }
    wrap.innerHTML = `<div class="gf-fl-header">Bạn bè (${friends.length})</div>` +
      friends.map(f => {
        const name = esc(f.displayName || f.username);
        const initials = name.slice(0,2).toUpperCase();
        const sentToday = f.fireSentToday;
        const online = f.isOnline;
        const myFireStreak = f.myFireStreak || 0;
        const streakTier = getStreakTier(Math.max(myFireStreak, 1));
        const streakBadge = myFireStreak > 0
          ? `<span class="gf-streak-badge gf-streak-t${streakTier}"><span class="sfl sfl-t${streakTier}" style="font-size:14px">🔥</span>${myFireStreak}</span>`
          : '';
        const fs = f.friendship || {};
        const fsBadge = `<span class="gf-fs-badge gf-fs-lv${fs.level||0}" title="Mức thân thiết: ${fs.label||'Xa lạ'}">${fs.emoji||'🌱'} ${fs.label||'Xa lạ'}</span>`;
        const fireBtn = sentToday
          ? `<button class="gf-fl-fire-btn sent-today" data-id="${f._id}" data-name="${name}" disabled title="Đã gửi lửa hôm nay">✅</button>`
          : `<button class="gf-fl-fire-btn" data-id="${f._id}" data-name="${name}" title="Truyền lửa cho ${name}">🔥</button>`;
        return `
        <div class="gf-fl-card" data-id="${f._id}">
          <div class="gf-fl-avatar-wrap">
            <div class="gf-fl-avatar">${initials}</div>
            ${online ? '<span class="gf-online-dot"></span>' : ''}
          </div>
          <div class="gf-fl-info">
            <div class="gf-fl-name">${name}${online ? ' <span class="gf-online-label">Đang hoạt động</span>' : ''} ${streakBadge}</div>
            <div class="gf-fl-sub">${fsBadge} · ${sentToday ? '✅ Đã truyền lửa hôm nay' : 'Nhấn 🔥 để truyền lửa'}</div>
          </div>
          <div class="gf-fl-actions">
            ${fireBtn}
            <button class="gf-fl-gift-btn" data-id="${f._id}" data-name="${name}" title="Tặng quà cho ${name}">🎁</button>
            <button class="gf-fl-chat-btn" data-id="${f._id}" data-name="${name}" data-online="${online}" title="Nhắn tin cho ${name}">💬</button>
            <button class="gf-fl-remove" data-id="${f._id}" title="Huỷ kết bạn">✕</button>
          </div>
        </div>`;
      }).join('');

    // Render fire streaks section
    renderFireStreaksSection(friends);

    // Fire buttons — only active ones (not already sent today)
    wrap.querySelectorAll('.gf-fl-fire-btn:not(.sent-today)').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.textContent = '⏳';
        try {
          await apiGamification.sendFire(btn.dataset.id);
          setFireBtnSent(btn, btn.dataset.name);
          toast(`🔥 Đã truyền lửa cho ${btn.dataset.name}!`);
          showFireSentAnimation();
        } catch(e) {
          btn.disabled = false;
          btn.textContent = '🔥';
          toast('❌ ' + (e.error || e.message || 'Lỗi gửi lửa'));
        }
      });
    });

    // Gift buttons
    wrap.querySelectorAll('.gf-fl-gift-btn').forEach(btn => {
      btn.addEventListener('click', () => openGiftModal(btn.dataset.id, btn.dataset.name));
    });

    // Chat buttons
    wrap.querySelectorAll('.gf-fl-chat-btn').forEach(btn => {
      btn.addEventListener('click', () => openChatWindow(btn.dataset.id, btn.dataset.name, btn.dataset.online === 'true'));
    });

    // Remove buttons
    wrap.querySelectorAll('.gf-fl-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Huỷ kết bạn?')) return;
        await apiGamification.removeFriend(btn.dataset.id);
        toast('Đã huỷ kết bạn');
        loadFriendsList(); loadLeaderboard();
      });
    });
  } catch(e) {}
}

// ── FIRE STREAKS SECTION ──
function renderFireStreaksSection(friends) {
  const section = document.getElementById('gf-fire-streaks-section');
  const list    = document.getElementById('gf-fire-streaks-list');
  if (!section || !list || !friends || friends.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  // Sort: sent today last, then by streak desc
  const sorted = [...friends].sort((a, b) => {
    const sa = a.myFireStreak || 0, sb = b.myFireStreak || 0;
    return sb - sa;
  });

  list.innerHTML = sorted.map(f => {
    const name      = esc(f.displayName || f.username);
    const initials  = [...name].slice(0, 2).join('').toUpperCase();
    const streak    = f.myFireStreak || 0;
    const tier      = getStreakTier(Math.max(streak, 1));
    const sentToday = f.fireSentToday;
    const toNext    = streak > 0 ? (10 - (streak % 10 === 0 ? 10 : streak % 10)) : 10;
    const showNext  = streak > 0 && toNext < 10;

    const fireBtn = sentToday
      ? `<button class="gf-fsc-fire-btn gf-fsc-sent" disabled>✅ Đã gửi</button>`
      : `<button class="gf-fsc-fire-btn" data-id="${f._id}" data-name="${name}">🔥 Truyền lửa</button>`;

    return `
    <div class="gf-fsc-card gf-fsc-t${tier}" data-id="${f._id}">
      <div class="gf-fsc-avatar gf-fsc-av-t${tier}">${initials}</div>
      <div class="gf-fsc-info">
        <div class="gf-fsc-name">${name}</div>
        <div class="gf-fsc-motiv">${getStreakMotivation(streak)}</div>
        ${showNext ? `<div class="gf-fsc-next">Còn <b>${toNext}</b> ngày đến mốc 🏆</div>` : ''}
      </div>
      <div class="gf-fsc-streak-block">
        <span class="sfl sfl-t${tier}" style="font-size:22px">🔥</span>
        <div class="gf-fsc-days gf-fsc-days-t${tier}">${streak}</div>
        <div class="gf-fsc-days-label">ngày</div>
      </div>
      <div class="gf-fsc-action">${fireBtn}</div>
    </div>`;
  }).join('');

  // Wire up fire buttons
  list.querySelectorAll('.gf-fsc-fire-btn:not(.gf-fsc-sent)').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = '⏳';
      try {
        await apiGamification.sendFire(btn.dataset.id);
        btn.textContent = '✅ Đã gửi';
        btn.classList.add('gf-fsc-sent');
        // Sync trạng thái nút trong danh sách bạn bè
        const friendCard = document.querySelector(`#gf-friends-list .gf-fl-card[data-id="${btn.dataset.id}"]`);
        if (friendCard) {
          const flBtn = friendCard.querySelector('.gf-fl-fire-btn');
          if (flBtn) setFireBtnSent(flBtn, btn.dataset.name);
        }
        toast(`🔥 Đã truyền lửa cho ${btn.dataset.name}!`);
        showFireSentAnimation();
        quickNotifCheck();
      } catch(e) {
        btn.disabled = false;
        btn.textContent = '🔥 Truyền lửa';
        toast('❌ ' + (e.error || e.message || 'Lỗi gửi lửa'));
      }
    });
  });
}

// ── FIRE NOTIFICATION CHECK ──
async function checkFireNotifications() {
  try {
    const notif = await apiGamification.notifications();
    // Update tab dot + friend badge
    const dot = document.getElementById('tnav-notif-dot');
    if (dot) dot.style.display = notif.total > 0 ? 'inline-block' : 'none';
    updateFriendNotifBadge(notif.requestCount);
    // Update chat unread badge
    const chatBadge = document.getElementById('gf-chat-unread-badge');
    if (chatBadge) {
      const mc = notif.messageCount || 0;
      chatBadge.textContent = mc;
      chatBadge.style.display = mc > 0 ? 'inline-flex' : 'none';
    }
    // Show fire overlay for unseen fires
    if (notif.fireCount > 0) {
      const fires = await apiGamification.getFires();
      if (fires && fires.length > 0) {
        const latest = fires[fires.length - 1];
        showFireReceivedOverlay(latest.fromName, latest.message, fires.length, latest.from, latest.alreadySentBack);
      }
    }
    // Refresh bell badge to include everything
    quickNotifCheck();
  } catch(e) {}
}

function updateFriendNotifBadge(count) {
  const badge = document.getElementById('gf-notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ── FIRE OVERLAY INIT (called once from DOMContentLoaded) ──
let _fireOverlaySenderId = null;

function initFireOverlay() {
  const overlay = document.getElementById('fire-overlay');
  if (!overlay) return;

  // Close button
  document.getElementById('fire-overlay-close')?.addEventListener('click', () => {
    overlay.style.display = 'none';
    _fireOverlaySenderId = null;
    apiGamification.markFiresSeen().catch(() => {});
    // Update notification dot
    const dot = document.getElementById('tnav-notif-dot');
    if (dot) dot.style.display = 'none';
  });

  // Reply with fire button
  document.getElementById('fire-overlay-reply')?.addEventListener('click', async () => {
    if (!_fireOverlaySenderId) { toast('Không tìm thấy người gửi!'); return; }
    const replyBtn = document.getElementById('fire-overlay-reply');
    replyBtn.disabled = true; replyBtn.textContent = '⏳ Đang gửi...';
    try {
      await apiGamification.sendFire(_fireOverlaySenderId);
      toast('🔥 Đã gửi lửa lại!');
      showFireSentAnimation();
      replyBtn.textContent = '✅ Đã gửi!';
      // Also update the friend list button in the UI if visible
      const friendBtn = document.querySelector(`.gf-fl-fire-btn[data-id="${_fireOverlaySenderId}"]`);
      if (friendBtn) setFireBtnSent(friendBtn, friendBtn.dataset.name);
      setTimeout(() => {
        overlay.style.display = 'none';
        _fireOverlaySenderId = null;
        apiGamification.markFiresSeen().catch(() => {});
        const dot = document.getElementById('tnav-notif-dot');
        if (dot) dot.style.display = 'none';
      }, 1200);
    } catch(e) {
      const msg = e.error || e.message || 'Lỗi gửi lửa';
      toast('❌ ' + msg);
      // If already sent today, update button anyway
      if (msg.includes('hôm nay')) {
        replyBtn.textContent = '✅ Đã gửi hôm nay';
      } else {
        replyBtn.disabled = false; replyBtn.textContent = '🔥 Gửi lại lửa';
      }
    }
  });

  // Click backdrop to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      _fireOverlaySenderId = null;
      apiGamification.markFiresSeen().catch(() => {});
    }
  });
}

// ── FIRE ANIMATIONS ──
function showFireReceivedOverlay(fromName, message, count, senderId, alreadySentBack) {
  const overlay = document.getElementById('fire-overlay');
  const fromEl = document.getElementById('fire-overlay-from');
  const msgEl = document.getElementById('fire-overlay-msg');
  const particles = document.getElementById('fire-overlay-particles');
  const replyBtn = document.getElementById('fire-overlay-reply');
  if (!overlay) return;

  // Store sender ID for reply button
  _fireOverlaySenderId = senderId || null;
  if (replyBtn) {
    // Hide reply if already sent fire to this person today (prevents infinite loop)
    if (alreadySentBack) {
      replyBtn.style.display = 'none';
    } else {
      replyBtn.disabled = false;
      replyBtn.textContent = '🔥 Gửi lại lửa';
      replyBtn.style.display = senderId ? '' : 'none';
    }
  }

  fromEl.textContent = `${fromName} ${message}`;
  if (count > 1) msgEl.textContent = `+${count - 1} ngọn lửa khác đang chờ bạn!`;
  else msgEl.textContent = '';

  // Generate particle fires
  particles.innerHTML = '';
  const emojis = ['🔥','🔥','🔥','✨','💪','⚡','🌟','🔥'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'fire-particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.cssText = `
      left:${Math.random() * 100}%;
      animation-delay:${Math.random() * 1.5}s;
      animation-duration:${1.5 + Math.random() * 1.5}s;
      font-size:${20 + Math.floor(Math.random() * 28)}px;
    `;
    particles.appendChild(p);
  }

  overlay.style.display = 'flex';
}

// Mark a fire button as already sent today (updates sub-text too)
function setFireBtnSent(btn, name) {
  btn.textContent = '✅';
  btn.disabled = true;
  btn.classList.add('sent-today');
  const card = btn.closest('.gf-fl-card');
  if (card) {
    const sub = card.querySelector('.gf-fl-sub');
    if (sub) sub.textContent = '🔥 Đã truyền lửa hôm nay';
  }
}

function showFireSentAnimation() {
  // Brief burst of fire on sender side
  const container = document.getElementById('floating-pets-container');
  if (!container) return;
  const emojis = ['🔥','🔥','💪','✨','⚡'];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.cssText = `
      position:fixed;
      left:${30 + Math.random() * 40}%;
      top:${30 + Math.random() * 30}%;
      font-size:${22 + Math.floor(Math.random() * 20)}px;
      pointer-events:none;z-index:9990;
      animation:fireSentFloat ${0.8 + Math.random() * 0.8}s ease-out forwards;
      animation-delay:${Math.random() * 0.4}s;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}

// ── GIFT MODAL ──
let _giftToId = null, _giftToName = '', _giftSelectedItem = null, _giftQty = 1, _giftInventory = {};

function initGiftModal() {
  const modal = document.getElementById('gift-modal');
  if (!modal) return;
  document.getElementById('gift-modal-close')?.addEventListener('click', closeGiftModal);
  document.getElementById('gift-modal-backdrop')?.addEventListener('click', closeGiftModal);
  document.getElementById('gift-qty-minus')?.addEventListener('click', () => {
    if (_giftQty > 1) { _giftQty--; updateGiftQtyUI(); }
  });
  document.getElementById('gift-qty-plus')?.addEventListener('click', () => {
    const max = _giftInventory[_giftSelectedItem] || 1;
    if (_giftQty < Math.min(max, 20)) { _giftQty++; updateGiftQtyUI(); }
  });
  document.getElementById('gift-send-btn')?.addEventListener('click', sendGift);
}

function closeGiftModal() {
  const modal = document.getElementById('gift-modal');
  if (modal) modal.style.display = 'none';
  _giftToId = null; _giftToName = ''; _giftSelectedItem = null; _giftQty = 1;
}

async function openGiftModal(friendId, friendName) {
  _giftToId = friendId;
  _giftToName = friendName;
  _giftSelectedItem = null;
  _giftQty = 1;

  document.getElementById('gift-modal-name').textContent = friendName;
  document.getElementById('gift-qty-row').style.display = 'none';
  document.getElementById('gift-send-btn').disabled = true;

  // Load player inventory
  const modal = document.getElementById('gift-modal');
  const grid = document.getElementById('gift-items-grid');
  grid.innerHTML = '<div class="gift-loading">Đang tải kho...</div>';
  modal.style.display = 'flex';

  try {
    const pts = await API.g('/api/shop/points');
    const ALL_GIFT_ITEMS = [
      { id:'food',       name:'Cà rốt',           emoji:'🥕' },
      { id:'meat',       name:'Thịt tươi',         emoji:'🥩' },
      { id:'fish',       name:'Cá hồi',            emoji:'🐟' },
      { id:'seed',       name:'Hạt giống',         emoji:'🌻' },
      { id:'treat',      name:'Bánh thưởng',       emoji:'🍪' },
      { id:'water',      name:'Nước sạch',         emoji:'💧' },
      { id:'fertilizer', name:'Phân bón',          emoji:'🌿' },
      { id:'coffee',     name:'Cà phê',            emoji:'☕' },
      { id:'rose',       name:'Hoa hồng',          emoji:'🌹' },
      { id:'chocolate',  name:'Socola',            emoji:'🍫' },
      { id:'star',       name:'Ngôi sao may mắn',  emoji:'⭐' },
    ];
    _giftInventory = {};
    ALL_GIFT_ITEMS.forEach(it => { _giftInventory[it.id] = pts[it.id] || 0; });

    const available = ALL_GIFT_ITEMS.filter(it => _giftInventory[it.id] > 0);
    if (available.length === 0) {
      grid.innerHTML = '<div class="gift-empty">Kho trống! Mua vật phẩm từ cửa hàng để tặng bạn bè.</div>';
      return;
    }

    grid.innerHTML = available.map(it => `
      <div class="gift-item-card" data-id="${it.id}">
        <div class="gift-item-emoji">${it.emoji}</div>
        <div class="gift-item-name">${it.name}</div>
        <div class="gift-item-qty">Có: ${_giftInventory[it.id]}</div>
      </div>`).join('');

    grid.querySelectorAll('.gift-item-card').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.gift-item-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        _giftSelectedItem = card.dataset.id;
        _giftQty = 1;
        const max = _giftInventory[_giftSelectedItem] || 1;
        document.getElementById('gift-qty-max').textContent = `(tối đa ${Math.min(max, 20)})`;
        updateGiftQtyUI();
        document.getElementById('gift-qty-row').style.display = 'flex';
        document.getElementById('gift-send-btn').disabled = false;
      });
    });
  } catch(e) {
    grid.innerHTML = '<div class="gift-empty">Lỗi tải kho!</div>';
  }
}

function updateGiftQtyUI() {
  document.getElementById('gift-qty-val').textContent = _giftQty;
  const max = _giftInventory[_giftSelectedItem] || 1;
  document.getElementById('gift-qty-minus').disabled = _giftQty <= 1;
  document.getElementById('gift-qty-plus').disabled = _giftQty >= Math.min(max, 20);
}

async function sendGift() {
  if (!_giftToId || !_giftSelectedItem) return;
  const btn = document.getElementById('gift-send-btn');
  btn.disabled = true; btn.textContent = '⏳ Đang gửi...';
  try {
    const res = await apiGamification.giftItem(_giftToId, _giftSelectedItem, _giftQty);
    if (res.error) { toast('❌ ' + res.error); btn.disabled = false; btn.textContent = 'Gửi quà 🎁'; return; }
    toast(`🎁 Đã tặng quà cho ${_giftToName}!`);
    showGiftSentAnimation();
    closeGiftModal();
  } catch(e) {
    toast('❌ ' + (e.error || e.message || 'Lỗi gửi quà'));
    btn.disabled = false; btn.textContent = 'Gửi quà 🎁';
  }
}

function showGiftSentAnimation() {
  const emojis = ['🎁','🎁','✨','⭐','🎊','🎉'];
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div');
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.cssText = `
      position:fixed;
      left:${20 + Math.random() * 60}%;
      top:${20 + Math.random() * 40}%;
      font-size:${20 + Math.floor(Math.random() * 24)}px;
      pointer-events:none;z-index:9990;
      animation:fireSentFloat ${0.9 + Math.random() * 0.8}s ease-out forwards;
      animation-delay:${Math.random() * 0.3}s;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}

async function checkGiftNotifications() {
  try {
    const gifts = await apiGamification.getGifts();
    if (!gifts || gifts.length === 0) return;
    await apiGamification.markGiftsSeen();
    // For each gift, ask open now or later
    gifts.forEach((g, i) => {
      setTimeout(() => showGiftOpenChoice(g), i * 400);
    });
  } catch(e) {}
}

function showGiftOpenChoice(g) {
  // Create a small toast-style prompt
  const el = document.createElement('div');
  el.className = 'gift-choice-toast';
  el.innerHTML = `
    <div class="gct-left">
      <span class="gct-emoji">${g.itemEmoji}</span>
      <div class="gct-info">
        <div class="gct-title">${esc(g.fromName)} tặng ${g.qty}x ${g.itemName}</div>
        <div class="gct-sub">Mở quà ngay hay để sau?</div>
      </div>
    </div>
    <div class="gct-btns">
      <button class="gct-now-btn">Mở ngay ✨</button>
      <button class="gct-later-btn">Để sau</button>
    </div>
  `;
  document.body.appendChild(el);
  // Animate in
  requestAnimationFrame(() => el.classList.add('gct-visible'));

  const remove = () => {
    el.classList.remove('gct-visible');
    setTimeout(() => el.remove(), 300);
  };

  el.querySelector('.gct-now-btn').addEventListener('click', () => {
    remove();
    showGiftReceivedEffect(g);
  });
  el.querySelector('.gct-later-btn').addEventListener('click', () => {
    remove();
    // Save to pending gifts in localStorage
    const pending = JSON.parse(localStorage.getItem('rh-pending-gifts') || '[]');
    pending.push(g);
    localStorage.setItem('rh-pending-gifts', JSON.stringify(pending));
    toast(`🎁 Đã lưu quà vào thông báo — mở sau khi sẵn sàng!`);
    // Update badge
    loadNotifications();
  });

  // Auto-dismiss after 12 seconds
  setTimeout(() => { if (document.body.contains(el)) remove(); }, 12000);
}

function showGiftReceivedEffect(g) {
  switch(g.itemId) {
    case 'star':       _giftEffectStar(g);       break;
    case 'chocolate':  _giftEffectChocolate(g);  break;
    case 'rose':       _giftEffectRose(g);       break;
    case 'coffee':     _giftEffectCoffee(g);     break;
    case 'treat':      _giftEffectTreat(g);      break;
    case 'water':      _giftEffectWater(g);      break;
    case 'fertilizer': _giftEffectFertilizer(g); break;
    case 'food':       _giftEffectFood(g);       break;
    case 'meat':       _giftEffectMeat(g);       break;
    case 'fish':       _giftEffectFish(g);       break;
    case 'seed':       _giftEffectSeed(g);       break;
    default:
      toast(`🎁 ${g.fromName} tặng bạn ${g.qty}x ${g.itemEmoji} ${g.itemName}!`);
  }
}

// ⭐ Sao may mắn — mở phong bao lì xì, cộng điểm ngẫu nhiên
function _giftEffectStar(g) {
  const pts = g.bonusPoints || Math.floor(Math.random() * 91) + 10;
  const overlay = document.getElementById('gift-lixi-overlay');
  const env     = document.getElementById('lixi-envelope');
  const msg     = document.getElementById('lixi-msg');
  if (!overlay) return;
  document.getElementById('lixi-from').textContent = `${g.fromName} gửi tặng bạn lì xì!`;
  document.getElementById('lixi-pts').textContent  = `+${pts} ⭐`;
  env.style.cssText  = 'display:flex;animation:none;font-size:72px;cursor:pointer;';
  msg.style.display  = 'none';
  overlay.style.display = 'flex';

  const openIt = () => {
    env.style.animation = 'lixiOpen 0.5s forwards';
    setTimeout(() => {
      env.style.display = 'none';
      msg.style.display = 'flex';
      updatePointsUI((_shopData.points || 0) + pts);
      launchConfetti('medium');
      _spawnParticles(['⭐','✨','🌟','💫','🎊'], 22);
    }, 500);
  };
  env.onclick = openIt;
  document.getElementById('lixi-close-btn').onclick = () => { overlay.style.display = 'none'; };
  toast(`🧧 ${g.fromName} gửi lì xì! Nhấn để mở!`);
}

// 🍫 Socola — trái tim + confetti niềm vui
function _giftEffectChocolate(g) {
  toast(`🍫 ${g.fromName} tặng ${g.qty}x Socola! Ngọt ngào quá! 💕`);
  _spawnParticles(['🍫','💕','💝','😍','🥰','💖','✨'], 24);
  setTimeout(() => _spawnParticles(['💕','💖','💗'], 12), 600);
}

// 🌹 Hoa hồng — cánh hoa rơi lãng mạn
function _giftEffectRose(g) {
  toast(`🌹 ${g.fromName} tặng ${g.qty}x Hoa hồng! Lãng mạn quá~`);
  const PETALS = ['🌹','🌸','🌺','💐','🪷'];
  for (let i = 0; i < 18; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'gift-petal';
      p.textContent = PETALS[Math.floor(Math.random() * PETALS.length)];
      const dur = 2 + Math.random() * 2;
      p.style.cssText = `left:${Math.random()*100}%;--dur:${dur}s;font-size:${16+Math.floor(Math.random()*14)}px;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), dur * 1000 + 200);
    }, i * 120);
  }
}

// ☕ Cà phê — hơi nước + năng lượng bốc lên
function _giftEffectCoffee(g) {
  toast(`☕ ${g.fromName} tặng ${g.qty}x Cà phê! Tỉnh táo và năng động!`);
  _spawnParticlesUp(['☕','⚡','💪','🔥','⚡','✨'], 16);
}

// 🍪 Bánh thưởng — bong bóng màu sắc nổ
function _giftEffectTreat(g) {
  toast(`🍪 ${g.fromName} tặng ${g.qty}x Bánh thưởng! Ngon lắm!`);
  _spawnParticles(['🍪','🎈','🎊','🎉','🎀','💛','🧡'], 20);
  launchConfetti('light');
}

// 💧 Nước — giọt nước rơi từ trên xuống
function _giftEffectWater(g) {
  toast(`💧 ${g.fromName} tặng ${g.qty}x Nước sạch! Mát lành!`);
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'gift-petal';
      p.textContent = ['💧','🌊','💦','🫧'][Math.floor(Math.random()*4)];
      const dur = 1.5 + Math.random();
      p.style.cssText = `left:${10+Math.random()*80}%;--dur:${dur}s;font-size:${14+Math.floor(Math.random()*10)}px;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), dur * 1000 + 200);
    }, i * 80);
  }
}

// 🌿 Phân bón — lá cây + hoa nở bay lên
function _giftEffectFertilizer(g) {
  toast(`🌿 ${g.fromName} tặng ${g.qty}x Phân bón! Cây cối sẽ lớn mạnh!`);
  _spawnParticlesUp(['🌿','🌱','🌻','🌸','🍀','🪴','🌾'], 18);
}

// 🥕 Cà rốt — thỏ nhảy từ cạnh màn hình
function _giftEffectFood(g) {
  toast(`🥕 ${g.fromName} tặng ${g.qty}x Cà rốt! Thỏ thích lắm!`);
  _spawnParticles(['🥕','🐰','🐇','✨'], 16);
  // Thỏ chạy ngang màn hình
  const rabbit = document.createElement('div');
  rabbit.textContent = '🐇';
  rabbit.style.cssText = `position:fixed;bottom:${60+Math.random()*80}px;left:-60px;font-size:32px;z-index:9999;pointer-events:none;transition:left 2.5s linear;`;
  document.body.appendChild(rabbit);
  requestAnimationFrame(() => { rabbit.style.left = (window.innerWidth + 60) + 'px'; });
  setTimeout(() => rabbit.remove(), 2700);
}

// 🥩 Thịt — lửa BBQ bốc lên
function _giftEffectMeat(g) {
  toast(`🥩 ${g.fromName} tặng ${g.qty}x Thịt tươi! Thơm ngon!`);
  _spawnParticlesUp(['🔥','🥩','💨','🌡️','🔥','✨'], 18);
}

// 🐟 Cá hồi — bong bóng nước + cá nhảy
function _giftEffectFish(g) {
  toast(`🐟 ${g.fromName} tặng ${g.qty}x Cá hồi! Tươi rói!`);
  _spawnParticles(['🐟','🫧','💧','🐠','🐡','🌊'], 18);
  // Cá nhảy lên
  const fish = document.createElement('div');
  fish.textContent = '🐟';
  fish.style.cssText = `position:fixed;left:${20+Math.random()*60}%;bottom:-20px;font-size:36px;z-index:9999;pointer-events:none;animation:fishJump 1.4s ease-out forwards;`;
  document.body.appendChild(fish);
  setTimeout(() => fish.remove(), 1500);
}

// 🌻 Hạt giống — mầm cây mọc lên từ dưới
function _giftEffectSeed(g) {
  toast(`🌻 ${g.fromName} tặng ${g.qty}x Hạt giống! Trồng cây thôi!`);
  // Mầm mọc từ dưới lên
  const SPROUTS = ['🌱','🌿','🌸','🌻','🌼'];
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const s = document.createElement('div');
      s.className = 'gift-sprout';
      s.textContent = SPROUTS[i];
      s.style.cssText = `left:${10+i*18}%;`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 2500);
    }, i * 200);
  }
  _spawnParticlesUp(['🌻','✨','🌱','💚'], 10);
}

// Helper: spawn particles that float up
function _spawnParticlesUp(emojis, count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.cssText = `
        position:fixed;
        left:${10+Math.random()*80}%;
        bottom:${80+Math.random()*80}px;
        font-size:${16+Math.floor(Math.random()*18)}px;
        pointer-events:none;z-index:9990;
        animation:giftFloatUp ${1.2+Math.random()*1}s ease-out forwards;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 2500);
    }, i * 60);
  }
}

// Helper: spawn particles that scatter from center
function _spawnParticles(emojis, count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.cssText = `
        position:fixed;
        left:${20+Math.random()*60}%;
        top:${20+Math.random()*50}%;
        font-size:${14+Math.floor(Math.random()*22)}px;
        pointer-events:none;z-index:9990;
        animation:fireSentFloat ${0.8+Math.random()*0.8}s ease-out forwards;
        animation-delay:${Math.random()*0.3}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }, i * 50);
  }
}

// ── TIME AGO (Vietnamese) ──
function timeAgoVi(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

// ── CHAT / MESSAGING ──
let _chatFriendId = null, _chatFriendName = null, _chatPollTimer = null;

// ── FRIEND STREAK BANNER ──
function getStreakMotivation(n) {
  if (n === 0) return 'Hãy bắt đầu truyền lửa cho nhau! 🔥';
  if (n >= 100) return '🌟 Huyền thoại! 100+ ngày rực cháy cùng nhau!';
  if (n >= 50)  return '💎 Vĩ đại! Chuỗi lửa 50+ ngày bất diệt!';
  if (n >= 30)  return '🏆 Phi thường! 1 tháng cùng nhau!';
  if (n >= 20)  return '⚡ Mạnh mẽ! 20 ngày rực cháy cùng nhau!';
  if (n >= 10)  return '🎯 Tuyệt vời! 10 ngày liên tiếp!';
  if (n >= 5)   return '💪 Tiếp tục! Chuỗi lửa đang bùng cháy!';
  return '🔥 Đang khởi động! Duy trì nhé!';
}

function buildFriendStreakBanner(data, friendName) {
  const { myStreak = 0, theirStreak = 0, mutual = 0 } = data || {};
  const display = mutual > 0 ? mutual : Math.max(myStreak, theirStreak);
  const tier = getStreakTier(Math.max(display, 1));
  const flameSz = [48, 56, 64, 74, 84, 96][tier - 1];
  const motivation = getStreakMotivation(mutual);
  const isMilestone = mutual > 0 && mutual % 10 === 0;

  if (mutual === 0 && myStreak === 0 && theirStreak === 0) {
    return `<div class="cfs-banner cfs-empty">
      <span class="cfs-flame-idle">🔥</span>
      <div class="cfs-info">
        <div class="cfs-label-empty">Chưa có chuỗi lửa chung</div>
        <div class="cfs-motivation">${motivation}</div>
      </div>
    </div>`;
  }

  const mutualLabel = mutual > 0
    ? `<div class="cfs-mutual-wrap">
        <span class="cfs-num cfs-num-t${tier}">${mutual}</span>
        <span class="cfs-unit">ngày cùng nhau</span>
        ${isMilestone ? `<span class="cfs-badge-milestone">🏆</span>` : ''}
       </div>`
    : `<div class="cfs-mutual-wrap"><span class="cfs-num-dim">—</span><span class="cfs-unit">chuỗi chung</span></div>`;

  return `<div class="cfs-banner cfs-t${tier}">
    <div class="cfs-flame-col">
      <span class="sfl sfl-t${tier}" style="font-size:${flameSz}px">🔥</span>
    </div>
    <div class="cfs-center">
      ${mutualLabel}
      <div class="cfs-motivation">${motivation}</div>
    </div>
    <div class="cfs-stats">
      <div class="cfs-stat-row"><span class="cfs-stat-you">Bạn</span><span class="cfs-stat-val cfs-stat-val-t${getStreakTier(myStreak||1)}">${myStreak}🔥</span></div>
      <div class="cfs-stat-row"><span class="cfs-stat-they">${esc(friendName||'Họ')}</span><span class="cfs-stat-val cfs-stat-val-t${getStreakTier(theirStreak||1)}">${theirStreak}🔥</span></div>
    </div>
  </div>`;
}

async function loadConversations() {
  try {
    const convos = await apiGamification.conversations();
    const wrap = document.getElementById('gf-conversations-list');
    if (!wrap) return;

    // Update unread badge
    const totalUnread = convos.reduce((s, c) => s + c.unread, 0);
    const badge = document.getElementById('gf-chat-unread-badge');
    if (badge) {
      badge.textContent = totalUnread;
      badge.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
    }

    if (!convos.length) {
      wrap.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:12px;padding:16px">Kết bạn để bắt đầu nhắn tin!</div>';
      return;
    }

    wrap.innerHTML = convos.map(c => {
      const initials = (c.friendName || '?').slice(0, 2).toUpperCase();
      const lastMsg = c.lastMessage
        ? `<span style="color:${c.lastMessage.fromMe ? 'var(--text3)' : 'var(--text2)'}">${c.lastMessage.fromMe ? 'Bạn: ' : ''}${esc(c.lastMessage.content).slice(0, 40)}${c.lastMessage.content.length > 40 ? '...' : ''}</span>`
        : '<span style="color:var(--text3)">Chưa có tin nhắn</span>';
      const time = c.lastMessage ? timeAgoVi(new Date(c.lastMessage.createdAt)) : '';
      return `
      <div class="chat-convo-card" data-fid="${c.friendId}" data-fname="${esc(c.friendName)}" data-online="${c.isOnline}">
        <div class="chat-convo-avatar-wrap">
          <div class="chat-convo-avatar">${initials}</div>
          ${c.isOnline ? '<span class="gf-online-dot"></span>' : ''}
        </div>
        <div class="chat-convo-info">
          <div class="chat-convo-name">${esc(c.friendName)}${c.unread > 0 ? ` <span class="chat-convo-unread">${c.unread}</span>` : ''}</div>
          <div class="chat-convo-last">${lastMsg}</div>
        </div>
        <div class="chat-convo-time">${time}</div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('.chat-convo-card').forEach(card => {
      card.addEventListener('click', () => {
        openChatWindow(card.dataset.fid, card.dataset.fname, card.dataset.online === 'true');
      });
    });
  } catch(e) { console.error('loadConversations:', e); }
}

async function openChatWindow(friendId, friendName, isOnline) {
  _chatFriendId = friendId;
  _chatFriendName = friendName;

  document.getElementById('chat-friend-name').textContent = friendName;
  const status = document.getElementById('chat-online-status');
  if (status) {
    status.textContent = isOnline ? '● Đang hoạt động' : '';
    status.style.color = isOnline ? '#5ef0a0' : 'var(--text3)';
  }

  // Show streak banner
  const streakEl = document.getElementById('chat-friend-streak');
  if (streakEl) {
    streakEl.style.display = 'block';
    streakEl.innerHTML = '<div class="cfs-loading">🔥 Đang tải chuỗi lửa...</div>';
    apiGamification.fireStreak(friendId).then(data => {
      streakEl.innerHTML = buildFriendStreakBanner(data, friendName);
    }).catch(() => { streakEl.style.display = 'none'; });
  }

  const msgWrap = document.getElementById('chat-messages');
  msgWrap.innerHTML = '<div style="text-align:center;color:var(--text3);padding:40px">Đang tải...</div>';
  document.getElementById('chat-window').style.display = 'flex';
  document.getElementById('chat-input').focus();

  await loadChatMessages();

  // Poll for new messages every 4 seconds
  clearInterval(_chatPollTimer);
  _chatPollTimer = setInterval(loadChatMessages, 4000);
}

async function loadChatMessages() {
  if (!_chatFriendId) return;
  try {
    const messages = await apiGamification.messages(_chatFriendId);
    const msgWrap = document.getElementById('chat-messages');
    const wasAtBottom = msgWrap.scrollHeight - msgWrap.scrollTop - msgWrap.clientHeight < 60;

    msgWrap.innerHTML = messages.length === 0
      ? '<div style="text-align:center;color:var(--text3);padding:40px;font-size:13px">Hãy gửi tin nhắn đầu tiên! 👋</div>'
      : messages.map(m => {
          const isMe = m.from !== _chatFriendId;
          const time = new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          return `<div class="chat-msg ${isMe ? 'chat-msg-me' : 'chat-msg-them'}">
            <div class="chat-bubble">${esc(m.content)}</div>
            <div class="chat-time">${time}</div>
          </div>`;
        }).join('');

    if (wasAtBottom || msgWrap.dataset.firstLoad !== 'done') {
      msgWrap.scrollTop = msgWrap.scrollHeight;
      msgWrap.dataset.firstLoad = 'done';
    }
  } catch(e) { console.error('loadChatMessages:', e); }
}

function closeChatWindow() {
  clearInterval(_chatPollTimer);
  _chatFriendId = null;
  document.getElementById('chat-window').style.display = 'none';
  const streakEl = document.getElementById('chat-friend-streak');
  if (streakEl) streakEl.style.display = 'none';
  loadConversations(); // Refresh unread counts
}

function initChat() {
  document.getElementById('chat-back-btn')?.addEventListener('click', closeChatWindow);

  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');

  async function sendChatMsg() {
    if (!_chatFriendId) return;
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    sendBtn.disabled = true;
    try {
      await apiGamification.sendMessage(_chatFriendId, content);
      await loadChatMessages();
    } catch(e) { toast('❌ ' + (e.message || 'Lỗi gửi tin nhắn')); }
    finally { sendBtn.disabled = false; input.focus(); }
  }

  sendBtn?.addEventListener('click', sendChatMsg);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMsg(); });
}

// ── ACHIEVEMENTS PAGE ──
const BADGE_CATEGORIES = [
  { key: 'tasks',        title: '✅ Tasks',         check: 'tasks' },
  { key: 'streak',       title: '🔥 Streaks',       check: 'streak' },
  { key: 'pets',         title: '🐾 Thú cưng',      check: 'pets' },
  { key: 'points',       title: '⭐ Điểm',          check: 'points' },
  { key: 'goals',        title: '🎯 Mục tiêu',      check: 'goals' },
  { key: 'habit_streak', title: '🐇 Thói quen',     check: 'habit_streak' },
  { key: 'care',         title: '💝 Chăm sóc',      check: 'care' },
  { key: 'journal',      title: '📝 Nhật ký',       check: 'journal' },
];

async function loadAchievements() {
  try {
    const [catalog, stats] = await Promise.all([
      apiShop.badgesCatalog(),
      apiGamification.achievementStats()
    ]);

    const earnedIds = new Set(stats.totalBadges || []);
    const totalBadges = catalog.length;
    const earnedCount = earnedIds.size;

    document.getElementById('gf-badge-count').textContent = `${earnedCount}/${totalBadges}`;

    const catsWrap = document.getElementById('gf-achievement-cats');
    if (!catsWrap) return;
    catsWrap.innerHTML = '';

    for (const cat of BADGE_CATEGORIES) {
      const badges = catalog.filter(b => b.check === cat.check);
      if (badges.length === 0) continue;

      const catEarned = badges.filter(b => earnedIds.has(b.id)).length;
      const currentVal = stats[cat.check] || 0;

      const section = document.createElement('div');
      section.className = 'gf-ach-cat';
      section.innerHTML = `
        <div class="gf-ach-cat-header" data-cat="${cat.key}">
          <div class="gf-ach-cat-title">${cat.title}</div>
          <div class="gf-ach-cat-count">${catEarned}/${badges.length}</div>
          <div class="gf-ach-cat-arrow">▼</div>
        </div>
        <div class="gf-ach-cat-body" id="gf-ach-body-${cat.key}"></div>
      `;

      const body = section.querySelector('.gf-ach-cat-body');
      badges.forEach(badge => {
        const isEarned = earnedIds.has(badge.id);
        const pct = Math.min(100, (currentVal / badge.threshold) * 100);
        const card = document.createElement('div');
        card.className = 'gf-ach-card' + (isEarned ? ' earned' : '');
        card.innerHTML = `
          <div class="gf-ach-left">
            <div class="gf-ach-emoji">${isEarned ? badge.emoji : '🔒'}</div>
          </div>
          <div class="gf-ach-mid">
            <div class="gf-ach-name">${badge.name}</div>
            <div class="gf-ach-desc">${badge.desc}</div>
            ${!isEarned ? `
              <div class="gf-ach-bar-wrap">
                <div class="gf-ach-bar" style="width:${pct}%"></div>
              </div>
              <div class="gf-ach-prog">${currentVal}/${badge.threshold}</div>
            ` : '<div class="gf-ach-earned-tag">✅ Đã đạt</div>'}
          </div>
        `;
        body.appendChild(card);
      });

      // Toggle collapse
      section.querySelector('.gf-ach-cat-header').addEventListener('click', () => {
        body.classList.toggle('collapsed');
        section.querySelector('.gf-ach-cat-arrow').textContent = body.classList.contains('collapsed') ? '▶' : '▼';
      });

      catsWrap.appendChild(section);
    }
  } catch(e) { console.error('loadAchievements:', e); }
}

// ── Hook into navigateTo for shop/profile/gamification pages ──
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
  if (page === 'gamification') {
    initGamification();
  }
  if (page === 'garden') {
    initGarden();
  }
};

// ═══════════════════════════════════════════════════════════════
// 🌿 VƯỜN SINH THÁI — PHASE 1
// ═══════════════════════════════════════════════════════════════

const apiGarden = {
  load:             ()                        => API.g('/api/garden'),
  catalog:          ()                        => API.g('/api/garden/catalog'),
  buyPlot:          (row, col)                => API.p('/api/garden/plots/buy', { row, col }),
  plant:            (row, col, plantTypeId, potTypeId) =>
                                                 API.p('/api/garden/plant', { row, col, plantTypeId, potTypeId }),
  water:            (id)                      => API.p(`/api/garden/water/${id}`, {}),
  fertilize:        (id)                      => API.p(`/api/garden/fertilize/${id}`, {}),
  catchBug:         (id)                      => API.p(`/api/garden/catch-bug/${id}`, {}),
  removeLeaf:       (id)                      => API.p(`/api/garden/remove-leaf/${id}`, {}),
  harvest:          (id)                      => API.p(`/api/garden/harvest/${id}`, {}),
  uproot:           (id)                      => API.d(`/api/garden/plant/${id}`).then(r => r.json()),
  mushroomHarvest:  ()                        => API.p('/api/garden/mushroom-harvest', {}),
  loadFriendGarden: (friendId)               => API.g(`/api/garden/friend/${friendId}`),
  giftWater:        (friendId, plantId)      => API.p(`/api/garden/friend/${friendId}/water/${plantId}`, {}),
  giftRose:         (friendId)               => API.p(`/api/garden/friend/${friendId}/gift-rose`, {}),
};

// ── Garden state ──────────────────────────────────────────────
let _gardenInited     = false;
let _gardenData       = null;   // { purchasedCells, plants, gridConfig, cellPrices, gameTime, weather, ecosystem }
let _gardenCatalog    = null;   // { plants, pots }
let _gpmSelectedPlant = null;
let _gpmSelectedPot   = null;
let _gpmTargetCell    = null;   // { row, col }
let _gcpPlantId       = null;   // currently open care panel plant id
let _gardenFriendData = null;   // { friend, plants, ... } when visiting a friend's garden

// ── Garden 3D renderer state ──────────────────────────────────
let _g3dScene          = null;
let _g3dCamera         = null;
let _g3dRenderer       = null;
let _g3dControls       = null;
let _g3dCells          = new Map();   // "row,col" → THREE.Group
let _g3dGrassInstances = null;
let _g3dHoveredCell    = null;
let _g3dCellMeshes     = [];
let _g3dMouseNDC       = { x: 0, y: 0 };

const G3D_ROWS      = 6;
const G3D_COLS      = 5;
const G3D_CELL_SIZE = 1.0;

// ── Stage display info ────────────────────────────────────────
const STAGE_INFO = {
  seed:      { label:'Hạt giống',    emoji:'🌰', color:'#a0844c' },
  sprout:    { label:'Nảy mầm',      emoji:'🌱', color:'#5ef0a0' },
  leafing:   { label:'Ra lá',        emoji:'🌿', color:'#4caf50' },
  growing:   { label:'Đang lớn',     emoji:'🪴', color:'#66bb6a' },
  flowering: { label:'Ra hoa',       emoji:'🌸', color:'#ff85c8' },
  fruiting:  { label:'Kết trái',     emoji:'🍎', color:'#ff6b5b' },
  dormant:   { label:'Nghỉ đông',    emoji:'🍂', color:'#c8954a' },
};

const CAT_INFO = {
  vegetable: { label:'Rau',        emoji:'🥬', color:'#5ef0a0' },
  fruit:     { label:'Ăn quả',     emoji:'🍎', color:'#ff9900' },
  flower:    { label:'Hoa',        emoji:'🌸', color:'#ff85c8' },
  fengshui:  { label:'Phong thủy', emoji:'🎍', color:'#b07fff' },
};

// ── Init ──────────────────────────────────────────────────────
async function initGarden() {
  if (_gardenInited) { _refreshGardenUI(); return; }
  _gardenInited = true;

  // Load catalog + garden in parallel
  try {
    [_gardenCatalog, _gardenData] = await Promise.all([
      apiGarden.catalog(),
      apiGarden.load(),
    ]);
  } catch(e) {
    console.error('initGarden:', e);
    return;
  }

  _setupGardenViewTabs();
  _setupGardenShopTabs();
  _setupGardenShopFilter();
  _setupPlantModalFilter();
  _setupCarePanelInteractions();
  _setupGardenToolbar();
  _setupGardenFriendsView();

  _refreshGardenUI();

  // Show migration notice if refund happened
  if (_gardenData.migrationRefund) {
    const notice = document.getElementById('garden-migration-notice');
    const ptsEl  = document.getElementById('gmn-pts');
    if (notice && ptsEl) {
      ptsEl.textContent = _gardenData.migrationRefund + ' điểm';
      notice.style.display = 'flex';
    }
    document.getElementById('gmn-close')?.addEventListener('click', () => {
      document.getElementById('garden-migration-notice').style.display = 'none';
    });
  }
}

function _refreshGardenUI() {
  if (!_gardenData) return;
  _updateGardenTimeLabel();
  _updateGardenPoints();
  _renderWeatherBanner(_gardenData.weatherInfo, _gardenData.weather, 'garden-weather-banner');
  _applyWeatherToPage(_gardenData.weather);
  _renderEcosystemPanel(_gardenData.ecosystem, 'garden-eco-panel');
  _initGarden3D();
  _build3DCells(_gardenData.purchasedCells, _gardenData.plants, _gardenData.shadedCells);
  _renderGardenShop();
}

// ── Three.js 3D garden renderer ───────────────────────────────
function _initGarden3D() {
  const wrap = document.getElementById('garden-3d-wrap');
  if (!wrap) return;

  if (_g3dScene) {
    // Re-attach renderer canvas if user navigated away and back
    if (!wrap.contains(_g3dRenderer.domElement)) {
      wrap.innerHTML = '';
      wrap.appendChild(_g3dRenderer.domElement);
      const W = wrap.clientWidth || 600;
      const H = wrap.clientHeight || 600;
      _g3dRenderer.setSize(W, H);
      _g3dCamera.aspect = W / H;
      _g3dCamera.updateProjectionMatrix();
    }
    return;
  }

  wrap.innerHTML = '';

  const W = wrap.clientWidth  || 600;
  const H = wrap.clientHeight || 600;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1c0e);
  _g3dScene = scene;

  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
  camera.position.set(10, 12, 10);
  camera.lookAt(0, 0, 0);
  _g3dCamera = camera;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  wrap.appendChild(renderer.domElement);
  _g3dRenderer = renderer;

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enableZoom   = true;
  controls.enablePan    = true;
  controls.update();
  _g3dControls = controls;

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  renderer.domElement.addEventListener('mousemove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    _g3dMouseNDC.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    _g3dMouseNDC.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  });

  _buildGarden3DEnvironment();

  const raycaster = new THREE.Raycaster();
  function animate() {
    requestAnimationFrame(animate);
    controls.update();

    if (_g3dCellMeshes.length > 0) {
      raycaster.setFromCamera(_g3dMouseNDC, camera);
      const hits   = raycaster.intersectObjects(_g3dCellMeshes);
      const hitKey = hits.length > 0 ? hits[0].object.userData.cellKey : null;

      if (hitKey !== _g3dHoveredCell) {
        if (_g3dHoveredCell) {
          const old = _g3dCells.get(_g3dHoveredCell);
          if (old && old.userData.baseMesh) old.userData.baseMesh.material.emissive.setHex(0x000000);
        }
        _g3dHoveredCell = hitKey;
        if (hitKey) {
          const cur = _g3dCells.get(hitKey);
          if (cur && cur.userData.baseMesh) cur.userData.baseMesh.material.emissive.setHex(0x5ef0a0);
        }
      }
    }

    renderer.render(scene, camera);
  }
  animate();
}

function _buildGarden3DEnvironment() {
  const scene = _g3dScene;
  const ROWS  = G3D_ROWS;
  const COLS  = G3D_COLS;
  const CS    = G3D_CELL_SIZE;
  const W     = COLS * CS;   // 5.0
  const D     = ROWS * CS;   // 6.0
  const PAD   = 0.5;

  // Grass floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W + PAD * 2, D + PAD * 2),
    new THREE.MeshLambertMaterial({ color: 0x2d5a1e })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Horizontal wood paths between rows (5 paths)
  const matH = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  for (let i = 0; i < ROWS - 1; i++) {
    const z    = (i + 1 - ROWS / 2) * CS;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(W + PAD, 0.02, 0.12), matH);
    mesh.position.set(0, 0.01, z);
    scene.add(mesh);
  }

  // Vertical wood paths between cols (4 paths)
  const matV = new THREE.MeshLambertMaterial({ color: 0x7a5030 });
  for (let j = 0; j < COLS - 1; j++) {
    const x    = (j + 1 - COLS / 2) * CS;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, D + PAD), matV);
    mesh.position.set(x, 0.01, 0);
    scene.add(mesh);
  }

  // Garden border (4 sides)
  const matB  = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const BT    = 0.15;
  const BY    = 0.05;
  const halfW = W / 2 + PAD;
  const halfD = D / 2 + PAD;

  [halfD, -halfD].forEach(z => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(W + PAD * 2 + BT * 2, BY, BT), matB);
    mesh.position.set(0, BY / 2, z);
    scene.add(mesh);
  });
  [-halfW, halfW].forEach(x => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(BT, BY, D + PAD * 2), matB);
    mesh.position.set(x, BY / 2, 0);
    scene.add(mesh);
  });
}

function _disposeG3DCells() {
  _g3dCells.forEach(grp => {
    grp.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
    });
    if (_g3dScene) _g3dScene.remove(grp);
  });
  _g3dCells.clear();
  _g3dCellMeshes  = [];
  _g3dHoveredCell = null;

  if (_g3dGrassInstances) {
    _g3dGrassInstances.geometry.dispose();
    _g3dGrassInstances.material.dispose();
    if (_g3dScene) _g3dScene.remove(_g3dGrassInstances);
    _g3dGrassInstances = null;
  }
}

// ── Session C: Container helpers ────────────────────────────────────────────

function _getSoilMaterial(state) {
  const colors = { dry: 0xc8a06e, normal: 0x8b5e3c, moist: 0x5c3d1e, wet: 0x3d2710 };
  const col = colors[state] || colors.normal;
  if (state === 'wet') {
    return new THREE.MeshLambertMaterial({ color: col, emissive: new THREE.Color(0x1a0f08), emissiveIntensity: 0.1 });
  }
  return new THREE.MeshLambertMaterial({ color: col });
}

function _addSoilCracks(grp, y, radius) {
  const mat = new THREE.LineBasicMaterial({ color: 0x9a7550 });
  const n = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const a   = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const len = 0.04 + Math.random() * 0.05;
    const cx  = (Math.random() - 0.5) * radius * 1.1;
    const cz  = (Math.random() - 0.5) * radius * 1.1;
    const pts = [
      new THREE.Vector3(cx, y, cz),
      new THREE.Vector3(cx + Math.cos(a) * len, y, cz + Math.sin(a) * len)
    ];
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
}

function _make3DContainer(containerType, soilState) {
  const grp     = new THREE.Group();
  const soilMat = _getSoilMaterial(soilState);

  if (containerType === 'pot_s') {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xc4622d });
    const body    = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.11, 0.20, 12), bodyMat);
    body.position.y = 0.10;
    grp.add(body);
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xb5572a });
    const rim    = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 6, 12), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.20;
    grp.add(rim);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.02, 12), soilMat);
    soil.position.y = 0.20;
    grp.add(soil);
    if (soilState === 'dry') _addSoilCracks(grp, 0.21, 0.14);

  } else if (containerType === 'pot_m') {
    const pts = [
      new THREE.Vector2(0.10, 0),
      new THREE.Vector2(0.22, 0.10),
      new THREE.Vector2(0.24, 0.18),
      new THREE.Vector2(0.20, 0.26),
      new THREE.Vector2(0.16, 0.28)
    ];
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x7ab5c8, shininess: 40 });
    const body    = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), bodyMat);
    grp.add(body);
    const rimMat = new THREE.MeshPhongMaterial({ color: 0x5a9ab5 });
    const rim    = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.015, 8, 16), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.28;
    grp.add(rim);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.148, 0.02, 16), soilMat);
    soil.position.y = 0.28;
    grp.add(soil);
    if (soilState === 'dry') _addSoilCracks(grp, 0.29, 0.13);

  } else if (containerType === 'pot_l') {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    const body    = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.55), bodyMat);
    body.position.y = 0.14;
    grp.add(body);
    const grainMat = new THREE.MeshLambertMaterial({ color: 0x5a3818 });
    [-0.08, 0.0, 0.08].forEach(yOff => {
      [0.28, -0.28].forEach(zOff => {
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.01), grainMat);
        g.position.set(0, 0.14 + yOff, zOff);
        grp.add(g);
      });
    });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.02, 0.50), soilMat);
    soil.position.y = 0.28;
    grp.add(soil);
    if (soilState === 'dry') _addSoilCracks(grp, 0.29, 0.22);

  } else if (containerType === 'pot_xl') {
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xf0ece0, shininess: 80 });
    const body    = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.38, 16), bodyMat);
    body.position.y = 0.19;
    grp.add(body);
    const bandMat = new THREE.MeshPhongMaterial({ color: 0x1a5fa8 });
    [0.13, 0.25].forEach(y => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16), bandMat);
      band.position.y = y;
      grp.add(band);
    });
    const rimMat = new THREE.MeshPhongMaterial({ color: 0xe0dcd0 });
    const rim    = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 8, 16), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.38;
    grp.add(rim);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.02, 16), soilMat);
    soil.position.y = 0.38;
    grp.add(soil);
    if (soilState === 'dry') _addSoilCracks(grp, 0.39, 0.21);

  } else if (containerType === 'bed_s') {
    const woodMat   = new THREE.MeshLambertMaterial({ color: 0x7a5030 });
    const cornerMat = new THREE.MeshLambertMaterial({ color: 0x5a3820 });
    const fW = 0.80, fH = 0.12, fT = 0.06;
    [
      [0,            fH/2, -(fW/2-fT/2), fW, fH, fT],
      [0,            fH/2,  (fW/2-fT/2), fW, fH, fT],
      [-(fW/2-fT/2), fH/2,  0,           fT, fH, fW],
      [ (fW/2-fT/2), fH/2,  0,           fT, fH, fW],
    ].forEach(([x, y, z, w, h, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
      m.position.set(x, y, z);
      grp.add(m);
    });
    [[-0.37, fH/2, -0.37], [0.37, fH/2, -0.37], [-0.37, fH/2, 0.37], [0.37, fH/2, 0.37]].forEach(([x, y, z]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, fH + 0.04, 0.06), cornerMat);
      post.position.set(x, y, z);
      grp.add(post);
    });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.76), soilMat);
    soil.position.y = fH;
    grp.add(soil);
    if (soilState === 'dry') _addSoilCracks(grp, fH + 0.03, 0.35);

  } else if (containerType === 'bed_m') {
    const woodMat  = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    const brickMat = new THREE.MeshLambertMaterial({ color: 0x9a7520 });
    const fW = 0.80, fH = 0.22, fT = 0.07;
    [
      [0,            fH/2, -(fW/2-fT/2), fW, fH, fT],
      [0,            fH/2,  (fW/2-fT/2), fW, fH, fT],
      [-(fW/2-fT/2), fH/2,  0,           fT, fH, fW],
      [ (fW/2-fT/2), fH/2,  0,           fT, fH, fW],
    ].forEach(([x, y, z, w, h, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
      m.position.set(x, y, z);
      grp.add(m);
    });
    [-0.06, 0.06].forEach(yOff => {
      [-(fW/2-fT/2), (fW/2-fT/2)].forEach(z => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(fW + 0.01, 0.03, fT + 0.01), brickMat);
        strip.position.set(0, fH/2 + yOff, z);
        grp.add(strip);
      });
    });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.72), soilMat);
    soil.position.y = fH;
    grp.add(soil);
    if (soilState === 'dry') _addSoilCracks(grp, fH + 0.04, 0.34);

  } else {
    // hole_l
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x2d5a1e });
    const ground    = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    grp.add(ground);
    const holeMat = new THREE.MeshLambertMaterial({ color: 0x3d2710, side: THREE.BackSide });
    const hole    = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.25, 0.25, 16, 1, true), holeMat);
    hole.position.y = -0.10;
    grp.add(hole);
    const rimMat = new THREE.MeshLambertMaterial({ color: 0x4a3215 });
    const rim    = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.03, 6, 16), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.01;
    grp.add(rim);
    const moundMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });
    const mound    = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), moundMat);
    mound.scale.y = 0.5;
    mound.position.set(0.38, 0.09, 0.10);
    grp.add(mound);
    [[0.30, 0.05, 0.28], [0.44, 0.04, -0.05], [0.22, 0.04, 0.38]].forEach(([x, y, z]) => {
      const clump = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), moundMat);
      clump.scale.y = 0.5;
      clump.position.set(x, y, z);
      grp.add(clump);
    });
  }

  return grp;
}

function _getContainerType(plantTypeId, potTypeId) {
  const pt = _gardenCatalog?.plants?.find(p => p.id === plantTypeId);
  if (!pt) return 'bed_s';
  if (pt.category === 'fengshui' || pt.category === 'flower') return potTypeId || 'pot_m';
  if (pt.size === 'large')  return 'hole_l';
  if (pt.size === 'medium') return 'bed_m';
  return 'bed_s';
}

function _getSoilStateFromWater(waterLevel) {
  if (waterLevel <= 20) return 'dry';
  if (waterLevel <= 50) return 'normal';
  if (waterLevel <= 80) return 'moist';
  return 'wet';
}

function _build3DCells(purchasedCells, plants, shadedCells) {
  if (!_g3dScene) return;
  _disposeG3DCells();

  const ROWS = G3D_ROWS;
  const COLS = G3D_COLS;
  const CS   = G3D_CELL_SIZE;

  const purchasedSet = new Set((purchasedCells || []).map(c => `${c.row},${c.col}`));
  const plantMap     = new Map((plants || []).map(p => [`${p.row},${p.col}`, p]));

  // Grass blades via InstancedMesh (all blades = 1 draw call)
  const grassBladeGeo = new THREE.BoxGeometry(0.02, 0.12, 0.02);
  const grassBladeMat = new THREE.MeshLambertMaterial({ color: 0x3a7a25 });
  const MAX_GRASS     = ROWS * COLS * 12;
  const grassMesh     = new THREE.InstancedMesh(grassBladeGeo, grassBladeMat, MAX_GRASS);
  grassMesh.count     = 0;
  _g3dScene.add(grassMesh);
  _g3dGrassInstances = grassMesh;

  const dummy    = new THREE.Object3D();
  let   grassIdx = 0;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const key = `${row},${col}`;
      const cx  = (col - COLS / 2 + 0.5) * CS;
      const cz  = (row - ROWS / 2 + 0.5) * CS;
      const grp = new THREE.Group();
      grp.position.set(cx, 0, cz);

      const isPurchased = purchasedSet.has(key);
      const plant       = plantMap.get(key);

      let state, baseColor, borderColor;
      if (!isPurchased) {
        state = 'locked';   baseColor = 0x141b14; borderColor = 0x223022;
      } else if (!plant) {
        state = 'empty';    baseColor = 0x1d3019; borderColor = 0x5ef0a0;
      } else {
        state = 'planted';  baseColor = 0x1c3020; borderColor = 0x3a6a3a;
      }

      // Base tile
      const baseMat  = new THREE.MeshLambertMaterial({ color: baseColor });
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.85), baseMat);
      baseMesh.position.y       = 0.03;
      baseMesh.userData.cellKey = key;
      baseMesh.receiveShadow    = true;
      grp.add(baseMesh);
      _g3dCellMeshes.push(baseMesh);
      grp.userData = { row, col, state, baseMesh };

      // Edge strips shared geometry helper
      const addEdges = (color, transparent, opacity) => {
        const mat = new THREE.MeshLambertMaterial({ color, transparent, opacity: opacity || 1 });
        [
          [0,      0.03,  0.415, 0.82, 0.04, 0.02],
          [0,      0.03, -0.415, 0.82, 0.04, 0.02],
          [ 0.415, 0.03,  0,     0.02, 0.04, 0.82],
          [-0.415, 0.03,  0,     0.02, 0.04, 0.82],
        ].forEach(([ex, ey, ez, ew, eh, ed]) => {
          const em = new THREE.Mesh(new THREE.BoxGeometry(ew, eh, ed), mat);
          em.position.set(ex, ey, ez);
          grp.add(em);
        });
      };

      if (state === 'locked') {
        baseMat.transparent = true;
        baseMat.opacity     = 0.6;
        _addCellBillboard(grp, '🔒', 0.25, 0.20);
      } else if (state === 'empty') {
        addEdges(borderColor, true, 0.4);
        _addCellBillboard(grp, '+', 0.20, 0.18);
      } else {
        addEdges(borderColor, false, 1);
        const containerType = _getContainerType(plant.plantTypeId, plant.potTypeId);
        const soilState     = _getSoilStateFromWater(plant.waterLevel ?? 50);
        const container     = _make3DContainer(containerType, soilState);
        container.position.y = 0.03;
        if (!plant.isAlive) {
          container.traverse(child => {
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
              child.material.color.multiplyScalar(0.4);
            }
          });
        }
        grp.add(container);
      }

      _g3dScene.add(grp);
      _g3dCells.set(key, grp);

      // Grass blades around purchased cells
      if (isPurchased) {
        const bladeCount = 8 + Math.floor(Math.random() * 5);
        for (let b = 0; b < bladeCount && grassIdx < MAX_GRASS; b++) {
          const angle  = Math.random() * Math.PI * 2;
          const radius = 0.40 + Math.random() * 0.08;
          const h      = 0.08 + Math.random() * 0.07;
          dummy.position.set(cx + Math.cos(angle) * radius, h / 2, cz + Math.sin(angle) * radius);
          dummy.rotation.set((Math.random() - 0.5) * 0.52, Math.random() * Math.PI * 2, 0);
          dummy.scale.set(1, h / 0.12, 1);
          dummy.updateMatrix();
          grassMesh.setMatrixAt(grassIdx++, dummy.matrix);
        }
      }
    }
  }

  grassMesh.count = grassIdx;
  grassMesh.instanceMatrix.needsUpdate = true;
}

function _addCellBillboard(group, text, size, yAboveBase) {
  const canvas  = document.createElement('canvas');
  canvas.width  = 64;
  canvas.height = 64;
  const ctx     = canvas.getContext('2d');
  ctx.font      = '42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 32, 32);

  const tex  = new THREE.CanvasTexture(canvas);
  const mat  = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.position.y = 0.06 + yAboveBase;
  mesh.rotation.x = -Math.PI / 2;
  group.add(mesh);
}

function _updateGardenTimeLabel() {
  const t  = _gardenData.gameTime || {};
  const el = document.getElementById('garden-time-badge');
  if (el) el.textContent = `${t.icon || '☀️'} ${t.label || ''}`;
}

function _updateGardenPoints() {
  // Re-use the header points value
  const hdr = document.getElementById('header-points-val');
  const el  = document.getElementById('garden-pts-val');
  if (el && hdr) el.textContent = hdr.textContent + ' điểm';
}

// ── Buy cell ──────────────────────────────────────────────────
async function _buyCell(row, col, price) {
  if (!confirm(`Mua ô đất này với giá ${price} điểm?`)) return;
  try {
    const r = await apiGarden.buyPlot(row, col);
    if (!r.success) { toast('❌ ' + (r.error || 'Lỗi')); return; }
    toast(`✅ Đã mua ô đất! Còn ${r.points} điểm`);
    updatePointsUI(r.points);
    // Refresh garden data
    _gardenData = await apiGarden.load();
    _refreshGardenUI();
    quickNotifCheck();
  } catch(e) { toast('❌ ' + e.message); }
}

// ── Plant modal ───────────────────────────────────────────────
function _openPlantModal(row, col) {
  _gpmTargetCell    = { row, col };
  _gpmSelectedPlant = null;
  _gpmSelectedPot   = null;
  _updateGpmCost();

  document.getElementById('gpm-cell-pos').textContent = `${row + 1}×${col + 1}`;
  _renderGpmPlants('all');
  _renderGpmPots();

  document.getElementById('gpm-backdrop').style.display = '';
  document.getElementById('gpm-modal').style.display = '';
}

function _closeGpmModal() {
  document.getElementById('gpm-backdrop').style.display = 'none';
  document.getElementById('gpm-modal').style.display = 'none';
}

function _renderGpmPlants(cat) {
  const list = document.getElementById('gpm-plant-list');
  if (!list || !_gardenCatalog) return;
  const plants = cat === 'all'
    ? _gardenCatalog.plants
    : _gardenCatalog.plants.filter(p => p.category === cat);
  // Sort: in-stock first
  const sorted = [...plants].sort((a, b) => {
    const ao = _shopData.gardenSeeds[a.id] || 0;
    const bo = _shopData.gardenSeeds[b.id] || 0;
    return bo - ao;
  });

  list.innerHTML = sorted.map(p => {
    const ci = CAT_INFO[p.category] || {};
    const owned = _shopData.gardenSeeds[p.id] || 0;
    const sel = _gpmSelectedPlant?.id === p.id ? 'gpm-item-selected' : '';
    const noStock = owned < 1 ? 'gpm-item-disabled' : '';
    const invLabel = owned > 0 ? `Có: ${owned}` : 'Hết';
    // Show plant at leafing stage as preview (more recognisable than seed/sprout)
    const previewStage = 'leafing';
    const arch = PLANT_ARCHETYPE[p.id] || 'ground-leafy';
    const previewHTML = _buildPlantBodyHTML(p.id, previewStage);
    return `<div class="gpm-plant-item ${sel} ${noStock}" data-pid="${p.id}">
      <div class="gpm-item-plant-preview">
        <div class="gc-plant-body stage-${previewStage} plant-${arch} plant-${p.id}">${previewHTML}</div>
      </div>
      <div class="gpm-item-name">${esc(p.name)}</div>
      <div class="gpm-item-sub">${ci.emoji||''} ${ci.label||''}</div>
      <div class="gpm-item-inv ${owned > 0 ? 'inv-ok' : 'inv-empty'}">${invLabel}</div>
    </div>`;
  }).join('');

  list.querySelectorAll('.gpm-plant-item:not(.gpm-item-disabled)').forEach(el => {
    el.addEventListener('click', () => {
      _gpmSelectedPlant = _gardenCatalog.plants.find(p => p.id === el.dataset.pid);
      list.querySelectorAll('.gpm-plant-item').forEach(e => e.classList.remove('gpm-item-selected'));
      el.classList.add('gpm-item-selected');
      _updateGpmCost();
    });
  });
}

function _renderGpmPots() {
  const list = document.getElementById('gpm-pot-list');
  if (!list || !_gardenCatalog) return;

  // Sort: in-stock first
  const sorted = [..._gardenCatalog.pots].sort((a, b) => {
    const ao = _shopData.gardenPots[a.id] || 0;
    const bo = _shopData.gardenPots[b.id] || 0;
    return bo - ao;
  });

  list.innerHTML = sorted.map(p => {
    const owned = _shopData.gardenPots[p.id] || 0;
    const sel = _gpmSelectedPot?.id === p.id ? 'gpm-item-selected' : '';
    const noStock = owned < 1 ? 'gpm-item-disabled' : '';
    const invLabel = owned > 0 ? `Có: ${owned}` : 'Hết';
    return `<div class="gpm-pot-item ${sel} ${noStock}" data-potid="${p.id}">
      <div class="gpm-item-emoji">${p.emoji}</div>
      <div class="gpm-item-info">
        <div class="gpm-item-name">${esc(p.name)}</div>
        <div class="gpm-item-sub">${esc(p.desc)}</div>
      </div>
      <div class="gpm-item-inv ${owned > 0 ? 'inv-ok' : 'inv-empty'}">${invLabel}</div>
    </div>`;
  }).join('');

  list.querySelectorAll('.gpm-pot-item:not(.gpm-item-disabled)').forEach(el => {
    el.addEventListener('click', () => {
      _gpmSelectedPot = _gardenCatalog.pots.find(p => p.id === el.dataset.potid);
      list.querySelectorAll('.gpm-pot-item').forEach(e => e.classList.remove('gpm-item-selected'));
      el.classList.add('gpm-item-selected');
      _updateGpmCost();
    });
  });
}

function _updateGpmCost() {
  const statusEl  = document.getElementById('gpm-cost-val');
  const confirmBtn = document.getElementById('gpm-confirm');
  const seedOk = _gpmSelectedPlant && (_shopData.gardenSeeds[_gpmSelectedPlant.id] || 0) > 0;
  const potOk  = _gpmSelectedPot   && (_shopData.gardenPots[_gpmSelectedPot.id]   || 0) > 0;

  if (statusEl) {
    if (!_gpmSelectedPlant && !_gpmSelectedPot) {
      statusEl.textContent = '← Chọn cây & chậu để trồng';
    } else if (_gpmSelectedPlant && !_gpmSelectedPot) {
      statusEl.textContent = `${_gpmSelectedPlant.name} · chọn chậu →`;
    } else if (!_gpmSelectedPlant && _gpmSelectedPot) {
      statusEl.textContent = `${_gpmSelectedPot.name} · chọn cây ←`;
    } else {
      statusEl.textContent = seedOk && potOk
        ? `✅ ${_gpmSelectedPlant.name} + ${_gpmSelectedPot.name}`
        : '❌ Hết hàng — mua thêm trong Cửa hàng';
    }
  }
  if (confirmBtn) confirmBtn.disabled = !(_gpmSelectedPlant && _gpmSelectedPot && seedOk && potOk);
}

function _setupPlantModalFilter() {
  const modal = document.getElementById('gpm-modal');
  modal?.querySelectorAll('.gpf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.gpf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _renderGpmPlants(btn.dataset.cat);
    });
  });

  document.getElementById('gpm-close')?.addEventListener('click', _closeGpmModal);
  document.getElementById('gpm-backdrop')?.addEventListener('click', _closeGpmModal);

  document.getElementById('gpm-confirm')?.addEventListener('click', async () => {
    if (!_gpmSelectedPlant || !_gpmSelectedPot || !_gpmTargetCell) return;
    const btn = document.getElementById('gpm-confirm');
    btn.disabled = true; btn.textContent = '⏳';
    try {
      const r = await apiGarden.plant(
        _gpmTargetCell.row, _gpmTargetCell.col,
        _gpmSelectedPlant.id, _gpmSelectedPot.id
      );
      if (!r.success) { toast('❌ ' + (r.error || 'Lỗi')); btn.disabled = false; btn.textContent = '🌱 Trồng ngay!'; return; }
      toast(`🌱 Đã trồng ${_gpmSelectedPlant.name}!`);
      if (r.gardenSeeds) _shopData.gardenSeeds = r.gardenSeeds;
      if (r.gardenPots)  _shopData.gardenPots  = r.gardenPots;
      _closeGpmModal();
      _gardenData = await apiGarden.load();
      _refreshGardenUI();
      quickNotifCheck();
    } catch(e) { toast('❌ ' + e.message); }
    btn.disabled = false; btn.textContent = '🌱 Trồng ngay!';
  });
}

// ── Care panel ────────────────────────────────────────────────
function _openCarePanel(plant) {
  _gcpPlantId = plant._id;
  _renderCarePanel(plant);
  document.getElementById('garden-care-backdrop').style.display = '';
  const panel = document.getElementById('garden-care-panel');
  panel.style.display = '';
  requestAnimationFrame(() => panel.classList.add('gcp-open'));
}

function _closeCarePanel() {
  const panel = document.getElementById('garden-care-panel');
  panel.classList.remove('gcp-open');
  setTimeout(() => {
    panel.style.display = 'none';
    document.getElementById('garden-care-backdrop').style.display = 'none';
  }, 300);
}

function _renderCarePanel(plant) {
  const pt  = plant.plantType  || {};
  const pot = plant.potType    || {};
  const si  = STAGE_INFO[plant.stage] || STAGE_INFO.seed;

  // ── CSS Plant hero (replaces emoji) ──────────────────────────
  const heroPlant = document.getElementById('gcp-hero-plant');
  if (heroPlant) {
    const potCls  = _potClass(plant.potTypeId || '');
    const soilCls = _soilClass(plant.waterLevel ?? 50);
    const plantBodyHTML = _buildPlantBodyHTML(plant.plantTypeId || '', plant.stage);

    // Health/nutrient visual filters
    const hp = plant.health || 0, nl = plant.nutrientLevel || 0;
    let stateClass = '';
    if (!plant.isAlive) stateClass = 'health-dead';
    else if (hp < 30)   stateClass = 'health-low';
    else if (hp < 60)   stateClass = 'health-medium';
    if (nl < 20)        stateClass += ' nutr-very-low';
    else if (nl < 40)   stateClass += ' nutr-low';

    heroPlant.innerHTML = `
      <div class="gcp-plant-scene">
        <div class="${potCls}">
          <div class="gc-soil ${soilCls}"></div>
          <div class="gc-plant-body ${stateClass}">${plantBodyHTML}</div>
        </div>
      </div>`;
  }

  // ── Name / species / stage ────────────────────────────────────
  const nameEl    = document.getElementById('gcp-name');
  const speciesEl = document.getElementById('gcp-species');
  const stageEl   = document.getElementById('gcp-stage');
  const glowEl    = document.getElementById('gcp-hero-glow');
  if (nameEl)    nameEl.textContent    = pt.name || '—';
  if (speciesEl) {
    const arch = PLANT_ARCHETYPE[plant.plantTypeId || ''] || '';
    const CAT_LABELS = {
      'ground-leafy':'Rau lá', 'hanh_la':'Rau gia vị',
      'bush-veg':'Rau quả leo', 'ca_rot':'Củ cải',
      'dau_tay':'Quả thấp', 'med-tree':'Cây ăn quả',
      'large-tree':'Cây lớn', 'small-flower':'Hoa nhỏ',
      'large-flower':'Hoa lớn', 'fengshui':'Cây phong thủy'
    };
    speciesEl.textContent = CAT_LABELS[arch] || pt.category || '';
  }
  if (stageEl) {
    stageEl.textContent = si.label;
    stageEl.style.background = si.color + '2a';
    stageEl.style.color = si.color;
    stageEl.style.border = `1px solid ${si.color}44`;
  }
  if (glowEl) glowEl.style.background =
    `radial-gradient(ellipse 100% 100% at 30% 0%, ${si.color}22 0%, transparent 70%)`;

  // Status badges
  const statusRow = document.getElementById('gcp-status-row');
  if (statusRow) {
    const badges = [];
    if (!plant.isAlive)          badges.push('<span class="gcp-badge gcp-badge-dead">💀 Đã chết</span>');
    if (plant.readyToHarvest)    badges.push('<span class="gcp-badge gcp-badge-harvest">🌾 Sẵn thu hoạch!</span>');
    if (plant.bugs > 0)          badges.push(`<span class="gcp-badge gcp-badge-bug">🐛 ${plant.bugs} con sâu</span>`);
    if (plant.deadLeaves > 0)    badges.push(`<span class="gcp-badge gcp-badge-leaf">🍂 ${plant.deadLeaves} lá hư</span>`);
    if (plant.health < 30 && plant.isAlive) badges.push('<span class="gcp-badge gcp-badge-warn">⚠️ Cần chăm sóc gấp!</span>');
    if (plant.cycleCount > 0)    badges.push(`<span class="gcp-badge gcp-badge-cycle">🔄 Chu kỳ ${plant.cycleCount}</span>`);
    statusRow.innerHTML = badges.join('');
  }

  // Stage progress
  const stageProg  = document.getElementById('gcp-stage-progress');
  const stageEta   = document.getElementById('gcp-stage-eta');
  if (stageProg && pt.stages) {
    const durGD     = pt.stages[plant.stage] || 1; // game days for this stage
    const durHours  = durGD * 12;                   // real hours
    const elapsed   = plant.stageStartedAt
      ? (Date.now() - new Date(plant.stageStartedAt).getTime()) / 3600000
      : 0;
    const pct       = Math.min(100, Math.round((elapsed / durHours) * 100));
    const hoursLeft = Math.max(0, durHours - elapsed);
    const dLeft     = Math.floor(hoursLeft / 24);
    const hLeft     = Math.round(hoursLeft % 24);
    stageProg.style.width = pct + '%';
    if (stageEta) stageEta.textContent = pct >= 100
      ? 'Sẵn sàng chuyển giai đoạn!'
      : (dLeft > 0 ? `${dLeft}n ` : '') + `${hLeft}h nữa`;
  }

  // Harvest button + uproot hint
  const alive = plant.isAlive;
  const harvestBtn = document.getElementById('gcp-btn-harvest');
  if (harvestBtn) harvestBtn.style.display = (plant.readyToHarvest && alive) ? '' : 'none';

  const uprootHint = document.getElementById('gcp-uproot-hint');
  if (uprootHint) uprootHint.style.display = alive ? '' : 'none';

  // Pot info
  const potRow = document.getElementById('gcp-pot-row');
  if (potRow && pot.name) {
    const matchWarn = _potMatchWarning(pt.size, pot.size);
    potRow.innerHTML = `<span class="gcp-pot-icon">${pot.emoji || '🪴'}</span>
      <span class="gcp-pot-name">${esc(pot.name)}</span>
      ${matchWarn ? `<span class="gcp-pot-warn">${matchWarn}</span>` : '<span class="gcp-pot-ok">✅ Kích thước phù hợp</span>'}`;
  }
}


// ── Care action helper (used by toolbar drag + harvest btn) ───
async function _cpCareAction(apiFn, successMsg, plantId) {
  const pid = plantId || _gcpPlantId;
  if (!pid) return;
  try {
    const r = await apiFn(pid);
    if (r.error) { toast('❌ ' + r.error); return; }
    toast(successMsg);
    if (r.points !== undefined) updatePointsUI(r.points);
    _gardenData = await apiGarden.load();
    _refreshGardenUI();
    // If care panel is open for this plant, refresh it
    if (_gcpPlantId === pid) {
      const updated = (_gardenData.plants || []).find(p => p._id === pid);
      if (updated) _renderCarePanel(updated);
      else _closeCarePanel();
    }
    quickNotifCheck();
  } catch(err) { toast('❌ ' + err.message); }
}

// ── Care panel: info-only, harvest + uproot buttons ───────────
function _setupCarePanelInteractions() {
  document.getElementById('gcp-close')?.addEventListener('click', _closeCarePanel);
  document.getElementById('garden-care-backdrop')?.addEventListener('click', _closeCarePanel);

  document.getElementById('gcp-btn-harvest')?.addEventListener('click',
    () => _cpCareAction(apiGarden.harvest, '🌾 Thu hoạch thành công!'));

  document.getElementById('gcp-uproot-link')?.addEventListener('click', async () => {
    if (!_gcpPlantId) return;
    const plant = (_gardenData?.plants || []).find(p => p._id === _gcpPlantId);
    const name  = plant?.plantType?.name || 'cây này';
    if (!confirm(`Nhổ bỏ ${name}? Bạn sẽ được hoàn lại một phần điểm.`)) return;
    try {
      const r = await apiGarden.uproot(_gcpPlantId);
      if (r.error) { toast('❌ ' + r.error); return; }
      toast(`🗑️ Đã nhổ cây. Hoàn lại ${r.refund || 0} điểm.`);
      if (r.points !== undefined) updatePointsUI(r.points);
      _closeCarePanel();
      _gardenData = await apiGarden.load();
      _refreshGardenUI();
      quickNotifCheck();
    } catch(err) { toast('❌ ' + err.message); }
  });
}

// ── Garden toolbar drag system ────────────────────────────────
function _setupGardenToolbar() {
  const toolbar = document.getElementById('garden-toolbar');
  if (!toolbar) return;

  let _ghost    = null;
  let _dragEl   = null;
  let _dragTool = null;   // 'water' | 'fert' | 'bug' | 'leaf'
  let _offX = 0, _offY = 0;

  // Build ghost element that follows cursor
  function _mkGhost(el) {
    const r = el.getBoundingClientRect();
    const g = el.cloneNode(true);
    g.style.cssText =
      `position:fixed;left:${r.left}px;top:${r.top}px;`
      + `width:${r.width}px;height:${r.height}px;`
      + `pointer-events:none;z-index:9999;`
      + `opacity:.92;transform:scale(1.25);transform-origin:center;`
      + `transition:none;border-radius:14px;`;
    document.body.appendChild(g);
    return g;
  }

  // Find which planted/dead cell is under pointer (uses elementsFromPoint for 3D grid)
  function _cellAt(x, y) {
    const els = document.elementsFromPoint(x, y);
    return els.find(el =>
      el.classList.contains('gc-planted') || el.classList.contains('gc-dead')) || null;
  }

  // Highlight all valid target cells while dragging
  function _highlightCells(tool) {
    document.querySelectorAll('#garden-grid .garden-cell').forEach(cell => {
      const isPlanted = cell.classList.contains('gc-planted');
      const isDead    = cell.classList.contains('gc-dead');
      // water/fert → only living plants
      // bug/leaf   → only living plants with bugs/leaves (we highlight all planted, disable at drop if 0)
      if ((tool === 'water' || tool === 'fert' || tool === 'bug' || tool === 'leaf') && isPlanted)
        cell.classList.add('gtb-cell-valid');
    });
  }

  function _clearCells() {
    document.querySelectorAll('#garden-grid .garden-cell').forEach(cell => {
      cell.classList.remove('gtb-cell-valid', 'gtb-cell-hover');
    });
  }

  function _clearTrash() {
    document.getElementById('gtb-trash')?.classList.remove('gtb-dz-valid', 'gtb-dz-hover');
  }

  // Drop animation pop
  function _popDrop(x, y, emoji) {
    const el = document.createElement('div');
    el.textContent = emoji;
    el.style.cssText =
      `position:fixed;left:${x - 14}px;top:${y - 14}px;`
      + `font-size:28px;pointer-events:none;z-index:9999;`
      + `animation:gtbDropPop .5s ease forwards;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  // ── Pointer down on a toolbar tool ──
  toolbar.addEventListener('pointerdown', e => {
    const target = e.target.closest('.gtb-tool');
    if (!target || target.classList.contains('gtb-disabled')) return;

    e.preventDefault();
    _dragEl   = target;
    _dragTool = target.dataset.tool;
    try { target.setPointerCapture(e.pointerId); } catch(_) {}

    const r = target.getBoundingClientRect();
    _offX = e.clientX - r.left;
    _offY = e.clientY - r.top;
    _ghost = _mkGhost(target);
    target.classList.add('gtb-dragging');
    _highlightCells(_dragTool);
  });

  // ── Pointer move: move ghost, hover-highlight cell under cursor ──
  document.addEventListener('pointermove', e => {
    if (!_ghost) return;
    _ghost.style.left = (e.clientX - _offX) + 'px';
    _ghost.style.top  = (e.clientY - _offY) + 'px';

    // Clear previous hover
    document.querySelectorAll('#garden-grid .gtb-cell-hover').forEach(c => c.classList.remove('gtb-cell-hover'));

    const cell = _cellAt(e.clientX, e.clientY);
    if (cell?.classList.contains('gtb-cell-valid')) cell.classList.add('gtb-cell-hover');
  });

  // ── Pointer up: execute action on the cell ──
  document.addEventListener('pointerup', async e => {
    if (!_ghost) return;

    const cell = _cellAt(e.clientX, e.clientY);
    const tool = _dragTool;
    const px   = e.clientX, py = e.clientY;

    _ghost.remove(); _ghost = null;
    _dragEl?.classList.remove('gtb-dragging');
    _dragEl = null; _dragTool = null;
    _clearCells();
    _clearTrash();

    if (!cell?.classList.contains('gtb-cell-valid')) return;

    // Get plant id from cell's row/col
    const row   = parseInt(cell.dataset.row);
    const col   = parseInt(cell.dataset.col);
    const plant = (_gardenData?.plants || []).find(p => p.row === row && p.col === col);
    if (!plant) return;

    const pid = plant._id;

    if (tool === 'water') {
      _popDrop(px, py, '💧');
      await _cpCareAction(apiGarden.water, '💧 Đã tưới nước!', pid);
    } else if (tool === 'fert') {
      _popDrop(px, py, '🌿');
      await _cpCareAction(apiGarden.fertilize, '🌿 Đã bón phân!', pid);
    } else if (tool === 'bug') {
      if (!plant.bugs || plant.bugs < 1) { toast('🌿 Cây này không có sâu!'); return; }
      _popDrop(px, py, '🪲');
      await _cpCareAction(apiGarden.catchBug, '🐛 Đã bắt sâu!', pid);
    } else if (tool === 'leaf') {
      if (!plant.deadLeaves || plant.deadLeaves < 1) { toast('🌿 Cây này không có lá hư!'); return; }
      _popDrop(px, py, '✂️');
      await _cpCareAction(apiGarden.removeLeaf, '🍂 Đã ngắt lá hư!', pid);
    }
  });

  // Cancel
  document.addEventListener('pointercancel', () => {
    if (!_ghost) return;
    _ghost.remove(); _ghost = null;
    _dragEl?.classList.remove('gtb-dragging');
    _dragEl = null; _dragTool = null;
    _clearCells();
    _clearTrash();
  });
}

// ── Garden shop (full catalog page) ──────────────────────────
function _setupGardenViewTabs() {
  document.querySelectorAll('.gvt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gvt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.gview;
      document.getElementById('garden-view-grid').style.display    = view === 'grid'    ? '' : 'none';
      document.getElementById('garden-view-friends').style.display = view === 'friends' ? '' : 'none';
      if (view === 'friends') _loadGardenFriendsList();
    });
  });
}

function _setupGardenShopTabs() {
  document.querySelectorAll('.gst-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gst-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.gshop;
      document.getElementById('gshop-plant-filter').style.display = tab === 'plants' ? '' : 'none';
      _renderGardenShop(tab);
    });
  });
}

function _setupGardenShopFilter() {
  document.querySelectorAll('.gf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _renderGardenShop('plants', btn.dataset.cat);
    });
  });
}

function _renderGardenShop(tab = 'plants', cat = 'all') {
  const container = document.getElementById('gshop-items');
  if (!container || !_gardenCatalog) return;

  if (tab === 'pots') {
    container.innerHTML = _gardenCatalog.pots.map(p => `
      <div class="gshop-item">
        <div class="gshop-item-emoji">${p.emoji}</div>
        <div class="gshop-item-name">${esc(p.name)}</div>
        <div class="gshop-item-sub">${esc(p.desc)}</div>
        <div class="gshop-item-price">${p.price} điểm</div>
        <div class="gshop-item-note">Mua khi trồng cây</div>
      </div>`).join('');
    return;
  }

  // Plants tab
  const plants = cat === 'all'
    ? _gardenCatalog.plants
    : _gardenCatalog.plants.filter(p => p.category === cat);

  container.innerHTML = plants.map(p => {
    const ci = CAT_INFO[p.category] || {};
    const stageSummary = Object.entries(p.stages || {})
      .map(([s, d]) => `${STAGE_INFO[s]?.label||s} ${d}n`)
      .join(' → ');
    // Pick a signature stage for the shop preview
    const allStages = Object.keys(p.stages || {});
    const sigStage = allStages.includes('flowering') ? 'flowering'
                   : allStages.includes('fruiting')  ? 'fruiting'
                   : allStages.includes('growing')   ? 'growing'
                   : allStages[allStages.length - 1] || 'leafing';
    const arch = PLANT_ARCHETYPE[p.id] || 'ground-leafy';
    const previewHTML = _buildPlantBodyHTML(p.id, sigStage);
    return `<div class="gshop-item gshop-plant-item">
      <div class="gshop-item-plant-preview">
        <div class="gc-plant-body stage-${sigStage} plant-${arch} plant-${p.id}">${previewHTML}</div>
      </div>
      <div class="gshop-item-name">${esc(p.name)}</div>
      <div class="gshop-cat-badge" style="background:${ci.color||'#b07fff'}22;color:${ci.color||'#b07fff'}">${ci.emoji} ${ci.label}</div>
      <div class="gshop-item-sub">${esc(p.desc)}</div>
      <div class="gshop-stage-timeline">${stageSummary}</div>
      ${p.harvestable ? `<div class="gshop-harvest-badge">🌾 Thu hoạch: ${p.harvestItem} (+${p.harvestPoints}đ)</div>` : '<div class="gshop-ornamental-badge">🌀 Cây cảnh</div>'}
      <div class="gshop-item-price">${p.price} điểm</div>
    </div>`;
  }).join('');
}


// ── Weather grid effects ──────────────────────────────────────
function _applyWeatherEffectsToGrid(wrap, weatherId) {
  if (!wrap) return;
  const WEATHERS = ['sunny','cloudy','rainy','stormy','foggy','windy'];
  WEATHERS.forEach(w => wrap.classList.remove('gw-' + w));
  const old = wrap.querySelector('.gw-fx');
  if (old) old.remove();
  if (!weatherId || !WEATHERS.includes(weatherId)) return;

  wrap.classList.add('gw-' + weatherId);

  const fx = document.createElement('div');
  fx.className = 'gw-fx';

  if (weatherId === 'rainy' || weatherId === 'stormy') {
    const count = weatherId === 'stormy' ? 30 : 20;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'gw-rain';
      s.style.left = (Math.random() * 100) + '%';
      s.style.animationDelay = (Math.random() * 1.8) + 's';
      s.style.animationDuration = (0.55 + Math.random() * 0.55) + 's';
      s.style.opacity = (0.3 + Math.random() * 0.45);
      fx.appendChild(s);
    }
    if (weatherId === 'stormy') {
      const flash = document.createElement('div');
      flash.className = 'gw-lightning';
      fx.appendChild(flash);
    }
  }

  if (weatherId === 'sunny') {
    const glow = document.createElement('div');
    glow.className = 'gw-sunglow';
    fx.appendChild(glow);
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('span');
      s.className = 'gw-sunray';
      s.style.setProperty('--i', i);
      fx.appendChild(s);
    }
  }

  if (weatherId === 'foggy') {
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.className = 'gw-fog';
      d.style.setProperty('--i', i);
      fx.appendChild(d);
    }
  }

  if (weatherId === 'windy') {
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('span');
      s.className = 'gw-windline';
      s.style.top = (8 + Math.random() * 84) + '%';
      s.style.width = (18 + Math.random() * 28) + '%';
      s.style.animationDelay = (Math.random() * 2.5) + 's';
      s.style.animationDuration = (0.9 + Math.random() * 1.4) + 's';
      fx.appendChild(s);
    }
    const leaves = ['🍃', '🍂', '🌿'];
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'gw-leaf';
      s.textContent = leaves[i % leaves.length];
      s.style.top = (10 + Math.random() * 72) + '%';
      s.style.animationDelay = (Math.random() * 3.5) + 's';
      s.style.animationDuration = (2.2 + Math.random() * 2) + 's';
      fx.appendChild(s);
    }
  }

  if (weatherId === 'cloudy') {
    for (let i = 0; i < 2; i++) {
      const d = document.createElement('div');
      d.className = 'gw-cloud-shadow';
      d.style.setProperty('--i', i);
      fx.appendChild(d);
    }
  }

  wrap.appendChild(fx);
}

// ── Weather page-level background effects ─────────────────────
function _applyWeatherToPage(weatherId) {
  const page = document.getElementById('page-garden');
  if (!page) return;
  const WEATHERS = ['sunny','cloudy','rainy','stormy','foggy','windy'];
  WEATHERS.forEach(w => page.classList.remove('gw-' + w));
  const old = page.querySelector(':scope > .gw-page-fx');
  if (old) old.remove();
  if (!weatherId || !WEATHERS.includes(weatherId)) return;

  page.classList.add('gw-' + weatherId);

  const fx = document.createElement('div');
  fx.className = 'gw-page-fx';

  if (weatherId === 'rainy' || weatherId === 'stormy') {
    const count = weatherId === 'stormy' ? 70 : 45;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'gw-page-rain';
      s.style.left = (Math.random() * 100) + '%';
      s.style.animationDelay = (Math.random() * 2.5) + 's';
      s.style.animationDuration = (0.6 + Math.random() * 0.8) + 's';
      s.style.opacity = (0.1 + Math.random() * 0.18);
      fx.appendChild(s);
    }
    if (weatherId === 'stormy') {
      const flash = document.createElement('div');
      flash.className = 'gw-page-lightning';
      fx.appendChild(flash);
    }
  }

  if (weatherId === 'sunny') {
    const glow = document.createElement('div');
    glow.className = 'gw-page-sunglow';
    fx.appendChild(glow);
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'gw-page-sunray';
      s.style.setProperty('--i', i);
      fx.appendChild(s);
    }
  }

  if (weatherId === 'foggy') {
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'gw-page-fog';
      d.style.setProperty('--i', i);
      fx.appendChild(d);
    }
  }

  if (weatherId === 'windy') {
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'gw-page-windline';
      s.style.top = (Math.random() * 100) + '%';
      s.style.width = (12 + Math.random() * 22) + '%';
      s.style.animationDelay = (Math.random() * 4) + 's';
      s.style.animationDuration = (1.2 + Math.random() * 2) + 's';
      fx.appendChild(s);
    }
    const leaves = ['🍃','🍂','🌿','🍁'];
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('span');
      s.className = 'gw-page-leaf';
      s.textContent = leaves[i % leaves.length];
      s.style.top = (Math.random() * 85) + '%';
      s.style.animationDelay = (Math.random() * 5) + 's';
      s.style.animationDuration = (3.5 + Math.random() * 3.5) + 's';
      fx.appendChild(s);
    }
  }

  if (weatherId === 'cloudy') {
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div');
      d.className = 'gw-page-cloud';
      d.style.setProperty('--i', i);
      fx.appendChild(d);
    }
  }

  page.insertBefore(fx, page.firstChild);
}

// ── Weather banner ────────────────────────────────────────────
function _renderWeatherBanner(info, weatherId, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!info || !weatherId) { el.style.display = 'none'; return; }

  const WEATHER_ANIM_CLASS = {
    sunny: 'gwb-sunny', cloudy: 'gwb-cloudy', rainy: 'gwb-rainy',
    stormy: 'gwb-stormy', foggy: 'gwb-foggy', windy: 'gwb-windy',
  };
  el.className = `garden-weather-banner ${WEATHER_ANIM_CLASS[weatherId] || ''}`;
  el.innerHTML = `
    <div class="gwb-content">
      <span class="gwb-emoji">${info.emoji}</span>
      <div class="gwb-info">
        <span class="gwb-label">${esc(info.label)}</span>
        <span class="gwb-desc">${esc(info.desc)}</span>
      </div>
    </div>
    <div class="gwb-particles" aria-hidden="true"></div>`;
  el.style.display = '';
}

// ── Ecosystem panel ───────────────────────────────────────────
function _renderEcosystemPanel(eco, elId) {
  const el = document.getElementById(elId);
  if (!el) return;

  if (!eco) { el.style.display = 'none'; return; }

  const { bees = 0, birds = false, bats = false, mushrooms = 0, worms = 0 } = eco;
  const hasAnything = bees > 0 || birds || bats || mushrooms > 0 || worms > 0;
  if (!hasAnything) { el.style.display = 'none'; return; }

  const creatures = [];
  if (bees > 0)     creatures.push(`<div class="geo-card" title="Ong thụ phấn, tăng tốc cây đang ra hoa">🐝<span>${bees} ong</span></div>`);
  if (birds)        creatures.push(`<div class="geo-card" title="Chim ăn sâu bọ, giảm sâu xuất hiện">🐦<span>Chim</span></div>`);
  if (bats)         creatures.push(`<div class="geo-card" title="Dơi ăn sâu ban đêm, giảm sâu xuất hiện">🦇<span>Dơi</span></div>`);
  if (worms > 0)    creatures.push(`<div class="geo-card" title="Giun cải thiện đất, giảm tiêu hao dinh dưỡng">🪱<span>${worms} giun</span></div>`);
  if (mushrooms > 0) {
    creatures.push(`<div class="geo-card geo-card-harvest" id="geo-mushroom-btn" title="Thu hoạch nấm lấy phân bón">🍄<span>${mushrooms} nấm</span><span class="geo-harvest-hint">Thu hoạch</span></div>`);
  }

  el.innerHTML = `<div class="geo-title">🌿 Hệ sinh thái</div><div class="geo-cards">${creatures.join('')}</div>`;
  el.style.display = '';

  // Mushroom harvest button
  document.getElementById('geo-mushroom-btn')?.addEventListener('click', async () => {
    try {
      const r = await apiGarden.mushroomHarvest();
      if (r.error) { toast('❌ ' + r.error); return; }
      toast(`🍄 Thu hoạch ${r.mushrooms} nấm → +${r.fertilizer} phân bón, +${r.pts} điểm!`);
      if (r.points !== undefined) updatePointsUI(r.points);
      _gardenData = await apiGarden.load();
      _refreshGardenUI();
      quickNotifCheck();
    } catch(e) { toast('❌ ' + e.message); }
  });
}

// ── Friends garden view ───────────────────────────────────────
function _setupGardenFriendsView() {
  document.getElementById('gfv-back-btn')?.addEventListener('click', () => {
    document.getElementById('gfv-garden').style.display = 'none';
    document.getElementById('gfv-list').style.display   = '';
    _gardenFriendData = null;
  });
}

async function _loadGardenFriendsList() {
  const container = document.getElementById('gfv-friends-list');
  if (!container) return;
  container.innerHTML = '<div class="gfv-loading">⏳ Đang tải...</div>';
  try {
    const friends = await API.g('/api/gamification/friends-list');
    if (!friends || !friends.length) {
      container.innerHTML = '<div class="gfv-empty">Chưa có bạn bè nào. Thêm bạn bè để thăm vườn!</div>';
      return;
    }
    container.innerHTML = friends.map(f => {
      const fs = f.friendship || {};
      const fsBadge = `<span class="gfv-fs-badge gfv-fs-lv${fs.level||0}">${fs.emoji||'🌱'} ${fs.label||'Xa lạ'}</span>`;
      return `
      <div class="gfv-friend-card" data-fid="${esc(f._id)}">
        <div class="gfv-friend-avatar">${esc((f.displayName || f.username || '?').charAt(0).toUpperCase())}</div>
        <div class="gfv-friend-info">
          <div class="gfv-friend-name">${esc(f.displayName || f.username)}${f.isOnline ? ' <span class="gfv-online-dot"></span>' : ''}</div>
          <div class="gfv-friend-sub">Cấp ${f.level || 1} · ${fsBadge}</div>
        </div>
        <button class="gfv-visit-btn" data-fid="${esc(f._id)}">🌿 Thăm vườn</button>
      </div>`;
    }).join('');

    container.querySelectorAll('.gfv-visit-btn').forEach(btn => {
      btn.addEventListener('click', () => _openFriendGarden(btn.dataset.fid));
    });
  } catch(e) {
    container.innerHTML = `<div class="gfv-empty">❌ ${esc(e.message)}</div>`;
  }
}

async function _openFriendGarden(friendId) {
  const listEl   = document.getElementById('gfv-list');
  const gardenEl = document.getElementById('gfv-garden');
  const ownerEl  = document.getElementById('gfv-garden-owner');
  if (!listEl || !gardenEl) return;

  listEl.style.display   = 'none';
  gardenEl.style.display = '';
  if (ownerEl) ownerEl.textContent = '⏳ Đang tải vườn...';

  try {
    _gardenFriendData = await apiGarden.loadFriendGarden(friendId);
    const f  = _gardenFriendData.friend     || {};
    const fs = _gardenFriendData.friendship || {};
    if (ownerEl) ownerEl.textContent = `🌿 Vườn của ${f.displayName || f.username}`;

    // Update friendship badge in header
    const fsBadgeEl = document.getElementById('gfv-friendship-badge');
    if (fsBadgeEl) {
      fsBadgeEl.textContent = `${fs.emoji||'🌱'} ${fs.label||'Xa lạ'} (${fs.score||0} điểm)`;
      fsBadgeEl.className   = `gfv-fs-header-badge gfv-fs-lv${fs.level||0}`;
      fsBadgeEl.style.display = '';
    }

    // Wire gift-rose button
    const roseBtn = document.getElementById('gfv-gift-rose-btn');
    if (roseBtn) {
      roseBtn.onclick = null;
      roseBtn.onclick = async () => {
        roseBtn.disabled = true;
        roseBtn.textContent = '⏳';
        try {
          const r = await apiGarden.giftRose(friendId);
          if (r.error) { toast('❌ ' + r.error); return; }
          toast(`🌹 Đã tặng hoa hồng! Còn ${r.myRose} 🌹 trong kho.`);
          // Refresh friendship badge
          _gardenFriendData = await apiGarden.loadFriendGarden(friendId);
          const fsNew = _gardenFriendData.friendship || {};
          if (fsBadgeEl) {
            fsBadgeEl.textContent = `${fsNew.emoji||'🌱'} ${fsNew.label||'Xa lạ'} (${fsNew.score||0} điểm)`;
            fsBadgeEl.className   = `gfv-fs-header-badge gfv-fs-lv${fsNew.level||0}`;
          }
          quickNotifCheck();
        } catch(err) {
          toast('❌ ' + (err.error || err.message));
        } finally {
          roseBtn.disabled = false;
          roseBtn.textContent = '🌹 Tặng hoa';
        }
      };
    }

    _renderWeatherBanner(_gardenFriendData.weatherInfo, _gardenFriendData.weather, 'gfv-weather-banner');
    _applyWeatherEffectsToGrid(document.getElementById('gfv-grid')?.closest('.garden-grid-wrap'), _gardenFriendData.weather);
    _applyWeatherToPage(_gardenFriendData.weather);
    _renderEcosystemPanel(_gardenFriendData.ecosystem, 'gfv-eco-panel');
    _renderFriendGardenGrid(_gardenFriendData, friendId);
  } catch(e) {
    if (ownerEl) ownerEl.textContent = '❌ Không thể tải vườn';
    toast('❌ ' + e.message);
  }
}
