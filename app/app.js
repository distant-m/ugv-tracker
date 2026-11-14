(function(){
'use strict';
/* ============================================================
   Система контролю проєкту. Код не містить даних проєкту:
   усе завантажується з бази після входу.
   ============================================================ */
const CFG=window.APP_CONFIG||{};
const SITE=location.origin+location.pathname;
const HASH0=new URLSearchParams(location.hash.slice(1));
const LINK_TYPE=HASH0.get('type'); // invite | recovery | magiclink | signup
const sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});

/* ---------- helpers ---------- */
const DAY=864e5;
const sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const addMonths=(d,n)=>new Date(d.getFullYear(),d.getMonth()+n,d.getDate());
const diff=(a,b)=>Math.round((sod(b)-sod(a))/DAY);
const parseD=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d)};
const p2=x=>String(x).padStart(2,'0');
const fmt=d=>p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.'+d.getFullYear();
const fmtS=d=>p2(d.getDate())+'.'+p2(d.getMonth()+1);
const fmtDT=s=>{const d=new Date(s);return fmt(d)+' '+p2(d.getHours())+':'+p2(d.getMinutes())};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isUrl=s=>/^https:\/\//i.test(s||'');
const TODAY=sod(new Date());
let START,PEND;
const monthEnd=m=>addDays(addMonths(START,m),-1);

/* ---------- i18n ---------- */
const MON={uk:['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']};
const L={uk:{
 tab_gantt:'Графік',tab_ind:'Показники',tab_proc:'Закупівлі',tab_tasks:'Задачі адміністратора',tab_staff:'Персонал',tab_users:'Користувачі',tab_log:'Журнал',
 role_admin:'Адміністратор',role_user:'Користувач',role_viewer:'Глядач',logout:'Вийти',export:'Вивантажити в Excel',
 lg_future:'Майбутнє',lg_active:'Триває',lg_done:'Завершено',lg_late:'Прострочено / бракує даних',today:'Сьогодні',month:'М',
 st_future:'Майбутнє',st_active:'Триває',st_done:'Завершено',st_late:'Прострочено',
 of:'з',expected:'очікувано на сьогодні',goal10:'ціль ≥10%',k_w:'Жінок серед сертифікованих',k_late:'Груп із недоліками',lateHint:'завершені групи без повних даних',
 plan:'План',results:'Результат групи',confirm:'Підтвердження',readonly:'Лише перегляд.',
 started_f:'Розпочали — жінки',started_m:'Розпочали — чоловіки',cert_f:'Сертифіковано — жінки',cert_m:'Сертифіковано — чоловіки',
 entry_avg:'Вхідний тест, середній бал, %',exit_avg:'Вихідний тест, середній бал, %',practical_pass:'Склали практичний іспит, осіб',satisfaction:'Задоволені навчанням, %',
 covered_f:'Охоплено — жінки',covered_m:'Охоплено — чоловіки',drill_pass:'Виконали практичне відпрацювання, осіб',part_f:'Учасники — жінки',part_m:'Учасники — чоловіки',
 d_request:'Заявка на навчання (лист-запит від підрозділу)',d_confirm:'Документи підтвердження (журнал, реєстр, сертифікати)',d_entry:'Вхідний тест — вигрузка',d_exit:'Вихідний тест — вигрузка',d_practical:'Оцінки практичного іспиту (за шаблоном)',
 d_satisfaction:'Анкета задоволеності групи',d_survey612:'Опитування випускників через 6–12 місяців',d_report:'Звіт / реєстрація учасників',d_video:'Посилання на відео',
 s_cert:'Сертифіковано',s_plan:'Від плану',s_women:'Частка жінок',s_gain:'Приріст балів',s_prac:'Практичний іспит',s_rate:'Успішність',s_cov:'Охоплено',s_drill:'Відпрацювання',s_part:'Учасників',
 waitFrom:'Очікується з',open:'Відкрити',close:'Закрити',paste:'Вставте посилання на Google-документ',
 missItems:'Бракує:',noIssues:'Усі дані та документи на місці.',notEnded:'Документи вносяться після завершення групи.',
 stage:'Етап',track:'Трек',fact:'Факт',lateList:'Групи з недоліками',groups:'груп',
 ind_lead:'Розраховані значення беруться з даних груп; решту адміністратор вносить вручну з посиланням на джерело.',
 lvl_out:'Продукти (outputs)',lvl_imm:'Безпосередні результати',lvl_int:'Проміжні результати',lvl_ult:'Кінцевий результат',
 th_ind:'Показник',th_base:'Базове',th_target:'Ціль',th_cur:'Зараз',th_freq:'Частота',th_src:'Джерело',auto:'авто',quarterly:'Щокварталу',semi:'Щопівроку',
 proc_lead:'Статус і посилання на документ підтвердження. Позиція червоніє, якщо дедлайн минув, а її не отримано.',
 th_item:'Позиція',th_qty:'К-сть',th_due:'Дедлайн',th_status:'Статус',th_doc:'Документ підтвердження',
 ps_planned:'Заплановано',ps_ordered:'Замовлено',ps_paid:'Оплачено',ps_received:'Отримано',
 sec_launch:'Запуск (місяці 1–6)',sec_cycle:'Для кожної групи',sec_period:'Щомісяця / щокварталу / щопівроку',sec_close:'Завершення проєкту',sec_custom:'Власні задачі',
 add:'Додати',addPh:'Нова задача',due:'до',overdue:'прострочено',every:'Кожна група',monthly:'Щомісяця',sem:'Щопівроку',q:'Щокварталу',fromProc:'із закупівель',
 saved:'Збережено',saveErr:'Не вдалося зберегти: ',exportDue:'Минуло понад 14 днів від останнього вивантаження даних. Вивантажте повний статус проєкту в Excel.',exportNever:'Дані ще жодного разу не вивантажувалися. Вивантажте повний статус проєкту в Excel.',
 lastExport:'Останнє вивантаження: '
},en:{
 tab_gantt:'Timeline',tab_ind:'Indicators',tab_proc:'Procurement',tab_tasks:'Admin tasks',tab_staff:'Staff',tab_users:'Users',tab_log:'Change log',
 role_admin:'Administrator',role_user:'User',role_viewer:'Viewer',logout:'Sign out',export:'Export to Excel',
 lg_future:'Upcoming',lg_active:'In progress',lg_done:'Completed',lg_late:'Overdue / data missing',today:'Today',month:'M',
 st_future:'Upcoming',st_active:'In progress',st_done:'Completed',st_late:'Overdue',
 of:'of',expected:'expected by today',goal10:'target ≥10%',k_w:'Women among certified',k_late:'Groups with gaps',lateHint:'completed groups with incomplete data',
 plan:'Plan',results:'Group results',confirm:'Evidence',readonly:'View only.',
 started_f:'Started — women',started_m:'Started — men',cert_f:'Certified — women',cert_m:'Certified — men',
 entry_avg:'Entry test, average score, %',exit_avg:'Exit test, average score, %',practical_pass:'Passed practical exam, people',satisfaction:'Satisfied with training, %',
 covered_f:'Covered — women',covered_m:'Covered — men',drill_pass:'Completed practical drill, people',part_f:'Participants — women',part_m:'Participants — men',
 d_request:'Training request (letter from the unit)',d_confirm:'Evidence documents (class log, register, certificates)',d_entry:'Entry test — export',d_exit:'Exit test — export',d_practical:'Practical exam scores (template)',
 d_satisfaction:'Group satisfaction questionnaire',d_survey612:'Graduate survey at 6–12 months',d_report:'Report / participant registration',d_video:'Video link',
 s_cert:'Certified',s_plan:'Of plan',s_women:'Women share',s_gain:'Score gain',s_prac:'Practical exam',s_rate:'Pass rate',s_cov:'Covered',s_drill:'Drill',s_part:'Participants',
 waitFrom:'Due from',open:'Open',close:'Close',paste:'Paste a Google Docs link',
 missItems:'Missing:',noIssues:'All data and documents are in place.',notEnded:'Documents are added once the group ends.',
 stage:'Phase',track:'Track',fact:'Actual',lateList:'Groups with gaps',groups:'groups',
 ind_lead:'Calculated values come from group data; the rest are entered by the administrator with a link to the source.',
 lvl_out:'Outputs',lvl_imm:'Immediate outcomes',lvl_int:'Intermediate outcomes',lvl_ult:'Ultimate outcome',
 th_ind:'Indicator',th_base:'Baseline',th_target:'Target',th_cur:'Current',th_freq:'Frequency',th_src:'Source',auto:'auto',quarterly:'Quarterly',semi:'Semi-annually',
 proc_lead:'Status and a link to the evidence document. An item turns red when its deadline passes before it is received.',
 th_item:'Item',th_qty:'Qty',th_due:'Deadline',th_status:'Status',th_doc:'Evidence document',
 ps_planned:'Planned',ps_ordered:'Ordered',ps_paid:'Paid',ps_received:'Received',
 sec_launch:'Launch (months 1–6)',sec_cycle:'For every group',sec_period:'Monthly / quarterly / semi-annually',sec_close:'Project close-out',sec_custom:'Own tasks',
 add:'Add',addPh:'New task',due:'by',overdue:'overdue',every:'Every group',monthly:'Monthly',sem:'Semi-annually',q:'Quarterly',fromProc:'from procurement',
 saved:'Saved',saveErr:'Could not save: ',exportDue:'More than 14 days since the last data export. Export the full project status to Excel.',exportNever:'Data has never been exported. Export the full project status to Excel.',
 lastExport:'Last export: '
}};
let lang='uk';try{lang=localStorage.getItem('lang')||'uk'}catch(e){}
const t=k=>L[lang][k]??L.uk[k]??k;
const n=o=>o==null?'':typeof o==='string'?o:(o[lang]??o.uk);
const nm=(row,f)=>lang==='en'?(row[f+'_en']||row[f+'_uk']):row[f+'_uk'];

/* ---------- toast ---------- */
function toast(m,bad){const r=document.getElementById('toastRoot');r.innerHTML=`<div class="toast${bad?' bad':''}">${esc(m)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>r.innerHTML='',bad?5000:1600)}
async function save(p){const {error}=await p;if(error){toast(t('saveErr')+error.message,true);return false}toast(t('saved'));return true}

/* ---------- state ---------- */
let USER=null,PROFILE=null,role='viewer';
let SETTINGS={},TRACKS=[],STAGES=[],G=[],PROC=[],IND=[],TASKS=[],POS=[],SLOTS=[],PROFILES=[];
let tab='gantt';
const filters={};
const isAdmin=()=>role==='admin';

/* ---------- auth screens ---------- */
const app=document.getElementById('app');
function loginScreen(msg,err){
 app.innerHTML=`<div class="login"><form id="lf" autocomplete="on">
  <h1>Вхід у систему</h1>
  ${msg?`<div class="msg">${esc(msg)}</div>`:''}${err?`<div class="err">${esc(err)}</div>`:''}
  <label class="fl">Електронна пошта<input class="inp" id="le" type="email" autocomplete="username" required></label>
  <label class="fl">Пароль<input class="inp" id="lp" type="password" autocomplete="current-password"></label>
  <button class="btn" type="submit">Увійти</button>
  <div class="links"><button class="linkbtn" type="button" id="lmagic">Надіслати посилання для входу</button><button class="linkbtn" type="button" id="lreset">Забули пароль?</button></div>
 </form></div>`;
 const em=()=>document.getElementById('le').value.trim();
 document.getElementById('lf').onsubmit=async e=>{e.preventDefault();const pw=document.getElementById('lp').value;if(!pw){loginScreen('',"Введіть пароль або скористайтеся посиланням для входу.");return}
  const {error}=await sb.auth.signInWithPassword({email:em(),password:pw});if(error)loginScreen('','Невірна пошта або пароль.')};
 document.getElementById('lmagic').onclick=async()=>{if(!em()){loginScreen('','Спершу введіть пошту.');return}
  await sb.auth.signInWithOtp({email:em(),options:{shouldCreateUser:false,emailRedirectTo:SITE}});loginScreen('Якщо ця адреса є в системі, на неї надіслано посилання для входу.')};
 document.getElementById('lreset').onclick=async()=>{if(!em()){loginScreen('','Спершу введіть пошту.');return}
  await sb.auth.resetPasswordForEmail(em(),{redirectTo:SITE});loginScreen('Якщо ця адреса є в системі, на неї надіслано посилання для зміни пароля.')};
}
function setPasswordScreen(){
 app.innerHTML=`<div class="login"><form id="pf"><h1>Встановіть пароль</h1><div class="msg">Не менше 10 символів. Його знатимете лише ви.</div>
  <label class="fl">Новий пароль<input class="inp" id="p1" type="password" autocomplete="new-password" minlength="10" required></label>
  <label class="fl">Повторіть пароль<input class="inp" id="p2" type="password" autocomplete="new-password" minlength="10" required></label>
  <div class="err" id="perr"></div><button class="btn" type="submit">Зберегти пароль</button></form></div>`;
 document.getElementById('pf').onsubmit=async e=>{e.preventDefault();const a=document.getElementById('p1').value,b=document.getElementById('p2').value;const er=document.getElementById('perr');
  if(a.length<10){er.textContent='Пароль закороткий.';return}if(a!==b){er.textContent='Паролі не збігаються.';return}
  const {error}=await sb.auth.updateUser({password:a});if(error){er.textContent=error.message;return}toast('Пароль збережено');start()};
}
function noAccess(){app.innerHTML=`<div class="login"><div class="box"><h1>Доступ не надано</h1><div class="msg">Ваш обліковий запис не активний. Зверніться до адміністратора.</div><button class="btn sec" id="lo">Вийти</button></div></div>`;document.getElementById('lo').onclick=()=>sb.auth.signOut().then(()=>loginScreen())}

/* ---------- icon (shown only after login; stored in the private bucket) ---------- */
async function loadIcon(){try{const {data}=await sb.storage.from('templates').createSignedUrl('favicon.png',12*3600);if(!data)return;
 ['favicon','touchicon'].forEach(id=>{const l=document.getElementById(id);if(l){l.type='image/png';l.href=data.signedUrl}})}catch(e){}}
/* ---------- loading ---------- */
async function q(table,order){let r=sb.from(table).select('*');if(order)r=r.order(order);const {data,error}=await r;if(error)throw error;return data||[]}
async function loadAll(){
 const [st,tr,sg,gr,pr,ind]=await Promise.all([q('settings'),q('tracks','sort'),q('stages','idx'),q('groups','start_date'),q('procurement','sort'),q('indicators','sort')]);
 SETTINGS={};st.forEach(r=>SETTINGS[r.key]=r.value);
 START=parseD(SETTINGS.start_date||'2026-01-01');PEND=addDays(addMonths(START,18),-1);
 TRACKS=tr;STAGES=sg.map(s=>({...s,start:addMonths(START,s.month_from-1),end:monthEnd(s.month_to)}));
 G=gr.map(g=>({...g,start:parseD(g.start_date),end:parseD(g.end_date),facts:g.facts||{},docs:g.docs||{}}));
 PROC=pr;IND=ind;
 TRACKS.forEach(tk=>{if(!(tk.tag in filters))filters[tk.tag]=true});
 if(isAdmin()){const [ta,po,sl,pf]=await Promise.all([q('admin_tasks','sort'),q('positions','sort'),q('staff_slots','idx'),q('profiles','created_at')]);TASKS=ta;POS=po;SLOTS=sl;PROFILES=pf}
}
async function start(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){loginScreen();return}
 USER=session.user;
 if(LINK_TYPE==='invite'||LINK_TYPE==='recovery'){if(!start.pwDone){start.pwDone=true;setPasswordScreen();return}}
 const {data:pf}=await sb.from('profiles').select('*').eq('id',USER.id).maybeSingle();
 if(!pf||!pf.active){noAccess();return}
 PROFILE=pf;role=pf.role;loadIcon();
 app.innerHTML='<div class="loading">Завантаження даних…</div>';
 try{await loadAll()}catch(e){app.innerHTML=`<div class="login"><div class="box"><h1>Помилка завантаження</h1><div class="msg">${esc(e.message)}</div></div></div>`;return}
 route();
}
sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'){USER=null;loginScreen()}else if(ev==='PASSWORD_RECOVERY'){setPasswordScreen()}});

/* ---------- logic ---------- */
const TYPES={
 course:{facts:['started_f','started_m','cert_f','cert_m','entry_avg','exit_avg','practical_pass','satisfaction'],docs:['request','confirm','entry','exit','practical','satisfaction','survey612']},
 mobile:{facts:['started_f','started_m','cert_f','cert_m','entry_avg','exit_avg','practical_pass','satisfaction'],docs:['request','confirm','entry','exit','practical','satisfaction','survey612']},
 intro:{facts:['covered_f','covered_m','drill_pass'],docs:['confirm']},
 event:{facts:['part_f','part_m'],docs:['report']},
 lecture:{facts:[],docs:['video']},
 press:{facts:[],docs:['report']}
};
const num=v=>(v===null||v===undefined||v==='')?null:+v;
const survDue=g=>addDays(g.end,182);
const docLabel=d=>t('d_'+d);
function missing(g){const tp=TYPES[g.type]||{facts:[],docs:[]};const out=[];tp.facts.forEach(f=>{if(num(g.facts[f])===null)out.push(t(f))});
 tp.docs.forEach(d=>{if(d==='survey612'&&TODAY<survDue(g))return;if(!(g.docs[d]||'').trim())out.push(docLabel(d))});return out}
function status(g){if(TODAY<g.start)return'future';if(TODAY<=g.end)return'active';return missing(g).length?'late':'done'}
const procLate=p=>p.status!=='received'&&TODAY>monthEnd(p.due_month);
const procStatus=p=>p.status==='received'?'done':procLate(p)?'late':'future';
function stageStatus(s){if(TODAY<s.start)return'future';const gs=G.filter(g=>g.start>=s.start&&g.start<=s.end);
 if(gs.some(g=>status(g)==='late')||PROC.some(p=>p.due_month>=s.month_from&&p.due_month<=s.month_to&&procLate(p)))return'late';return TODAY>s.end?'done':'active'}
const canEdit=g=>isAdmin()||(role==='user'&&(PROFILE.tracks||[]).includes(g.track_id));
const sum=(gs,f)=>gs.reduce((a,g)=>a+(num(g.facts[f])||0),0);
const certOf=g=>(num(g.facts.cert_f)||0)+(num(g.facts.cert_m)||0);
const startedOf=g=>(num(g.facts.started_f)||0)+(num(g.facts.started_m)||0);
const covOf=g=>(num(g.facts.covered_f)||0)+(num(g.facts.covered_m)||0);
const partOf=g=>(num(g.facts.part_f)||0)+(num(g.facts.part_m)||0);
const pct=(a,b)=>b?Math.round(a/b*1000)/10:null;
const fmtPct=v=>v===null||v===undefined||isNaN(v)?'—':(Math.round(v*10)/10).toLocaleString(lang==='uk'?'uk-UA':'en-GB')+'%';
const fmtN=v=>v===null||v===undefined?'—':Number(v).toLocaleString(lang==='uk'?'uk-UA':'en-GB');
const factOf=g=>g.type==='intro'?covOf(g):g.type==='event'?partOf(g):certOf(g);
function totals(){
 const spec=G.filter(g=>g.type==='course'||g.type==='mobile');const intro=G.filter(g=>g.type==='intro');
 const certF=sum(spec,'cert_f'),cert=spec.reduce((a,g)=>a+certOf(g),0),stF=sum(spec,'started_f'),st=spec.reduce((a,g)=>a+startedOf(g),0);
 const gains=spec.filter(g=>num(g.facts.entry_avg)!==null&&num(g.facts.exit_avg)!==null).map(g=>g.facts.exit_avg-g.facts.entry_avg);
 const sats=spec.map(g=>num(g.facts.satisfaction)).filter(v=>v!==null);
 const byTrack={};TRACKS.forEach(tk=>{const gs=G.filter(g=>g.track_id===tk.id);byTrack[tk.id]={fact:gs.reduce((a,g)=>a+factOf(g),0),exp:gs.filter(g=>g.end<TODAY).reduce((a,g)=>a+(g.plan||0),0)}});
 return{byTrack,cert,certF,st,stF,certM:cert-certF,stM:st-stF,
  gain:gains.length?gains.reduce((a,b)=>a+b,0)/gains.length:null,sat:sats.length?sats.reduce((a,b)=>a+b,0)/sats.length:null,
  prac:sum(spec,'practical_pass'),introCov:intro.reduce((a,g)=>a+covOf(g),0),introDrill:sum(intro,'drill_pass'),
  evHeld:G.filter(g=>g.type==='event'&&g.end<TODAY).length,evPart:G.filter(g=>g.type==='event').reduce((a,g)=>a+partOf(g),0),
  lect:G.filter(g=>g.type==='lecture'&&(g.docs.video||'').trim()).length,press:G.filter(g=>g.type==='press'&&(g.docs.report||'').trim()).length,
  late:G.filter(g=>status(g)==='late').length,
  kits:PROC.filter(p=>(p.id==='p1'||p.id==='p2')&&p.status==='received').length,workshop:(PROC.find(p=>p.id==='p6')||{}).status==='received'};
}
function meter(cur,target,expected){const w=Math.min(100,target?cur/target*100:0);const e=expected&&target?Math.min(100,expected/target*100):null;
 return `<div class="meter"><i style="width:${w}%"></i>${e!==null?`<b style="left:${e}%"></b>`:''}</div>`}

/* ---------- shell ---------- */
function exportBanner(){if(!isAdmin())return'';const le=SETTINGS.last_export;if(!le)return `<div class="banner"><span>${esc(t('exportNever'))}</span><button class="btn" data-export>${esc(t('export'))}</button></div>`;
 const d=new Date(le);if((Date.now()-d)/DAY>14)return `<div class="banner"><span>${esc(t('exportDue'))} ${esc(t('lastExport'))}${fmtDT(le)}</span><button class="btn" data-export>${esc(t('export'))}</button></div>`;return''}
const isDark=()=>document.documentElement.dataset.theme==='dark';
function setTheme(m){if(m==='dark')document.documentElement.dataset.theme='dark';else delete document.documentElement.dataset.theme;try{localStorage.setItem('theme',m)}catch(e){}}
function render(){
 document.documentElement.lang=lang;const title=n(SETTINGS.project_title)||'Система контролю';document.title=title;
 const tabs=[['gantt','tab_gantt'],['indicators','tab_ind'],['procurement','tab_proc']];
 if(isAdmin())tabs.push(['staff','tab_staff'],['tasks','tab_tasks'],['users','tab_users'],['log','tab_log']);
 if(!tabs.find(x=>x[0]===tab))tab='gantt';
 app.innerHTML=`<header class="top"><div class="brand"><h1>${esc(title)}</h1><p>${esc(n(SETTINGS.project_subtitle))}</p></div>
  <div class="controls"><span class="who">${esc(PROFILE.nickname||PROFILE.email)} · ${esc(t('role_'+role))}</span>
  ${isAdmin()?`<button class="btn sec" data-export>${esc(t('export'))}</button>`:''}
  <button class="btn sec themebtn" id="themeBtn" aria-pressed="${isDark()}">${isDark()?(lang==='uk'?'☀ Світла тема':'☀ Light theme'):(lang==='uk'?'☾ Темна тема':'☾ Dark theme')}</button>
  <div class="seg" role="group" aria-label="Language"><button data-lang="uk" aria-pressed="${lang==='uk'}">UA</button><button data-lang="en" aria-pressed="${lang==='en'}">EN</button></div>
  <button class="btn sec" id="logout">${esc(t('logout'))}</button></div></header>
 ${exportBanner()}
 <nav class="tabs">${tabs.map(([id,k])=>`<a href="#${id}" ${tab===id?'aria-current="page"':''}>${esc(t(k))}</a>`).join('')}</nav>
 <main id="view"></main>`;
 app.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{lang=b.dataset.lang;try{localStorage.setItem('lang',lang)}catch(e){}render();if(drawer)drawer()});
 app.querySelector('#logout').onclick=()=>sb.auth.signOut();
 app.querySelector('#themeBtn').onclick=()=>{setTheme(isDark()?'light':'dark');render();if(drawer)drawer()};
 app.querySelectorAll('[data-export]').forEach(b=>b.onclick=exportXlsx);
 const v=app.querySelector('#view');
 ({gantt:renderGantt,indicators:renderInd,procurement:renderProc,tasks:renderTasks,staff:renderStaff,users:renderUsers,log:renderLog})[tab](v);
}
function route(){const h=(location.hash||'').slice(1);tab=['gantt','indicators','procurement','tasks','staff','users','log'].includes(h)?h:'gantt';if(PROFILE)render()}
window.addEventListener('hashchange',route);

/* ---------- gantt ---------- */
let ppd=5,scrolled=false;
function renderGantt(v){
 const T=totals();const wShare=pct(T.certF,T.cert);
 const tiles=TRACKS.filter(tk=>tk.kind==='training'&&tk.target).map(tk=>{const b=T.byTrack[tk.id];return `<div class="tile"><div class="k">${esc(tk.tag)} · ${esc(nm(tk,'name'))}</div><div class="v num">${fmtN(b.fact)} <small>${t('of')} ${esc(tk.target_label||tk.target)}</small></div>${meter(b.fact,tk.target,b.exp)}<div class="s">${esc(t('expected'))}: <span class="num">${fmtN(b.exp)}</span></div></div>`}).join('');
 const tags=[...new Set(TRACKS.map(tk=>tk.tag))].filter(x=>x!=='ЕТАПИ');
 v.innerHTML=`<div style="display:flex;flex-direction:column;gap:14px">
 <div class="stick" id="pageStick"><div class="tiles">${tiles}
  <div class="tile"><div class="k">${esc(t('k_w'))}</div><div class="v num">${fmtPct(wShare)}</div>${meter(wShare||0,20,10)}<div class="s">${esc(t('goal10'))} · <span class="num">${fmtN(T.certF)}</span> ${t('of')} <span class="num">${fmtN(T.cert)}</span></div></div>
  <div class="tile ${T.late?'alert':''}"><div class="k">${esc(t('k_late'))}</div><div class="v num">${T.late}</div><div class="s">${esc(t('lateHint'))}</div></div></div></div>
 <div class="bar-tools"><div class="chips">${tags.map(k=>`<button class="chip" data-f="${esc(k)}" aria-pressed="${filters[k]!==false}">${esc(k)}</button>`).join('')}</div>
  <div class="legend"><span><i class="sw s-future"></i>${esc(t('lg_future'))}</span><span><i class="sw s-active"></i>${esc(t('lg_active'))}</span><span><i class="sw s-done"></i>${esc(t('lg_done'))}</span><span><i class="sw s-late"></i>${esc(t('lg_late'))}</span></div>
  <div class="seg" role="group" aria-label="Zoom">${[3,5,9,16].map((z,i)=>`<button data-z="${z}" aria-pressed="${ppd===z}">${['−−','−','+','++'][i]}</button>`).join('')}</div></div>
 <div class="gantt" id="gantt">${ganttHTML()}</div></div>`;
 v.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{filters[b.dataset.f]=filters[b.dataset.f]===false;render()});
 v.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{const gEl=document.getElementById('gantt');const c=(gEl.scrollLeft+gEl.clientWidth/2)/ppd;ppd=+b.dataset.z;render();const g2=document.getElementById('gantt');g2.scrollLeft=c*ppd-g2.clientWidth/2});
 v.querySelector('#gantt').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)openDrawer(b.dataset.open,b.dataset.id)});
 watchStick();
 const gEl=v.querySelector('#gantt');if(!scrolled){scrolled=true;gEl.scrollLeft=Math.max(0,diff(START,TODAY)*ppd-gEl.clientWidth*0.35)}
}
function ganttHTML(){
 const days=diff(START,PEND)+1,W=days*ppd;const x=d=>diff(START,d)*ppd;const todayIn=TODAY>=START&&TODAY<=PEND;const tx=x(TODAY)+ppd/2;
 const mlines=[...Array(18)].map((_,m)=>`<div class="mline" style="left:${x(addMonths(START,m))}px"></div>`).join('');const tl=todayIn?`<div class="tline" style="left:${tx}px"></div>`:'';
 const head=`<div class="grow ghead"><div class="glabel"></div><div class="gtrack" style="width:${W}px">${[...Array(18)].map((_,m)=>{const s=addMonths(START,m),e=addMonths(START,m+1);return `<div class="mcell" style="left:${x(s)}px;width:${x(e)-x(s)}px"><b>${t('month')}${m+1}</b>${MON[lang][s.getMonth()]}’${String(s.getFullYear()).slice(2)}</div>`}).join('')}${todayIn?`<div class="tlabel" style="left:${tx}px;top:auto;bottom:1px">${esc(t('today'))}</div>`:''}</div></div>`;
 const rows=TRACKS.filter(tk=>tk.kind==='stages'||filters[tk.tag]!==false).map(tk=>{let inner='';
  if(tk.kind==='stages')inner=STAGES.map(s=>{const st=stageStatus(s);const w=x(addDays(s.end,1))-x(s.start)-2;return `<button class="gbar stagebar s-${st}" data-open="stage" data-id="${esc(s.id)}" style="left:${x(s.start)+1}px;width:${w}px" title="${esc(nm(s,'name'))}">${esc(t('stage'))} ${s.idx} · ${esc(nm(s,'name'))}</button>`}).join('');
  else if(tk.kind==='proc')inner=PROC.map(p=>`<button class="diamond s-${procStatus(p)}" data-open="proc" data-id="${esc(p.id)}" style="left:${x(monthEnd(p.due_month))+ppd/2}px" title="${esc(nm(p,'name'))} · ${fmt(monthEnd(p.due_month))}" aria-label="${esc(nm(p,'name'))}"></button>`).join('');
  else inner=G.filter(g=>g.track_id===tk.id).map(g=>{const st=status(g);const w=Math.max(6,(diff(g.start,g.end)+1)*ppd-2);const lab=w>26?esc(g.short||''):'';
   return `<button class="gbar s-${st}" data-open="g" data-id="${esc(g.id)}" style="left:${x(g.start)+1}px;width:${w}px" title="${esc(nm(g,'title'))} · ${fmtS(g.start)}–${fmtS(g.end)} · ${esc(t('st_'+st))}">${lab}</button>`}).join('');
  return `<div class="grow"><div class="glabel"><span class="tg">${esc(tk.tag)}</span><span class="nm">${esc(nm(tk,'name'))}</span><span class="sb">${esc(nm(tk,'sub')||'')}</span></div><div class="gtrack" style="width:${W}px">${mlines}${tl}${inner}</div></div>`}).join('');
 return `<div class="ginner" style="width:calc(${W}px + var(--label-w))">${head}${rows}</div>`;
}

/* ---------- drawer ---------- */
let drawer=null;const dr=document.getElementById('drawerRoot');
function closeDrawer(){drawer=null;dr.innerHTML=''}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer)closeDrawer()});
function openDrawer(kind,id){drawer=()=>{if(kind==='g')drawGroup(G.find(g=>g.id===id));else if(kind==='stage')drawStage(STAGES.find(s=>s.id===id));else drawProc(PROC.find(p=>p.id===id))};drawer()}
function shell(body){dr.innerHTML=`<div class="scrim" id="scrim"></div><aside class="drawer" role="dialog" aria-modal="true">${body}</aside>`;
 dr.querySelector('#scrim').onclick=closeDrawer;dr.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrawer);
 dr.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.open,b.dataset.id))}
const trackOf=id=>TRACKS.find(tk=>tk.id===id)||{};
function groupStats(g){
 if(g.type==='course'||g.type==='mobile'){const c=certOf(g),s=startedOf(g),e=num(g.facts.entry_avg),x=num(g.facts.exit_avg);
  return[[t('s_cert'),fmtN(c)+' / '+g.plan],[t('s_plan'),fmtPct(pct(c,g.plan))],[t('s_women'),fmtPct(pct(num(g.facts.cert_f)||0,c))],[t('s_rate'),fmtPct(pct(c,s))],[t('s_gain'),e!==null&&x!==null?'+'+(x-e)+(lang==='uk'?' п.п.':' pp'):'—'],[t('s_prac'),fmtPct(pct(num(g.facts.practical_pass)||0,s))]]}
 if(g.type==='intro'){const c=covOf(g);return[[t('s_cov'),fmtN(c)+' / '+g.plan],[t('s_women'),fmtPct(pct(num(g.facts.covered_f)||0,c))],[t('s_drill'),fmtPct(pct(num(g.facts.drill_pass)||0,c))]]}
 if(g.type==='event'){const p=partOf(g);return[[t('s_part'),fmtN(p)],[t('s_women'),fmtPct(pct(num(g.facts.part_f)||0,p))]]}
 return[];
}
function statusBlock(g){const st=status(g);const m=missing(g);const txt=st==='future'||st==='active'?esc(t('notEnded')):m.length?`<b>${esc(t('missItems'))}</b> ${m.map(esc).join('; ')}`:esc(t('noIssues'));
 return `<span class="pill p-${st}">${esc(t('st_'+st))}</span><div class="ro" style="margin-top:8px">${txt}</div>`}
const statsHTML=g=>groupStats(g).map(([k,v])=>`<div class="stat"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('');
function drawGroup(g){if(!g)return closeDrawer();const tk=trackOf(g.track_id),ed=canEdit(g),dis=ed?'':' disabled';const tp=TYPES[g.type]||{facts:[],docs:[]};
 const docs=tp.docs.map(d=>{const v=(g.docs[d]||'').trim();const pending=d==='survey612'&&TODAY<survDue(g);const ic=v?'ok':(pending||TODAY<=g.end)?'wait':'miss';
  return `<div class="doc"><div class="ic ${ic}">${{ok:'✓',miss:'!',wait:'·'}[ic]}</div><div class="dl">${esc(docLabel(d))}</div>
   <div class="row"><input class="inp url" data-doc="${d}" value="${esc(v)}" placeholder="${esc(t('paste'))}"${dis} aria-label="${esc(docLabel(d))}"><span data-lk="${d}">${isUrl(v)?`<a class="ext" href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(t('open'))} ↗</a>`:''}</span></div>
   ${pending?`<div class="hint">${esc(t('waitFrom'))} ${fmt(survDue(g))}</div>`:''}</div>`}).join('');
 shell(`<div class="dhead"><div><div class="meta"><span class="mono">${esc(tk.tag)}</span> · ${esc(nm(tk,'name'))}</div><h2>${esc(nm(g,'title'))}</h2><div class="meta num">${fmt(g.start)} – ${fmt(g.end)}${g.plan?` · ${esc(t('plan'))}: ${g.plan}`:''}</div></div><button class="xbtn" data-close>${esc(t('close'))}</button></div>
 <div id="stBlock">${statusBlock(g)}</div>${ed?'':`<div class="ro">${esc(t('readonly'))}</div>`}
 ${tp.facts.length?`<h3 class="ns" style="margin:0;text-transform:uppercase;letter-spacing:.07em">${esc(t('results'))}</h3>
 <div class="fgrid">${tp.facts.map(f=>`<label>${esc(t(f))}<input class="inp num" type="number" min="0" inputmode="numeric" data-fact="${f}" value="${g.facts[f]??''}"${dis}></label>`).join('')}</div>
 <div class="stats" id="stats">${statsHTML(g)}</div>`:''}
 <h3 class="ns" style="margin:0;text-transform:uppercase;letter-spacing:.07em">${esc(t('confirm'))}</h3><div>${docs}</div>`);
 const persist=()=>{dr.querySelector('#stBlock').innerHTML=statusBlock(g);const s=dr.querySelector('#stats');if(s)s.innerHTML=statsHTML(g);
  save(sb.from('groups').update({facts:g.facts,docs:g.docs}).eq('id',g.id));refreshView()};
 dr.querySelectorAll('[data-fact]').forEach(i=>i.onchange=()=>{if(i.value!==''&&+i.value<0)i.value=0;g.facts[i.dataset.fact]=i.value===''?null:Math.max(0,+i.value);persist()});
 dr.querySelectorAll('[data-doc]').forEach(i=>i.onchange=()=>{const d=i.dataset.doc;g.docs[d]=i.value.trim();const lk=dr.querySelector(`[data-lk="${d}"]`);lk.innerHTML=isUrl(g.docs[d])?`<a class="ext" href="${esc(g.docs[d])}" target="_blank" rel="noopener noreferrer">${esc(t('open'))} ↗</a>`:'';persist()});
}
function refreshView(){const v=document.getElementById('view');if(!v)return;const gEl=document.getElementById('gantt');const sl=gEl?gEl.scrollLeft:0;
 ({gantt:renderGantt,indicators:renderInd,procurement:renderProc,tasks:renderTasks,staff:renderStaff,users:renderUsers,log:()=>{}})[tab](v);const g2=document.getElementById('gantt');if(g2)g2.scrollLeft=sl}
function drawStage(s){const st=stageStatus(s);const inS=g=>g.start>=s.start&&g.start<=s.end;
 const rows=TRACKS.filter(tk=>tk.kind==='training'||tk.kind==='event').map(tk=>{const gs=G.filter(g=>g.track_id===tk.id&&inS(g));if(!gs.length)return'';const plan=gs.reduce((a,g)=>a+(g.plan||0),0);const f=gs.reduce((a,g)=>a+(g.type==='lecture'?((g.docs.video||'').trim()?1:0):factOf(g)),0);const pl=gs[0].type==='lecture'?gs.length:plan;
  return `<tr><td>${esc(nm(tk,'name'))}</td><td class="num">${gs.length}</td><td class="num">${pl?fmtN(pl):'—'}</td><td class="num">${fmtN(f)}${pl?`<div class="meter"><i style="width:${Math.min(100,f/pl*100)}%"></i></div>`:''}</td></tr>`}).join('');
 const late=G.filter(g=>inS(g)&&status(g)==='late');const lp=PROC.filter(p=>p.due_month>=s.month_from&&p.due_month<=s.month_to);
 shell(`<div class="dhead"><div><div class="meta mono">${esc(t('stage'))} ${s.idx} · ${t('month')}${s.month_from}${s.month_to!==s.month_from?'–'+s.month_to:''}</div><h2>${esc(nm(s,'name'))}</h2><div class="meta num">${fmt(s.start)} – ${fmt(s.end)}</div></div><button class="xbtn" data-close>${esc(t('close'))}</button></div>
 <span class="pill p-${st}" style="align-self:flex-start">${esc(t('st_'+st))}</span>
 <div class="tblwrap"><table><thead><tr><th>${esc(t('track'))}</th><th>${esc(t('groups'))}</th><th>${esc(t('plan'))}</th><th>${esc(t('fact'))}</th></tr></thead><tbody>${rows}</tbody></table></div>
 ${lp.length?`<div class="lategroups">${lp.map(p=>`<button data-open="proc" data-id="${esc(p.id)}" style="${procStatus(p)==='late'?'':'border-color:var(--line);background:var(--surface-2);color:var(--fg)'}">${esc(nm(p,'name'))} · ${esc(t('ps_'+p.status))}</button>`).join('')}</div>`:''}
 ${late.length?`<div class="ns">${esc(t('lateList'))}</div><div class="lategroups">${late.map(g=>`<button data-open="g" data-id="${esc(g.id)}">${esc(trackOf(g.track_id).tag)} · ${esc(nm(g,'title'))}</button>`).join('')}</div>`:''}`)}
function procControls(p){const dis=isAdmin()?'':' disabled';
 return {sel:`<select class="inp" data-pstatus="${esc(p.id)}"${dis} aria-label="${esc(t('th_status'))}">${['planned','ordered','paid','received'].map(s=>`<option value="${s}"${p.status===s?' selected':''}>${esc(t('ps_'+s))}</option>`).join('')}</select>`,
  link:`<div style="display:flex;gap:8px;align-items:center"><input class="inp url" data-plink="${esc(p.id)}" value="${esc(p.link)}" placeholder="${esc(t('paste'))}"${dis} aria-label="${esc(t('th_doc'))}">${isUrl(p.link)?`<a class="ext" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${esc(t('open'))} ↗</a>`:''}</div>`}}
function bindProc(root,after){root.querySelectorAll('[data-pstatus]').forEach(s=>s.onchange=()=>{const p=PROC.find(x=>x.id===s.dataset.pstatus);p.status=s.value;save(sb.from('procurement').update({status:p.status}).eq('id',p.id));after()});
 root.querySelectorAll('[data-plink]').forEach(s=>s.onchange=()=>{const p=PROC.find(x=>x.id===s.dataset.plink);p.link=s.value.trim();save(sb.from('procurement').update({link:p.link}).eq('id',p.id));after()})}
function drawProc(p){if(!p)return closeDrawer();const c=procControls(p);const st=procStatus(p);
 shell(`<div class="dhead"><div><div class="meta">${esc(t('tab_proc'))}</div><h2>${esc(nm(p,'name'))}</h2><div class="meta num">${esc(t('th_qty'))}: ${p.qty??'—'} · ${esc(t('th_due'))}: ${fmt(monthEnd(p.due_month))} (${t('month')}${p.due_month})</div></div><button class="xbtn" data-close>${esc(t('close'))}</button></div>
 <span class="pill p-${st}" style="align-self:flex-start">${esc(st==='late'?t('st_late'):t('ps_'+p.status))}</span>
 <div class="fgrid"><label>${esc(t('th_status'))}${c.sel}</label></div><label class="fl">${esc(t('th_doc'))}${c.link}</label>`);
 bindProc(dr,()=>{drawProc(p);refreshView()})}

/* ---------- indicators ---------- */
const fmOf=r=>{const f=r.fm||{};const g=k=>Math.max(0,Math.round(+f[k]||0));return{sf:g('sf'),af:Math.min(g('af'),g('sf')),sm:g('sm'),am:Math.min(g('am'),g('sm'))}};
function indValue(r,T){const uk=lang==='uk';const pp=uk?' п.п.':' pp';const src=r.source;
 if(src==='manual')return{v:r.value,txt:fmtN(r.value)};
 if(src==='manual2')return{v:r.value2,txt:`${fmtPct(r.value)} · ${fmtN(r.value2)}`};
 if(src==='survey_fm'){const F=fmOf(r);const n=F.sf+F.sm,a=F.af+F.am;const W=uk?'Ж':'F',M=uk?'Ч':'M',sv=uk?'опитано':'surveyed';
  return{v:n,p:pct(a,n),txt:`${fmtPct(pct(a,n))} · ${sv} ${fmtN(n)} (${W}: ${fmtPct(pct(F.af,F.sf))} · ${fmtN(F.sf)}; ${M}: ${fmtPct(pct(F.am,F.sm))} · ${fmtN(F.sm)})`}}
 const m=src.replace('auto:','');
 if(m==='sat')return{v:T.sat,txt:fmtPct(T.sat)};
 if(m==='cert')return{v:T.cert,txt:`${fmtN(T.cert)} · ${fmtPct(pct(T.cert,T.st))}`};
 if(m==='gain')return{v:T.gain,txt:T.gain===null?'—':'+'+(Math.round(T.gain*10)/10)+pp};
 if(m==='prac'){const v=pct(T.prac,T.st);return{v,txt:fmtPct(v)}}
 if(m==='drill'){const v=pct(T.introDrill,T.introCov);return{v,txt:fmtPct(v)}}
 if(m==='evpart')return{v:T.evPart,txt:fmtN(T.evPart)};
 if(m==='women')return{v:T.certF,txt:`${fmtPct(pct(T.certF,T.cert))} · ${fmtN(T.certF)}`};
 if(m==='gap'){const a=pct(T.certF,T.stF),b=pct(T.certM,T.stM);const g=a!==null&&b!==null?Math.abs(a-b):null;return{v:null,txt:g===null?'—':(Math.round(g*10)/10)+pp}}
 if(m.startsWith('track:')){const b=T.byTrack[m.slice(6)]||{fact:0};return{v:b.fact,txt:fmtN(b.fact)}}
 if(m==='online')return{v:T.lect+T.evHeld+T.press,txt:`${T.lect} / ${T.evHeld} / ${T.press}`};
 if(m==='kits')return{v:T.kits,txt:`${T.kits} · ${T.workshop?(uk?'так':'yes'):(uk?'ні':'no')}`};
 return{v:null,txt:'—'};
}
function renderInd(v){const T=totals();const ed=isAdmin();
 const levels=[['ult','lvl_ult'],['int','lvl_int'],['imm','lvl_imm'],['out','lvl_out']];
 const fmIn=r=>{const F=fmOf(r);const uk=lang==='uk';const ro=!ed;const box=k=>ro?`<span class="num">${fmtN((r.fm||{})[k]??null)}</span>`:`<input class="inp num narrow" type="number" min="0" step="1" data-fm="${esc(r.id)}" data-k="${k}" value="${(r.fm||{})[k]??''}" aria-label="${k}">`;
  const n=F.sf+F.sm,a=F.af+F.am;
  return `<div class="fmg"><span></span><span class="fmh">${uk?'опитано':'surveyed'}</span><span class="fmh">${uk?'з них застосовують':'of them apply'}</span><span class="fmh">%</span>
   <b>${uk?'Жінки':'Women'}</b>${box('sf')}${box('af')}<span class="num">${fmtPct(pct(F.af,F.sf))}</span>
   <b>${uk?'Чоловіки':'Men'}</b>${box('sm')}${box('am')}<span class="num">${fmtPct(pct(F.am,F.sm))}</span>
   <b class="fmt">${uk?'Загалом':'Total'}</b><span class="num fmt">${fmtN(n)}</span><span class="num fmt">${fmtN(a)}</span><span class="num fmt">${fmtPct(pct(a,n))}</span></div>`};
 const row=r=>{const man=r.source.startsWith('manual')||r.source==='survey_fm';const val=indValue(r,T);
  if(r.source==='survey_fm'){const tp=parseFloat(String(r.target||'').replace(/[^0-9.]/g,''))||70;return `<tr><td style="min-width:240px">${esc(nm(r,'label'))}</td><td class="num" style="white-space:nowrap">${esc(r.baseline||'')}</td><td class="num" style="white-space:nowrap">${esc(r.target||'')}</td><td style="min-width:300px">${fmIn(r)}${r.target_num&&r.target_num!==tp?meter(val.v||0,r.target_num):meter(val.p||0,100,tp)}</td><td style="white-space:nowrap">${esc(t(r.freq))}</td><td>${ed?`<div style="display:flex;gap:6px;align-items:center;min-width:200px"><input class="inp url" data-il="${esc(r.id)}" value="${esc(r.link)}" placeholder="Google Doc" aria-label="link">${isUrl(r.link)?`<a class="ext" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">↗</a>`:''}</div>`:(isUrl(r.link)?`<a class="ext" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(t('open'))} ↗</a>`:'—')}</td></tr>`}
  const cur=man&&ed?(r.source==='manual2'?`<input class="inp num narrow" type="number" min="0" max="100" step="any" data-iv="${esc(r.id)}" data-pct="1" value="${r.value??''}" aria-label="%"> % · <input class="inp num narrow" type="number" min="0" step="1" data-iv2="${esc(r.id)}" value="${r.value2??''}" aria-label="n">`:`<input class="inp num narrow" type="number" min="0" step="any" data-iv="${esc(r.id)}" value="${r.value??''}" aria-label="value">`):`<span class="num">${esc(val.txt)}</span>`;
  const src=man?(ed?`<div style="display:flex;gap:6px;align-items:center;min-width:200px"><input class="inp url" data-il="${esc(r.id)}" value="${esc(r.link)}" placeholder="Google Doc" aria-label="link">${isUrl(r.link)?`<a class="ext" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">↗</a>`:''}</div>`:(isUrl(r.link)?`<a class="ext" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(t('open'))} ↗</a>`:'—')):`<span class="pill p-muted">${esc(r.source==='auto:kits'?t('fromProc'):t('auto'))}</span>`;
  return `<tr><td style="min-width:240px">${esc(nm(r,'label'))}</td><td class="num" style="white-space:nowrap">${esc(r.baseline||'')}</td><td class="num" style="white-space:nowrap">${esc(r.target||'')}</td><td style="min-width:150px">${cur}${val.v!==null&&val.v!==undefined&&r.target_num?meter(val.v||0,r.target_num):''}</td><td style="white-space:nowrap">${esc(t(r.freq))}</td><td>${src}</td></tr>`};
 v.innerHTML=`<section class="panel"><h2>${esc(t('tab_ind'))}</h2><p class="lead">${esc(t('ind_lead'))}</p><div class="tblwrap"><table><thead><tr><th>${esc(t('th_ind'))}</th><th>${esc(t('th_base'))}</th><th>${esc(t('th_target'))}</th><th>${esc(t('th_cur'))}</th><th>${esc(t('th_freq'))}</th><th>${esc(t('th_src'))}</th></tr></thead><tbody>
 ${levels.map(([lv,k])=>{const rs=IND.filter(r=>r.level===lv);return rs.length?`<tr class="lvl"><td colspan="6">${esc(t(k))}</td></tr>${rs.map(row).join('')}`:''}).join('')}</tbody></table></div></section>`;
 const upd=(id,patch)=>{const r=IND.find(x=>x.id===id);Object.assign(r,patch);save(sb.from('indicators').update(patch).eq('id',id)).then(()=>renderInd(v))};
 const clamp=(i,max)=>{if(i.value==='')return null;let x=Math.max(0,+i.value||0);if(max)x=Math.min(max,x);i.value=x;return x};
 v.querySelectorAll('[data-iv]').forEach(i=>i.onchange=()=>upd(i.dataset.iv,{value:clamp(i,i.dataset.pct?100:0)}));
 v.querySelectorAll('[data-fm]').forEach(i=>i.onchange=()=>{const r=IND.find(x=>x.id===i.dataset.fm);const f=Object.assign({},r.fm||{});f[i.dataset.k]=i.value===''?null:Math.max(0,Math.round(+i.value||0));
  if(f.af!=null&&f.sf!=null&&f.af>f.sf)f.af=f.sf;if(f.am!=null&&f.sm!=null&&f.am>f.sm)f.am=f.sm;upd(r.id,{fm:f})});
 v.querySelectorAll('[data-iv2]').forEach(i=>i.onchange=()=>upd(i.dataset.iv2,{value2:clamp(i)===null?null:Math.round(+i.value)}));
 v.querySelectorAll('[data-il]').forEach(i=>i.onchange=()=>upd(i.dataset.il,{link:i.value.trim()}));
}

/* ---------- procurement ---------- */
function renderProc(v){
 v.innerHTML=`<section class="panel"><h2>${esc(t('tab_proc'))}</h2><p class="lead">${esc(t('proc_lead'))}</p><div class="tblwrap"><table><thead><tr><th>${esc(t('th_item'))}</th><th>${esc(t('th_qty'))}</th><th>${esc(t('th_due'))}</th><th>${esc(t('th_status'))}</th><th>${esc(t('th_doc'))}</th></tr></thead><tbody>
 ${PROC.map(p=>{const c=procControls(p);const st=procStatus(p);return `<tr><td style="min-width:200px"><div style="font-weight:500">${esc(nm(p,'name'))}</div><span class="pill p-${st}" style="margin-top:4px">${esc(st==='late'?t('st_late'):st==='done'?t('ps_received'):t('st_future'))}</span></td><td class="num">${p.qty??'—'}</td><td class="num" style="white-space:nowrap">${fmt(monthEnd(p.due_month))}<div class="ns">${t('month')}${p.due_month}</div></td><td style="min-width:140px">${c.sel}</td><td style="min-width:260px">${c.link}</td></tr>`}).join('')}
 </tbody></table></div></section>`;bindProc(v,()=>renderProc(v))}

/* ---------- admin tasks ---------- */
function renderTasks(v){const fr={every:t('every'),monthly:t('monthly'),q:t('q'),sem:t('sem')};
 const taskRow=x=>{const dueD=x.due_month?monthEnd(x.due_month):null;const od=dueD&&!x.done&&TODAY>dueD;
  return `<div class="task ${x.done?'done':''}"><input type="checkbox" id="tk-${esc(x.id)}" data-tk="${esc(x.id)}" ${x.done?'checked':''}><label class="tt" for="tk-${esc(x.id)}">${esc(nm(x,'title'))}</label>
  <div class="tm">${dueD?`<span class="pill ${od?'p-late':x.done?'p-done':'p-muted'}">${esc(t('due'))} ${fmt(dueD)} · ${t('month')}${x.due_month}${od?' · '+esc(t('overdue')):''}</span>`:''}${x.freq?`<span class="pill p-muted">${esc(fr[x.freq]||x.freq)}</span>`:''}
  <input class="inp url" data-tl="${esc(x.id)}" value="${esc(x.link)}" placeholder="${esc(t('paste'))}" aria-label="link">${isUrl(x.link)?`<a class="ext" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${esc(t('open'))} ↗</a>`:''}</div></div>`};
 const sec=k=>{const xs=TASKS.filter(x=>x.section===k);const d=xs.filter(x=>x.done).length;
  return `<section class="panel"><h2>${esc(t('sec_'+k))} <span class="num ns">${d}/${xs.length}</span></h2><div>${xs.map(taskRow).join('')}</div>${k==='custom'?`<form class="addrow" id="addForm"><input class="inp" id="newTask" placeholder="${esc(t('addPh'))}" aria-label="${esc(t('addPh'))}"><button class="btn" type="submit">${esc(t('add'))}</button></form>`:''}</section>`};
 v.innerHTML=`<div class="cols">${sec('launch')}<div style="display:flex;flex-direction:column;gap:16px">${sec('cycle')}${sec('period')}${sec('close')}${sec('custom')}</div></div>`;
 const upd=(id,patch)=>{const x=TASKS.find(y=>y.id===id);Object.assign(x,patch);save(sb.from('admin_tasks').update(patch).eq('id',id)).then(()=>renderTasks(v))};
 v.querySelectorAll('[data-tk]').forEach(c=>c.onchange=()=>upd(c.dataset.tk,{done:c.checked}));
 v.querySelectorAll('[data-tl]').forEach(c=>c.onchange=()=>upd(c.dataset.tl,{link:c.value.trim()}));
 v.querySelector('#addForm').onsubmit=async e=>{e.preventDefault();const val=v.querySelector('#newTask').value.trim();if(!val)return;
  const row={id:'u'+Date.now(),section:'custom',title_uk:val,title_en:val,sort:1000+TASKS.length};if(await save(sb.from('admin_tasks').insert(row))){TASKS.push({...row,done:false,link:''});renderTasks(v)}};
}

/* ---------- staff ---------- */
const DOCS=[['nda',{uk:'NDA',en:'NDA'},{uk:'NDA',en:'NDA'}],['sec',{uk:'Безпека',en:'Security'},{uk:'Безп.',en:'Sec.'}],['resp',{uk:'Обов’язки',en:'Duties'},{uk:'Обов.',en:'Duties'}]];
const LVN={1:{uk:'Рівень 1 · керівництво',en:'Level 1 · management'},2:{uk:'Рівень 2 · напрями',en:'Level 2 · branches'},3:{uk:'Рівень 3 · виконання',en:'Level 3 · delivery'},4:{uk:'Рівень 4 · виконавці',en:'Level 4 · staff'}};
let staffView='auto',staffZoom=null,staffZoomCur=1;const staffOpen=new Set();
const posOf=id=>POS.find(o=>o.id===id);
const slotsOf=id=>SLOTS.filter(s=>s.position_id===id).sort((a,b)=>a.idx-b.idx);
const docOk=(s,k)=>!!(s[k]&&isUrl(s[k+'_link']));
function slotState(s){if(s.off)return'off';if(!(s.nick||'').trim())return'vacant';return DOCS.every(([k])=>docOk(s,k))?'ok':'partial'}
const slotLabel=(o,i)=>o.multi?nm(o,'slot')+' '+(i+1):nm(o,'name');
function stText(s){const uk=lang==='uk';const st=slotState(s);if(st==='off')return uk?'Вимкнено':'Disabled';if(st==='vacant')return uk?'Вакансія':'Vacant';if(st==='ok')return uk?'На посаді':'In position';return(uk?'Бракує: ':'Missing: ')+DOCS.filter(([k])=>!docOk(s,k)).map(d=>n(d[1])).join(', ')}
const stPill=st=>({ok:'p-done',partial:'p-late',vacant:'p-muted',off:'p-muted'})[st];
const marks=s=>`<span class="mks">${DOCS.map(([k,l,sh])=>`<span class="mk${docOk(s,k)?' on':''}" title="${esc(n(l))}">${docOk(s,k)?'✓ ':''}${esc(n(sh))}</span>`).join('')}</span>`;
const linkify=x=>esc(x).replace(/https:\/\/[^\s<]+/g,u=>`<a class="ext" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
function staffTotals(){let all=0,ok=0,nda=0,sec=0,resp=0;const vac={1:[],2:[],3:[],4:[]};POS.forEach(o=>slotsOf(o.id).forEach((s,i)=>{if(s.off)return;all++;const st=slotState(s);if(st==='ok')ok++;if(st==='vacant')(vac[o.level]||(vac[o.level]=[])).push(slotLabel(o,i));if(docOk(s,'nda'))nda++;if(docOk(s,'sec'))sec++;if(docOk(s,'resp'))resp++}));return{all,ok,nda,sec,resp,vac}}
function staffSummary(){const T=staffTotals();const uk=lang==='uk';const nv=Object.values(T.vac).reduce((a,l)=>a+l.length,0);
 const tile=(k,v,a)=>`<div class="tile${a&&v>=a?' full':' alert'}"><div class="k">${esc(k)}</div><div class="v num">${v} <small>${t('of')} ${a}</small></div>${meter(v,a)}</div>`;
 return `<div class="stick" id="pageStick"><div class="tiles">${tile(uk?'Посади укомплектовано':'Positions staffed',T.ok,T.all)}${tile('NDA',T.nda,T.all)}${tile(uk?'Безпека':'Security',T.sec,T.all)}${tile(uk?'Обов’язки підписано':'Duties signed',T.resp,T.all)}</div></div>
 ${nv?`<div class="vac"><div class="vh">${uk?'Вакантні посади':'Vacant positions'} · ${nv}</div>${[1,2,3,4].filter(l=>(T.vac[l]||[]).length).map(l=>`<div class="vl"><div class="vlh">${esc(n(LVN[l]))}</div><div>${T.vac[l].map(esc).join(', ')}</div></div>`).join('')}</div>`:''}`}
const BW=196,CH=96,HG=16,VG=44,VS=20,SG=8,STI=18,SIDEG=32;
const bySort=(a,b)=>(a.sort??0)-(b.sort??0);
const kidsOf=o=>POS.filter(c=>c.parent===o.id&&!c.side).sort(bySort);
const allKids=o=>POS.filter(c=>c.parent===o.id).sort(bySort);
const isChain=o=>{const k=allKids(o);return k.length<=1&&k.every(isChain)};
const MKL={nda:{uk:'N',en:'N'},sec:{uk:'Б',en:'S'},resp:{uk:'О',en:'D'}};
function posAgg(o){const act=slotsOf(o.id).filter(s=>!s.off);const filled=act.filter(s=>(s.nick||'').trim()).length;const ok=act.filter(s=>slotState(s)==='ok').length;
 const docs={};DOCS.forEach(([k])=>docs[k]=act.filter(s=>docOk(s,k)).length);
 const st=!act.length?'off':ok===act.length?'ok':filled?'partial':'vacant';return{act,filled,ok,docs,st}}
function cardMarks(o){if(o.multi){const A=posAgg(o);const tot=A.act.length;return `<span class="mks">${DOCS.map(([k,l])=>{const c=A.docs[k];const cls=tot&&c===tot?' on':c?' part':'';return `<span class="mk${cls}" title="${esc(n(l))}: ${c} ${t('of')} ${tot}">${esc(n(MKL[k]))}</span>`}).join('')}</span>`}
 const s=slotsOf(o.id)[0];if(!s||s.off)return'';return `<span class="mks">${DOCS.map(([k,l])=>`<span class="mk${docOk(s,k)?' on':''}" title="${esc(n(l))}${docOk(s,k)?' ✓':''}">${esc(n(MKL[k]))}</span>`).join('')}</span>`}
function cardHTML(o,x,y,w){const uk=lang==='uk';let st,val,data;
 if(o.multi){const A=posAgg(o);st=A.st;val=`<span class="cnt">${A.filled} ${t('of')} ${A.act.length}</span>`;data=`data-pid="${esc(o.id)}"`}
 else{const s=slotsOf(o.id)[0];if(!s){st='vacant';val=esc(uk?'Немає місця':'No slot');data=`data-pid="${esc(o.id)}"`}else{st=slotState(s);val=esc(st==='off'?(uk?'Вимкнено':'Disabled'):st==='vacant'?(uk?'Вакансія':'Vacant'):s.nick);data=`data-sid="${s.id}"`}}
 return `<button class="pbox st-${st}" ${data} style="left:${x}px;top:${y}px;width:${w}px;height:${CH}px"><span class="pr">${esc(nm(o,'name'))}</span><span class="pb"><span class="pn">${val}</span>${cardMarks(o)}</span></button>`}
function layout(cols){cols=cols||1;const out=[];let d='';const root=POS.find(o=>!o.parent);if(!root)return{out,d,TW:0,TH:0};
 const units=o=>{const ks=kidsOf(o);const leaves=ks.filter(c=>!kidsOf(c).length);if(leaves.length<2)return ks.map(c=>({c}));const u=[];let put=false;ks.forEach(c=>{if(kidsOf(c).length)u.push({c});else if(!put){put=true;u.push({leaves})}});return u};
 const uw=u=>u.leaves?STI+BW:wid(u.c);
 const wid=o=>{const us=units(o);if(!us.length)return BW;return Math.max(BW,us.reduce((a,u)=>a+uw(u),0)+HG*(us.length-1))};
 function place(o,x,y){const w=wid(o);const cx=x+w/2;out.push({o,x:cx-BW/2,y,w:BW});const ks=kidsOf(o);
  if(ks.length===1){place(ks[0],x,y+CH+VS);d+=`M${cx} ${y+CH}V${y+CH+VS}`}
  else if(ks.length){const us=units(o);const by=y+CH+VG/2,cy=y+CH+VG;let xx=x+(w-(us.reduce((a,u)=>a+uw(u),0)+HG*(us.length-1)))/2;const cxs=[];
   us.forEach(u=>{const cw=uw(u);if(u.leaves){cxs.push(xx);let yy=cy;u.leaves.forEach((c,i)=>{if(i)yy+=CH+SG;out.push({o:c,x:xx+STI,y:yy,w:BW});d+=`M${xx} ${yy+CH/2}H${xx+STI}`});d+=`M${xx} ${cy}V${yy+CH/2}`}else{cxs.push(xx+cw/2);place(u.c,xx,cy)}xx+=cw+HG});
   d+=`M${cx} ${y+CH}V${by}M${Math.min(cx,...cxs)} ${by}H${Math.max(cx,...cxs)}`;cxs.forEach(c=>d+=`M${c} ${by}V${cy}`)}}
 // stacked column: a chain of positions, each indented under the previous
 function stack(o,x,y,depth){out.push({o,x:x+depth*STI,y,w:BW});let yy=y+CH;
  allKids(o).forEach(c=>{const ny=yy+SG;const lx=x+depth*STI+10;d+=`M${lx} ${y+CH}V${ny+CH/2}H${x+(depth+1)*STI}`;yy=stack(c,x,ny,depth+1)});return yy}
 const mains=kidsOf(root);const wide=mains.filter(o=>!isChain(o)),comb=mains.filter(o=>isChain(o));
 const y1=CH+VG;let x=0;const tops=[];
 wide.forEach(o=>{const w=wid(o);tops.push(x+w/2);place(o,x,y1);x+=w+HG});
 const spines=[];
 if(comb.length){const depth=o=>1+Math.max(0,...allKids(o).map(depth));const cnt=o=>1+allKids(o).reduce((a,c)=>a+cnt(c),0);
  const groups=[[]];if(cols>1){const tot=comb.reduce((a,o)=>a+cnt(o),0);let acc=0;comb.forEach(o=>{if(acc>=tot/2&&groups.length<2)groups.push([]);groups[groups.length-1].push(o);acc+=cnt(o)})}else groups[0]=comb.slice();
  let cx0=x+(wide.length?0:0);groups.forEach(g=>{if(!g.length)return;const sx=cx0;let yy=y1;let dep=1;
   g.forEach((o,i)=>{const ty=i?yy+SG:yy;d+=`M${sx} ${ty+CH/2}H${sx+STI}`;yy=stack(o,sx,ty,1);dep=Math.max(dep,depth(o))});
   const last=out.filter(b=>g.includes(b.o)).pop();spines.push([sx,last.y+CH/2]);tops.push(sx);cx0=sx+STI*dep+BW+HG});
  x=cx0-HG}
 const mainW=Math.max(comb.length?x:x-HG,BW);const rx=Math.max(0,mainW/2-BW/2);out.push({o:root,x:rx,y:0,w:BW});const rcx=rx+BW/2;
 if(tops.length){const by=CH+VG/2;d+=`M${rcx} ${CH}V${by}M${Math.min(rcx,...tops)} ${by}H${Math.max(rcx,...tops)}`;
  wide.forEach((o,i)=>d+=`M${tops[i]} ${by}V${y1}`);
  spines.forEach(([sx,ly])=>d+=`M${sx} ${by}V${ly}`)}
 let TW=Math.max(mainW,rx+BW);
 POS.filter(o=>o.side&&o.parent===root.id).sort(bySort).forEach(sd=>{const sx=TW+SIDEG;d+=`M${rx+BW} ${CH/2}H${sx}`;
  out.push({o:sd,x:sx,y:0,w:BW});let yy=CH;let px=sx+BW/2;
  const down=(o,yTop)=>{allKids(o).forEach(c=>{const ny=Math.max(yTop+CH+VS,y1);d+=`M${px} ${yTop+CH}V${ny}`;out.push({o:c,x:sx,y:ny,w:BW});down(c,ny)})};down(sd,0);TW=sx+BW});
 const TH=Math.max(...out.map(b=>b.y+CH));return{out,d,TW,TH}}
function treeHTML(v){const avail=Math.max(320,v.clientWidth-30);const st=document.getElementById('pageStick');const sh=st?Math.min(st.offsetHeight,70):60;const vh=window.innerHeight-sh-70;
 const cand=[1,2].map(c=>{const L=layout(c);const wf=avail/(L.TW||1),hf=vh/(L.TH||1);return{L,wf,hf,full:Math.min(1.12,wf,hf)}});
 let pick=cand.reduce((a,b)=>b.full>a.full?b:a);let fit=pick.full;if(fit<.8){pick=cand[0];fit=Math.min(1.12,pick.wf,Math.max(pick.hf,.9))}const Lo=pick.L;const z=staffZoom==null||staffZoom==='fit'?fit:staffZoom;let boxes='';
 Lo.out.forEach(({o,x,y,w})=>boxes+=cardHTML(o,x,y,w));
 return {z,html:`<div class="tw" id="treeWrap"><div style="width:${Lo.TW*z}px;height:${Lo.TH*z}px;position:relative"><div class="tc" style="width:${Lo.TW}px;height:${Lo.TH}px;transform:scale(${z})"><svg class="tl" width="${Lo.TW}" height="${Lo.TH}" aria-hidden="true"><path d="${Lo.d}"/></svg>${boxes}</div></div></div>`}}
function mkLegend(){const uk=lang==='uk';return `<div class="mklegend">${DOCS.map(([k,l])=>`<span><span class="mk on">${esc(n(MKL[k]))}</span>${esc(n(l))}</span>`).join('')}<span>${uk?'зелене — є, контур — немає, жовтий контур — частково':'green — done, outline — missing, yellow outline — partly'}</span></div>`}
function listHTML(){const root=POS.find(o=>!o.parent);if(root&&!staffOpen.size)staffOpen.add(root.id);
 const node=o=>{const ks=POS.filter(c=>c.parent===o.id).sort((a,b)=>(b.side?1:0)-(a.side?1:0));const sl=slotsOf(o.id);const act=sl.filter(s=>!s.off);const ok=act.filter(s=>slotState(s)==='ok').length;
  return `<details class="fold" data-fold="${esc(o.id)}"${staffOpen.has(o.id)?' open':''}><summary><span class="fn">${esc(nm(o,'name'))}</span><span class="fc num">${ok}/${act.length}</span></summary><div class="fb">
   ${sl.map((s,i)=>{const st=slotState(s);return `<button class="lrow st-${st}" data-sid="${s.id}"><span class="ln">${esc(s.nick&&!s.off?s.nick:slotLabel(o,i))}</span><span class="pill ${stPill(st)}">${esc(stText(s))}</span>${st==='off'?'':marks(s)}</button>`}).join('')}
   ${o.multi?`<button class="ladd" data-addslot="${esc(o.id)}">+ ${esc(nm(o,'slot'))}</button>`:''}${ks.map(node).join('')}</div></details>`};
 return root?`<div class="flist">${node(root)}</div>`:''}
const staffMode=()=>staffView==='auto'?(window.innerWidth>=900?'tree':'list'):staffView;
function renderStaff(v){const uk=lang==='uk';const mode=staffMode();const tw=document.getElementById('treeWrap');const sc=tw?[tw.scrollLeft,tw.scrollTop]:null;
 v.innerHTML=`<div class="stw">${staffSummary()}
 <div class="sbar"><p class="lead">${uk?'Лише позивні, без справжніх імен. Натисніть на посаду, щоб відкрити картку.':'Nicknames only, no real names. Click a position to open its card.'}</p>
 <div class="sctl">${mode==='tree'?'':''}<div class="seg" role="group"><button data-view="tree" aria-pressed="${mode==='tree'}">${uk?'Дерево':'Tree'}</button><button data-view="list" aria-pressed="${mode==='list'}">${uk?'Список':'List'}</button></div>
 ${mode==='tree'?`<div class="seg" role="group" aria-label="Zoom"><button data-zoom="-">−</button><button data-zoom="fit">${uk?'Вмістити':'Fit'}</button><button data-zoom="+">+</button></div>`:''}</div></div>${mode==='tree'?mkLegend():''}<div id="staffBody"></div></div>`;
 const body=v.querySelector('#staffBody');
 if(mode==='tree'){const T=treeHTML(body);body.innerHTML=T.html;staffZoomCur=T.z;const w=document.getElementById('treeWrap');if(sc){w.scrollLeft=sc[0];w.scrollTop=sc[1]}}else body.innerHTML=listHTML();
 v.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{staffView=b.dataset.view;renderStaff(v)});
 v.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{const z=b.dataset.zoom;staffZoom=z==='fit'?'fit':Math.max(.4,Math.min(1.4,Math.round((staffZoomCur+(z==='+'?.1:-.1))*10)/10));renderStaff(v)});
 v.querySelectorAll('.pbox,.lrow').forEach(b=>b.onclick=()=>b.dataset.pid?openPos(b.dataset.pid):openSlot(b.dataset.sid));
 watchStick();
 v.querySelectorAll('[data-addslot]').forEach(b=>b.onclick=async()=>{const pid=b.dataset.addslot;const idx=slotsOf(pid).reduce((a,s)=>Math.max(a,s.idx),-1)+1;
  const {data,error}=await sb.from('staff_slots').insert({position_id:pid,idx}).select().single();if(error){toast(t('saveErr')+error.message,true);return}SLOTS.push(data);renderStaff(v)});
 v.querySelectorAll('details.fold').forEach(d=>d.addEventListener('toggle',()=>{d.open?staffOpen.add(d.dataset.fold):staffOpen.delete(d.dataset.fold)}));
}
function refreshStaff(){if(tab==='staff'){const v=document.getElementById('view');if(v)renderStaff(v)}}
function openSlot(sid,from){drawer=()=>drawSlot(sid,from);drawer()}
function openPos(pid){drawer=()=>drawPos(pid);drawer()}
function drawPos(pid){const o=posOf(pid);if(!o)return closeDrawer();const uk=lang==='uk';const par=posOf(o.report_to||o.parent);const A=posAgg(o);
 shell(`<div class="dhead"><div><div class="meta">${esc(n(LVN[o.level]))}${par?' · '+(uk?'звітує: ':'reports to: ')+esc(nm(par,'name')):''}</div><h2>${esc(nm(o,'name'))}</h2><div class="meta">${uk?'Зайнято':'Filled'} ${A.filled} ${t('of')} ${A.act.length} · ${uk?'повністю оформлено':'fully documented'} ${A.ok}</div></div><button class="xbtn" data-close>${esc(t('close'))}</button></div>
 <div class="plist">${slotsOf(o.id).map((s,i)=>{const st=slotState(s);return `<button class="lrow st-${st}" data-sid="${s.id}"><span class="ln">${esc(s.nick&&!s.off?s.nick:slotLabel(o,i))}</span><span class="pill ${stPill(st)}">${esc(stText(s))}</span>${st==='off'?'':marks(s)}</button>`}).join('')}
 <button class="ladd" data-addslot="${esc(o.id)}">+ ${esc(nm(o,'slot')||(uk?'Місце':'Slot'))}</button></div>`);
 dr.querySelectorAll('.lrow').forEach(b=>b.onclick=()=>openSlot(b.dataset.sid,pid));
 dr.querySelectorAll('[data-addslot]').forEach(b=>b.onclick=async()=>{const idx=slotsOf(pid).reduce((a,s)=>Math.max(a,s.idx),-1)+1;
  const {data,error}=await sb.from('staff_slots').insert({position_id:pid,idx}).select().single();if(error){toast(t('saveErr')+error.message,true);return}SLOTS.push(data);refreshStaff();drawPos(pid)})}
let stickBound=false;function watchStick(){const upd=()=>{const el=document.getElementById('pageStick');if(!el)return;const was=el.classList.contains('stuck');const vw0=document.getElementById('view');if(!was){el.dataset.fh=el.offsetHeight;if(vw0)vw0.style.minHeight=Math.ceil(el.parentElement.getBoundingClientRect().top-vw0.getBoundingClientRect().top+window.innerHeight-24)+'px'}const now=el.getBoundingClientRect().top<=0.5&&window.scrollY>40;if(now!==was)el.classList.toggle('stuck',now)};
 if(!stickBound){stickBound=true;window.addEventListener('scroll',upd,{passive:true});window.addEventListener('resize',()=>{if(tab==='staff'&&staffZoom==null)refreshStaff()})}upd()}
const slotTimers={};
function saveSlot(s,patch,now){Object.assign(s,patch);const key=s.id+Object.keys(patch).join();clearTimeout(slotTimers[key]);const go=()=>save(sb.from('staff_slots').update(patch).eq('id',s.id));if(now)go();else slotTimers[key]=setTimeout(go,700)}
async function openTemplate(o){const w=window.open('','_blank');const {data,error}=await sb.storage.from('templates').createSignedUrl(o.template,3600);
 if(error||!data){if(w)w.close();toast((lang==='uk'?'Шаблон не знайдено у сховищі: ':'Template not found in storage: ')+o.template,true);return}
 if(w)w.location=data.signedUrl;else location.href=data.signedUrl}
function drawSlot(sid,from){const s=SLOTS.find(x=>x.id===sid);if(!s)return closeDrawer();const o=posOf(s.position_id);const i=slotsOf(o.id).indexOf(s);const uk=lang==='uk';const par=posOf(o.report_to||o.parent);const st=slotState(s);
 shell(`<div class="dhead"><div><div class="meta">${esc(n(LVN[o.level]))}${par?' · '+(uk?'звітує: ':'reports to: ')+esc(nm(par,'name')):''}</div><h2>${esc(slotLabel(o,i))}</h2>${o.multi?`<div class="meta">${esc(nm(o,'name'))}</div>`:''}</div><div style="display:flex;gap:6px">${from?`<button class="xbtn" data-back>← ${esc(nm(o,'name'))}</button>`:''}<button class="xbtn" data-close>${esc(t('close'))}</button></div></div>
 <span class="pill ${stPill(st)}" id="sdSt" style="align-self:flex-start">${esc(stText(s))}</span>
 <label class="fl">${uk?'Позивний':'Nickname'}<input class="inp" id="sd-nick" value="${esc(s.nick)}" placeholder="${esc(slotLabel(o,i))}"></label>
 <div class="sdocs">${DOCS.map(([k,l])=>`<div class="dr"><label><input type="checkbox" data-k="${k}"${s[k]?' checked':''}> ${esc(n(l))}</label><input class="inp url" data-l="${k}" value="${esc(s[k+'_link'])}" placeholder="${uk?'Посилання на документ':'Document link'}" aria-label="${esc(n(l))}"><span data-lk="${k}">${isUrl(s[k+'_link'])?`<a class="ext" href="${esc(s[k+'_link'])}" target="_blank" rel="noopener noreferrer">↗</a>`:''}</span></div>`).join('')}</div>
 <div class="tplbox"><div class="fl">${uk?'Посадові обов’язки цієї посади':'Duties for this position'}</div><button class="btn" id="sd-tpl">${uk?'Відкрити шаблон (PDF)':'Open template (PDF)'} ↗</button><div class="ns">${uk?'Відкрийте, збережіть або роздрукуйте, підпишіть і завантажте підписаний документ. Посилання на нього вставте в поле «Обов’язки» вище.':'Open, save or print, sign, then upload the signed copy and paste its link into the Duties field above.'}</div></div>
 <div class="offbox"><label class="offl"><input type="checkbox" id="sd-off"${s.off?' checked':''}> ${uk?'Посада вимкнена (не потрібна)':'Position disabled (not needed)'}</label>
 <label class="fl">${uk?'Коментар: хто виконує обов’язки, посилання на документ за потреби':'Comment: who takes over the duties, document link if needed'}<textarea class="inp" id="sd-note" rows="3">${esc(s.note)}</textarea></label><div class="notev" id="sdNote">${/https:\/\//.test(s.note||'')?linkify(s.note):''}</div></div>
 ${o.multi?`<button class="btn warn" id="sd-del" style="align-self:flex-start">${uk?'Прибрати це місце':'Remove this slot'}</button>`:''}`);
 if(from){const bb=dr.querySelector('[data-back]');if(bb)bb.onclick=()=>openPos(from)}
 const qd=x=>dr.querySelector(x);
 const upd=()=>{const p=qd('#sdSt');if(p){const s2=slotState(s);p.className='pill '+stPill(s2);p.textContent=stText(s)}refreshStaff()};
 qd('#sd-nick').addEventListener('input',e=>{saveSlot(s,{nick:e.target.value.trim()});upd()});
 dr.querySelectorAll('[data-k]').forEach(c=>c.addEventListener('change',()=>{saveSlot(s,{[c.dataset.k]:c.checked},true);upd()}));
 dr.querySelectorAll('[data-l]').forEach(c=>c.addEventListener('input',()=>{const k=c.dataset.l;saveSlot(s,{[k+'_link']:c.value.trim()});const lk=dr.querySelector(`[data-lk="${k}"]`);lk.innerHTML=isUrl(s[k+'_link'])?`<a class="ext" href="${esc(s[k+'_link'])}" target="_blank" rel="noopener noreferrer">↗</a>`:'';upd()}));
 qd('#sd-tpl').onclick=()=>openTemplate(o);
 qd('#sd-off').addEventListener('change',e=>{saveSlot(s,{off:e.target.checked},true);upd()});
 qd('#sd-note').addEventListener('input',e=>{saveSlot(s,{note:e.target.value});qd('#sdNote').innerHTML=/https:\/\//.test(s.note)?linkify(s.note):'';upd()});
 const del=qd('#sd-del');if(del)del.onclick=async()=>{if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent=uk?'Точно прибрати? Натисніть ще раз':'Really remove? Click again';return}
  if(await save(sb.from('staff_slots').delete().eq('id',s.id))){SLOTS=SLOTS.filter(x=>x.id!==s.id);closeDrawer();refreshStaff()}};
}
let staffRT;window.addEventListener('resize',()=>{clearTimeout(staffRT);staffRT=setTimeout(()=>{if(tab==='staff'&&(staffView==='auto'||staffZoom==null||staffZoom==='fit'))refreshStaff()},200)});

/* ---------- users ---------- */
function renderUsers(v){const uk=lang==='uk';const tr=TRACKS.filter(tk=>tk.kind==='training'||tk.kind==='event');
 v.innerHTML=`<section class="panel"><h2>${esc(t('tab_users'))}</h2><p class="lead">${uk?'Нових користувачів запрошуйте в Supabase: Authentication → Users → Invite user. Після першого входу людина з’явиться тут з роллю «Глядач». Користувач редагує лише позначені треки.':'Invite new users in Supabase: Authentication → Users → Invite user. After the first sign-in they appear here as Viewer. A user edits only the ticked tracks.'}</p>
 <div class="tblwrap"><table class="utbl"><thead><tr><th>${uk?'Пошта':'Email'}</th><th>${uk?'Позивний':'Nickname'}</th><th>${uk?'Роль':'Role'}</th><th>${uk?'Треки (для ролі «Користувач»)':'Tracks (for User role)'}</th><th>${uk?'Активний':'Active'}</th></tr></thead><tbody>
 ${PROFILES.map(p=>`<tr data-uid="${p.id}"><td>${esc(p.email)}</td><td><input class="inp" type="text" data-u="nickname" value="${esc(p.nickname||'')}"></td>
  <td><select class="inp" data-u="role"${p.id===USER.id?' disabled':''}>${['admin','user','viewer'].map(r=>`<option value="${r}"${p.role===r?' selected':''}>${esc(t('role_'+r))}</option>`).join('')}</select></td>
  <td><div class="trk">${tr.map(tk=>`<label><input type="checkbox" data-ut="${esc(tk.id)}"${(p.tracks||[]).includes(tk.id)?' checked':''}> ${esc(nm(tk,'name'))}</label>`).join('')}</div></td>
  <td><input type="checkbox" data-u="active"${p.active?' checked':''}${p.id===USER.id?' disabled':''}></td></tr>`).join('')}
 </tbody></table></div></section>`;
 v.querySelectorAll('tr[data-uid]').forEach(row=>{const p=PROFILES.find(x=>x.id===row.dataset.uid);
  row.querySelectorAll('[data-u]').forEach(el=>el.onchange=()=>{const f=el.dataset.u;const val=el.type==='checkbox'?el.checked:el.value.trim();p[f]=val;save(sb.from('profiles').update({[f]:val}).eq('id',p.id))});
  row.querySelectorAll('[data-ut]').forEach(el=>el.onchange=()=>{p.tracks=[...row.querySelectorAll('[data-ut]:checked')].map(x=>x.dataset.ut);save(sb.from('profiles').update({tracks:p.tracks}).eq('id',p.id))})});
}

/* ---------- change log ---------- */
let LOG=[],logFilter={who:'',tbl:''};
const TBL={uk:{profiles:'Користувачі',settings:'Налаштування',tracks:'Треки',stages:'Етапи',groups:'Групи',procurement:'Закупівлі',indicators:'Показники',admin_tasks:'Задачі',positions:'Посади',staff_slots:'Персонал'},en:{profiles:'Users',settings:'Settings',tracks:'Tracks',stages:'Phases',groups:'Groups',procurement:'Procurement',indicators:'Indicators',admin_tasks:'Tasks',positions:'Positions',staff_slots:'Staff'}};
function flat(o,pre=''){const r={};if(!o)return r;Object.keys(o).forEach(k=>{const v=o[k];if(v&&typeof v==='object'&&!Array.isArray(v))Object.assign(r,flat(v,pre+k+'.'));else r[pre+k]=v});return r}
function changes(e){const a=flat(e.old_data),b=flat(e.new_data);const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>!['updated_at','created_at'].includes(k)&&JSON.stringify(a[k])!==JSON.stringify(b[k]));
 return keys.map(k=>({k,o:a[k],n:b[k]}))}
const sval=v=>v===null||v===undefined||v===''?'∅':Array.isArray(v)?v.join(', '):String(v);
function objName(e){const d=e.new_data||e.old_data||{};if(e.tbl==='groups'){const g=G.find(x=>x.id===e.row_id);return g?nm(g,'title'):e.row_id}if(e.tbl==='staff_slots'){const o=posOf(d.position_id);return o?(nm(o,'name')+(d.nick?' · '+d.nick:'')):e.row_id}
 return d.title_uk||d.name_uk||d.label_uk||d.email||e.row_id}
async function renderLog(v){v.innerHTML=`<div class="loading">…</div>`;
 const {data,error}=await sb.from('audit_log').select('*').order('id',{ascending:false}).limit(500);if(error){v.innerHTML=`<div class="ro">${esc(error.message)}</div>`;return}LOG=data||[];drawLog(v)}
function drawLog(v){const uk=lang==='uk';const whos=[...new Set(LOG.map(e=>e.actor_email||'—'))];const tbls=[...new Set(LOG.map(e=>e.tbl))];
 const rows=LOG.filter(e=>(!logFilter.who||(e.actor_email||'—')===logFilter.who)&&(!logFilter.tbl||e.tbl===logFilter.tbl));
 v.innerHTML=`<section class="panel"><h2>${esc(t('tab_log'))}</h2><p class="lead">${uk?'Кожна зміна даних: хто, коли, що було і що стало. Останні 500 записів. Записи не можна змінити чи видалити.':'Every data change: who, when, before and after. Last 500 entries. Entries cannot be edited or deleted.'}</p>
 <div class="addrow"><select class="inp" id="lw" style="max-width:260px"><option value="">${uk?'Усі користувачі':'All users'}</option>${whos.map(w=>`<option${logFilter.who===w?' selected':''}>${esc(w)}</option>`).join('')}</select>
 <select class="inp" id="lt" style="max-width:220px"><option value="">${uk?'Усі розділи':'All sections'}</option>${tbls.map(x=>`<option value="${esc(x)}"${logFilter.tbl===x?' selected':''}>${esc(TBL[lang][x]||x)}</option>`).join('')}</select>
 <button class="btn sec" id="lcsv">${uk?'Вивантажити CSV':'Export CSV'}</button></div>
 <div class="tblwrap"><table class="logtbl"><thead><tr><th>${uk?'Коли':'When'}</th><th>${uk?'Хто':'Who'}</th><th>${uk?'Розділ':'Section'}</th><th>${uk?'Об’єкт':'Object'}</th><th>${uk?'Зміни':'Changes'}</th></tr></thead><tbody>
 ${rows.map(e=>`<tr><td class="num" style="white-space:nowrap">${fmtDT(e.at)}</td><td>${esc(e.actor_email||'—')}</td><td>${esc(TBL[lang][e.tbl]||e.tbl)} · ${esc(e.action)}</td><td>${esc(objName(e))}</td><td class="chg">${e.action==='update'?changes(e).map(c=>`${esc(c.k)}: <del>${esc(sval(c.o))}</del> → <ins>${esc(sval(c.n))}</ins>`).join('<br>'):esc(e.action)}</td></tr>`).join('')}
 </tbody></table></div></section>`;
 v.querySelector('#lw').onchange=e=>{logFilter.who=e.target.value;drawLog(v)};v.querySelector('#lt').onchange=e=>{logFilter.tbl=e.target.value;drawLog(v)};
 v.querySelector('#lcsv').onclick=()=>{const head=['at','actor','table','action','object','changes'];const lines=[head.join(',')].concat(rows.map(e=>[fmtDT(e.at),e.actor_email||'',e.tbl,e.action,objName(e),e.action==='update'?changes(e).map(c=>`${c.k}: ${sval(c.o)} -> ${sval(c.n)}`).join('; '):''].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')));
  download(new Blob(['﻿'+lines.join('\n')],{type:'text/csv'}),'zhurnal_zmin.csv')};
}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

/* ---------- export ---------- */
async function exportXlsx(){if(!window.XLSX){toast('XLSX library not loaded',true);return}
 const uk=lang==='uk';const T=totals();const wb=XLSX.utils.book_new();const add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name);
 add(uk?'Етапи':'Phases',STAGES.map(s=>{const gs=G.filter(g=>g.start>=s.start&&g.start<=s.end);return{[uk?'Етап':'Phase']:s.idx,[uk?'Назва':'Name']:nm(s,'name'),[uk?'Початок':'Start']:fmt(s.start),[uk?'Кінець':'End']:fmt(s.end),[uk?'Статус':'Status']:t('st_'+stageStatus(s)),[uk?'Груп':'Groups']:gs.length,[uk?'Навчено (сертифіковано / охоплено)':'Trained']:gs.reduce((a,g)=>a+(g.type==='event'?0:factOf(g)),0),[uk?'Жінок':'Women']:gs.reduce((a,g)=>a+(num(g.facts.cert_f)||0)+(num(g.facts.covered_f)||0),0)}}));
 const allFacts=[...new Set(Object.values(TYPES).flatMap(x=>x.facts))],allDocs=[...new Set(Object.values(TYPES).flatMap(x=>x.docs))];
 add(uk?'Групи':'Groups',G.map(g=>{const r={[uk?'Трек':'Track']:nm(trackOf(g.track_id),'name'),[uk?'Група':'Group']:nm(g,'title'),[uk?'Початок':'Start']:fmt(g.start),[uk?'Кінець':'End']:fmt(g.end),[uk?'План':'Plan']:g.plan,[uk?'Статус':'Status']:t('st_'+status(g))};allFacts.forEach(f=>r[t(f)]=g.facts[f]??'');allDocs.forEach(d=>r[docLabel(d)]=g.docs[d]||'');return r}));
 add(uk?'Показники':'Indicators',IND.map(r=>({[t('th_ind')]:nm(r,'label'),[t('th_base')]:r.baseline,[t('th_target')]:r.target,[t('th_cur')]:indValue(r,T).txt,[t('th_src')]:r.link||''})));
 add(uk?'Закупівлі':'Procurement',PROC.map(p=>({[t('th_item')]:nm(p,'name'),[t('th_qty')]:p.qty,[t('th_due')]:fmt(monthEnd(p.due_month)),[t('th_status')]:t('ps_'+p.status),[t('th_doc')]:p.link})));
 add(uk?'Задачі':'Tasks',TASKS.map(x=>({[uk?'Розділ':'Section']:t('sec_'+x.section),[uk?'Задача':'Task']:nm(x,'title'),[uk?'Виконано':'Done']:x.done?'✓':'',[uk?'Посилання':'Link']:x.link})));
 add(uk?'Персонал':'Staff',POS.flatMap(o=>slotsOf(o.id).map((s,i)=>({[uk?'Посада':'Position']:slotLabel(o,i),[uk?'Позивний':'Nickname']:s.nick,[uk?'Статус':'Status']:stText(s),NDA:s.nda_link,[uk?'Безпека':'Security']:s.sec_link,[uk?'Обов’язки':'Duties']:s.resp_link,[uk?'Коментар':'Comment']:s.note}))));
 const stamp=new Date();XLSX.writeFile(wb,`status_${stamp.getFullYear()}-${p2(stamp.getMonth()+1)}-${p2(stamp.getDate())}.xlsx`);
 const iso=stamp.toISOString();if(await save(sb.from('settings').upsert({key:'last_export',value:iso}))){SETTINGS.last_export=iso;render()}}

start();
})();
