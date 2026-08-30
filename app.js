const $=x=>document.getElementById(x);
const F=["prospect_name","policy_id","customer_id","customer_country","global_country","sales_manager","broker","broker_contact","offer_deadline","policy_start_date","precheck","acceptance_rate","key_account_underwriter","opportunity_type","prospect_remarks","status","currency","fx_rate_to_eur","insurable_turnover_original","insurable_turnover","premium_rate","expected_premium_original","expected_premium","premium_principle","closed_date"];
let R=[],S=null,on=false,COMPANIES=[],DOCS_BY_OPPORTUNITY={},DASH_DRILL=null;

const n=v=>Number(String(v??"").trim().replace(/\s/g,"").replace(",", "."))||0;
const fmt=v=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n(v)).replace(/,/g," ");
const pct=v=>n(String(v).replace("%",""));
const moneyInt=v=>Math.round(n(v));
const moneyText=(v,currency="EUR")=>`${currency||"EUR"} ${fmt(v)}`;
const parseMoneyInput=v=>Math.round(Number(String(v??"").replace(/\s/g,"").replace(/[^0-9\-]/g,""))||0);
function formatMoneyField(el){
  if(!el)return;
  const raw=String(el.value||"").trim();
  if(raw===""){el.value="";return}
  el.value=fmt(parseMoneyInput(raw));
}
const days=d=>d?Math.ceil((new Date(d+"T00:00:00")-new Date(new Date().toDateString()))/86400000):null;
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const uniq=k=>[...new Set(R.map(x=>x[k]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
const statusLower=r=>String(r.status||"").toLowerCase();
const ACTIVE_PIPELINE_STATUSES=new Set(["open","lead","precheck","quoting","offer submitted","negotiation","ongoing"]);
const isPipelineOpen=r=>ACTIVE_PIPELINE_STATUSES.has(statusLower(r));

async function init(){
  try{
    S=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
    let x=await S.from("prospects").select("*").order("created_at",{ascending:false});
    if(x.error)throw x.error;
    R=x.data||[];
    let c=await S.from("companies").select("*");
    COMPANIES=c.error?[]:(c.data||[]);
    let docs=await S.from("opportunity_documents").select("id,opportunity_id,document_type,description,file_path,file_name,created_at").order("created_at",{ascending:false});
    DOCS_BY_OPPORTUNITY={};
    if(!docs.error){
      (docs.data||[]).forEach(d=>{
        (DOCS_BY_OPPORTUNITY[d.opportunity_id]??=[]).push(d);
      });
    }
    on=true;$("mode").textContent="Shared online database";
  }catch(e){
    console.warn(e);R=JSON.parse(localStorage.gpm||"[]");$("mode").textContent="Local demo mode";
  }
  opts();render();table();
}
function setSelect(id,a,label){let el=$(id);if(!el)return;let old=el.value;el.innerHTML=`<option value="">${label}</option>`+a.map(x=>`<option>${esc(x)}</option>`).join("");if([...el.options].some(o=>o.value===old))el.value=old}
function setList(id,a){let el=$(id);if(el)el.innerHTML=a.map(x=>`<option value="${esc(x)}">`).join("")}
function opts(){
  let countries=uniq("customer_country"),globals=uniq("global_country"),managers=uniq("sales_manager"),brokers=uniq("broker"),statuses=uniq("status");
  setSelect("df",countries,"All customer countries");setSelect("gf",globals,"All global countries");setSelect("mf",managers,"All Sales Managers");setSelect("bf",brokers,"All brokers");setSelect("sf",statuses,"All statuses");
  setSelect("ptStatus",statuses,"All statuses");setSelect("ptCountry",countries,"All countries");setSelect("ptManager",managers,"All managers");setSelect("ptBroker",brokers,"All brokers");
  setList("prospectsList",[...new Set([...uniq("prospect_name"),...COMPANIES.map(c=>c.company_name).filter(Boolean)])].sort());
  setList("policiesList",uniq("policy_id"));
  setList("customerIdsList",uniq("customer_id"));
  setList("countriesList",countries);setList("globalsList",globals);setList("managersList",managers);setList("brokersList",brokers);setList("contactsList",uniq("broker_contact"));setList("kauList",uniq("key_account_underwriter"));
}
function filtered(){
  let a=[...R];
  [["df","customer_country"],["gf","global_country"],["mf","sales_manager"],["bf","broker"],["sf","status"]].forEach(([id,k])=>{if($(id)?.value)a=a.filter(r=>String(r[k]||"")===$(id).value)});
  let f=$("deadlinef")?.value;if(f==="overdue")a=a.filter(r=>isPipelineOpen(r)&&days(r.offer_deadline)<0);else if(f==="none")a=a.filter(r=>!r.offer_deadline);else if(f)a=a.filter(r=>{let d=days(r.offer_deadline);return d!==null&&d>=0&&d<=Number(f)});
  return a;
}
function group(a,k){let o={};a.forEach(r=>{let x=r[k]||"Not set";o[x]=(o[x]||0)+1});return o}
function renderBars(id,obj,field){let el=$(id),entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...entries.map(x=>x[1]));el.innerHTML=entries.length?entries.map(([k,v])=>`<div class="bar clickable" role="button" tabindex="0" data-k="${esc(k)}"><span>${esc(k)}</span><div class="track"><div class="fill" style="width:${v/mx*100}%"></div></div><b>${v}</b></div>`).join(""):"<p>No data</p>";if(field)el.querySelectorAll(".bar").forEach(x=>{const go=()=>openDashboardDrill("field",{field,value:x.dataset.k,label:x.dataset.k});x.onclick=go;x.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}}})}
function render(){
  let a=filtered();
  $("total").textContent=a.length;$("open").textContent=a.filter(x=>statusLower(x)==="open").length;$("won").textContent=a.filter(x=>statusLower(x)==="won").length;$("lost").textContent=a.filter(x=>statusLower(x)==="lost").length;$("overdue").textContent=a.filter(x=>statusLower(x)==="open"&&days(x.offer_deadline)<0).length;$("due7").textContent=a.filter(x=>{let d=days(x.offer_deadline);return statusLower(x)==="open"&&d!==null&&d>=0&&d<=7}).length;$("premium").textContent=moneyText(a.reduce((s,x)=>s+n(x.expected_premium),0),"EUR");$("turnover").textContent=moneyText(a.reduce((s,x)=>s+n(x.insurable_turnover),0),"EUR");
  renderBars("countries",group(a,"customer_country"),"customer_country");renderBars("managers",group(a,"sales_manager"),"sales_manager");renderBars("brokers",group(a,"broker"),"broker");renderBars("statuses",group(a,"status"),"status");
  let dl=a.filter(r=>isPipelineOpen(r)&&days(r.offer_deadline)!==null&&days(r.offer_deadline)<=30).sort((x,y)=>days(x.offer_deadline)-days(y.offer_deadline)).slice(0,20);
  $("deadlineBody").innerHTML=dl.map(r=>`<tr class="deadline-click" role="button" tabindex="0" data-id="${esc(r.id)}"><td data-col-key="Prospect name"><b>${esc(r.prospect_name)}</b></td><td data-col-key="Customer country">${esc(r.customer_country)}</td><td data-col-key="Sales Manager">${esc(r.sales_manager)}</td><td data-col-key="Offer deadline">${esc(r.offer_deadline)}</td><td class="${days(r.offer_deadline)<0?"late":""}">${days(r.offer_deadline)}</td><td data-col-key="Status">${esc(r.status)}</td><td data-col-key="Expected premium EUR">${moneyText(r.expected_premium,"EUR")}</td></tr>`).join("");
  $("deadlineBody").querySelectorAll(".deadline-click").forEach(row=>{const go=()=>openDashboardDrill("id",{id:row.dataset.id,label:"Selected prospect"});row.onclick=go;row.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}}});
}
function prospectFiltered(){
  let q=$("search").value.toLowerCase().trim(),a=R.filter(r=>!q||Object.values(r).some(v=>String(v??"").toLowerCase().includes(q)));
  if(DASH_DRILL?.ids){const ids=new Set(DASH_DRILL.ids.map(String));a=a.filter(r=>ids.has(String(r.id)))}
  [["ptStatus","status"],["ptCountry","customer_country"],["ptManager","sales_manager"],["ptBroker","broker"]].forEach(([id,k])=>{if($(id)?.value)a=a.filter(r=>String(r[k]||"")===$(id).value)});
  return a;
}
function table(){
  let a=prospectFiltered();
  $("body").innerHTML=a.map(r=>{
    const fileCount=(DOCS_BY_OPPORTUNITY[r.id]||[]).length;
    const fileCell=fileCount
      ? `<button class="file-icon-btn" title="${fileCount} file${fileCount===1?"":"s"}" onclick="openFiles('${r.id}')">📎 <span>${fileCount}</span></button>`
      : `<span class="no-files" title="No files">—</span>`;
    const statusClass=(()=>{const s=statusLower(r);if(s==="won")return"prospect-won";if(s==="lost")return"prospect-lost";if(isPipelineOpen(r))return"prospect-open";return"prospect-neutral"})();
    return `<tr class="${statusClass}"><td data-col-key="Actions" class="actions-cell"><button onclick="edit('${r.id}')">Edit</button> <button onclick="del('${r.id}')">Delete</button></td><td data-col-key="Files" class="files-cell">${fileCell}</td><td data-col-key="Prospect name"><b>${esc(r.prospect_name)}</b></td><td data-col-key="Policy ID">${esc(r.policy_id)}</td><td data-col-key="Customer ID">${esc(r.customer_id)}</td><td data-col-key="Customer country">${esc(r.customer_country)}</td><td data-col-key="Global country">${esc(r.global_country)}</td><td data-col-key="Sales Manager">${esc(r.sales_manager)}</td><td data-col-key="Broker">${esc(r.broker)}</td><td data-col-key="Broker contact">${esc(r.broker_contact)}</td><td data-col-key="Offer deadline">${esc(r.offer_deadline)}</td><td data-col-key="Policy start date">${esc(r.policy_start_date)}</td><td data-col-key="Days left" class="${days(r.offer_deadline)<0?"late":""}">${days(r.offer_deadline)??""}</td><td data-col-key="Precheck">${esc(r.precheck)}</td><td data-col-key="Acceptance rate">${r.acceptance_rate!==null&&r.acceptance_rate!==undefined&&r.acceptance_rate!==""?pct(r.acceptance_rate).toFixed(1)+"%":""}</td><td data-col-key="KAU">${esc(r.key_account_underwriter)}</td><td data-col-key="Opportunity type">${esc(r.opportunity_type)}</td><td data-col-key="Remarks" class="rem">${esc(r.prospect_remarks)}</td><td data-col-key="Status">${esc(r.status)}</td><td data-col-key="Currency">${esc(r.currency||"EUR")}</td><td data-col-key="Insurable turnover">${fmt(r.insurable_turnover_original ?? r.insurable_turnover)}</td><td data-col-key="Turnover EUR">${moneyText(r.insurable_turnover,"EUR")}</td><td data-col-key="Premium rate">${r.premium_rate?n(r.premium_rate).toFixed(3)+"%":""}</td><td data-col-key="Expected premium">${moneyText(r.expected_premium_original ?? r.expected_premium,r.currency||"EUR")}</td><td data-col-key="Expected premium EUR">${moneyText(r.expected_premium,"EUR")}</td><td data-col-key="Premium principle">${esc(r.premium_principle)}</td></tr>`;
  }).join("");
  alignBodyToHeader();
}

function dashboardDrillSet(type,payload={}){
  let a=filtered(),label="Dashboard selection";

  if(type==="open"){a=a.filter(r=>isPipelineOpen(r));label="Open";}
  else if(type==="won"){a=a.filter(r=>statusLower(r)==="won");label="Won";}
  else if(type==="lost"){a=a.filter(r=>statusLower(r)==="lost");label="Lost";}
  else if(type==="overdue"){a=a.filter(r=>isPipelineOpen(r)&&days(r.offer_deadline)<0);label="Overdue";}
  else if(type==="due7"){a=a.filter(r=>{let d=days(r.offer_deadline);return isPipelineOpen(r)&&d!==null&&d>=0&&d<=7});label="Due within 7 days";}
  else if(type==="field"){
    a=a.filter(r=>String(r[payload.field]||"Not set")===String(payload.value));
    const names={customer_country:"Customer country",sales_manager:"Sales Manager",broker:"Broker",status:"Status"};
    label=`${names[payload.field]||payload.field}: ${payload.label||payload.value}`;
  } else if(type==="id"){
    a=a.filter(r=>String(r.id)===String(payload.id));
    label=payload.label||"Selected prospect";
  } else {
    label="All prospects in current dashboard view";
  }

  return {ids:a.map(r=>String(r.id)),label};
}

function openDashboardDrill(type,payload={}){
  DASH_DRILL=dashboardDrillSet(type,payload);

  // Clear the independent Prospects controls, so the user sees exactly the dashboard selection.
  if($("search"))$("search").value="";
  ["ptStatus","ptCountry","ptManager","ptBroker"].forEach(id=>{if($(id))$(id).value=""});

  updateDrillBanner();
  show("pros");
  table();
  $("pros")?.scrollIntoView({behavior:"smooth",block:"start"});
}

function updateDrillBanner(){
  const b=$("drillBanner");
  if(!b)return;
  if(!DASH_DRILL){b.hidden=true;return}
  b.hidden=false;
  $("drillTitle").textContent=DASH_DRILL.label;
  $("drillCount").textContent=` - ${DASH_DRILL.ids.length} prospect${DASH_DRILL.ids.length===1?"":"s"}`;
}

window.clearDashboardDrill=()=>{
  DASH_DRILL=null;
  updateDrillBanner();
  table();
};

function initDashboardClicks(){
  document.querySelectorAll(".kpi-click").forEach(card=>{
    const go=()=>openDashboardDrill(card.dataset.drill||"total");
    card.addEventListener("click",go);
    card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}});
  });
}


const BOARD_STAGES=["Lead","Precheck","Quoting","Offer submitted","Negotiation","Won","Lost"];
function normalizeBoardStage(status){
 const s=String(status||"").trim().toLowerCase();
 const map={"lead":"Lead","precheck":"Precheck","quoting":"Quoting","offer submitted":"Offer submitted","negotiation":"Negotiation","won":"Won","lost":"Lost"};
 return map[s]||"Lead";
}
function populateBoardFilters(){
 const fill=(id,vals,label)=>{const e=$(id);if(!e)return;const cur=e.value;e.innerHTML=`<option value="">${label}</option>`+[...new Set(vals.filter(Boolean))].sort().map(v=>`<option>${esc(v)}</option>`).join("");if([...e.options].some(o=>o.value===cur))e.value=cur};
 fill("boardCountry",R.map(r=>r.customer_country),"All countries");fill("boardManager",R.map(r=>r.sales_manager),"All Sales Managers");fill("boardBroker",R.map(r=>r.broker),"All brokers");
}
function boardRows(){let a=[...R],c=$("boardCountry")?.value||"",m=$("boardManager")?.value||"",b=$("boardBroker")?.value||"";if(c)a=a.filter(r=>r.customer_country===c);if(m)a=a.filter(r=>r.sales_manager===m);if(b)a=a.filter(r=>r.broker===b);return a}
function boardCard(r){
 const d=days(r.offer_deadline),cl=d!==null&&d<0?" board-card-overdue":d!==null&&d<=7?" board-card-soon":"",files=(DOCS_BY_OPPORTUNITY[r.id]||[]).length;
 return `<article class="board-card${cl}" draggable="true" data-id="${esc(r.id)}" tabindex="0"><div class="board-card-top"><b>${esc(r.prospect_name||"Unnamed prospect")}</b>${files?`<span>📎 ${files}</span>`:""}</div><div class="board-card-country">${esc(r.customer_country||"")}</div><div class="board-card-premium">${moneyText(r.expected_premium||0,"EUR")}</div><div class="board-card-meta">${[r.offer_deadline?`Deadline ${esc(r.offer_deadline)}`:"",r.policy_start_date?`Start ${esc(r.policy_start_date)}`:""].filter(Boolean).join(" · ")}</div><div class="board-card-meta">${[r.broker,r.sales_manager].filter(Boolean).map(esc).join(" · ")}</div></article>`;
}
function renderBoard(){
 const root=$("pipelineBoard");if(!root)return;populateBoardFilters();const grouped=Object.fromEntries(BOARD_STAGES.map(s=>[s,[]]));
 boardRows().forEach(r=>grouped[normalizeBoardStage(r.status)].push(r));
 const mode=$("boardSort")?.value||localStorage.getItem("gpmBoardSort")||"premium";
 if($("boardSort"))$("boardSort").value=mode;
 root.innerHTML=BOARD_STAGES.map(stage=>{const a=grouped[stage].sort((x,y)=>{
   if(mode==="manual"){
     const xo=Number.isFinite(Number(x.board_order))?Number(x.board_order):999999;
     const yo=Number.isFinite(Number(y.board_order))?Number(y.board_order):999999;
     return xo-yo || n(y.expected_premium)-n(x.expected_premium);
   }
   if(mode==="deadline") return (x.offer_deadline||"9999").localeCompare(y.offer_deadline||"9999") || n(y.expected_premium)-n(x.expected_premium);
   return n(y.expected_premium)-n(x.expected_premium) || (x.offer_deadline||"9999").localeCompare(y.offer_deadline||"9999");
 }),total=a.reduce((s,r)=>s+n(r.expected_premium),0),cl=stage==="Won"?" board-col-won":stage==="Lost"?" board-col-lost":"";
 return `<section class="board-column${cl}" data-stage="${stage}"><header><div><b>${stage}</b><span>${a.length}</span></div><small>${moneyText(total,"EUR")}</small></header><div class="board-dropzone">${a.map(boardCard).join("")||'<div class="board-empty">Drop opportunity here</div>'}</div></section>`}).join("");
 root.querySelectorAll(".board-card").forEach(c=>{
   c.onclick=()=>edit(c.dataset.id);
   c.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();edit(c.dataset.id)}};
   c.ondragstart=e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",c.dataset.id);c.classList.add("board-dragging")};
   c.ondragend=()=>{c.classList.remove("board-dragging");root.querySelectorAll(".board-drop-before").forEach(x=>x.classList.remove("board-drop-before"))};
   c.ondragover=e=>{e.preventDefault();e.stopPropagation();c.classList.add("board-drop-before")};
   c.ondragleave=()=>c.classList.remove("board-drop-before");
   c.ondrop=async e=>{
     e.preventDefault();e.stopPropagation();c.classList.remove("board-drop-before");
     const draggedId=e.dataTransfer.getData("text/plain");
     if(!draggedId||draggedId===c.dataset.id)return;
     await moveOpportunityToPosition(draggedId,c.closest(".board-column").dataset.stage,c.dataset.id);
   };
 });
 root.querySelectorAll(".board-column").forEach(col=>{
   col.ondragover=e=>{e.preventDefault();col.classList.add("board-dragover")};
   col.ondragleave=e=>{if(!col.contains(e.relatedTarget))col.classList.remove("board-dragover")};
   col.ondrop=async e=>{
     if(e.target.closest(".board-card"))return;
     e.preventDefault();col.classList.remove("board-dragover");
     const id=e.dataTransfer.getData("text/plain");
     if(id)await moveOpportunityToPosition(id,col.dataset.stage,null);
   };
 });
}
async function persistBoardOrder(stage,orderedIds){
  orderedIds.forEach((id,i)=>{
    const r=R.find(x=>String(x.id)===String(id));
    if(r)r.board_order=i+1;
  });
  if(on){
    const results=await Promise.all(orderedIds.map((id,i)=>S.from("prospects").update({board_order:i+1,updated_at:new Date().toISOString()}).eq("id",id)));
    const bad=results.find(x=>x.error);
    if(bad?.error)throw bad.error;
  }else localStorage.setItem("prospects",JSON.stringify(R));
}

async function moveOpportunityToPosition(id,stage,beforeId=null){
  const r=R.find(x=>String(x.id)===String(id));if(!r)return;
  const oldStatus=r.status,oldClosed=r.closed_date;
  const oldOrders=new Map(R.map(x=>[String(x.id),x.board_order]));

  r.status=stage;
  r.closed_date=(stage==="Won"||stage==="Lost")?new Date().toISOString().slice(0,10):null;

  // Switch automatically to Manual whenever the user explicitly reorders cards.
  localStorage.setItem("gpmBoardSort","manual");
  if($("boardSort"))$("boardSort").value="manual";

  const stageRows=R.filter(x=>normalizeBoardStage(x.status)===stage && String(x.id)!==String(id))
    .sort((a,b)=>{
      const ao=Number.isFinite(Number(a.board_order))?Number(a.board_order):999999;
      const bo=Number.isFinite(Number(b.board_order))?Number(b.board_order):999999;
      return ao-bo || n(b.expected_premium)-n(a.expected_premium);
    });

  let pos=beforeId?stageRows.findIndex(x=>String(x.id)===String(beforeId)):-1;
  if(pos<0)pos=stageRows.length;
  stageRows.splice(pos,0,r);

  try{
    if(on){
      const x=await S.from("prospects").update({status:r.status,closed_date:r.closed_date,updated_at:new Date().toISOString()}).eq("id",id);
      if(x.error)throw x.error;
    }
    await persistBoardOrder(stage,stageRows.map(x=>String(x.id)));
  }catch(err){
    r.status=oldStatus;r.closed_date=oldClosed;
    R.forEach(x=>x.board_order=oldOrders.get(String(x.id)));
    alert("Could not update board order: "+(err.message||err));
  }
  renderBoard();render();
}

window.boardSortChanged=()=>{
  const mode=$("boardSort")?.value||"premium";
  localStorage.setItem("gpmBoardSort",mode);
  renderBoard();
};
window.renderBoard=renderBoard;

function resetDashboardFilters(){["df","gf","mf","bf","sf","deadlinef"].forEach(id=>{if($(id))$(id).value=""});render()}
function show(x){$("dash").hidden=x!=="dash";$("pros").hidden=x!=="pros"}
async function openForm(){ $("form").reset();$("id").value="";$("status").value="Open";$("opportunity_type").value="New Business";$("currency").value="EUR";$("fx_rate_to_eur").value="1";if($("fx_info"))$("fx_info").textContent="EUR base currency";$("docsLocked").hidden=false;$("docsArea").hidden=true;$("documentsList").innerHTML="";$("reminder_amount").value="2";$("reminder_unit").value="days";$("reminder_time").value="09:00";$("reminder_note").value="";dlg.showModal();updateReminderPreview()}
function calc(){
  const originalRaw=$("insurable_turnover_original").value.trim();
  const rateRaw=$("premium_rate").value.trim();
  const fx=n($("fx_rate_to_eur").value)||0;
  const currency=$("currency").value||"EUR";

  if(originalRaw){
    formatMoneyField($("insurable_turnover_original"));
  }

  const originalTurnover=parseMoneyInput($("insurable_turnover_original").value);
  const eurTurnover=Math.round(originalTurnover*fx);

  $("insurable_turnover").value=originalRaw&&fx ? fmt(eurTurnover) : "";

  if(!originalRaw||!rateRaw){
    $("expected_premium_original").value="";
    $("expected_premium").value="";
    return;
  }

  const originalPremium=Math.round(originalTurnover*pct(rateRaw)/100);
  const eurPremium=Math.round(originalPremium*fx);

  $("expected_premium_original").value=fmt(originalPremium);
  $("expected_premium").value=fx ? fmt(eurPremium) : "";
}

window.currencyChanged=async ()=>{
  const c=$("currency").value||"EUR";
  $("fx_rate_to_eur").value=c==="EUR" ? "1" : "";
  if(c==="EUR"){
    if($("fx_info")) $("fx_info").textContent="EUR base currency";
    calc();return
  }
  $("fx_rate_to_eur").placeholder="Loading latest FX...";$("fx_rate_to_eur").value="";
  try{
    const res=await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(c)}/EUR`);
    if(!res.ok)throw new Error(`FX service error ${res.status}`);
    const data=await res.json();
    const rate=data?.rate;
    if(!rate)throw new Error("No EUR rate returned");
    $("fx_rate_to_eur").value=Number(rate).toFixed(6);
    $("fx_rate_to_eur").placeholder="1.000000";
    if($("fx_info")) $("fx_info").textContent=`Indicative market rate${data?.date ? " - "+data.date : ""}`;
    calc();
  }catch(e){
    console.warn("Automatic FX lookup failed",e);
    $("fx_rate_to_eur").value="";
    $("fx_rate_to_eur").placeholder="Enter FX manually";
    if($("fx_info")) $("fx_info").textContent="Automatic FX unavailable - enter an indicative rate manually";
    calc();
  }
};

async function ensureCompany(r){
  if(!on)return null;
  let query=S.from("companies").select("*").limit(1);
  if(r.customer_id)query=query.eq("customer_id",r.customer_id);
  else query=query.ilike("company_name",r.prospect_name).eq("customer_country",r.customer_country||"");
  let found=await query;
  if(!found.error&&found.data?.length)return found.data[0].id;
  let ins=await S.from("companies").insert({company_name:r.prospect_name,customer_id:r.customer_id||null,customer_country:r.customer_country||null}).select().single();
  if(ins.error){console.warn(ins.error);return null}
  COMPANIES.push(ins.data);return ins.data.id;
}
window.edit=async id=>{
  let r=R.find(x=>String(x.id)===String(id));if(!r)return;
  F.forEach(k=>{if($(k))$(k).value=r[k]??""});
  $("currency").value=r.currency||"EUR";
  $("fx_rate_to_eur").value=r.fx_rate_to_eur ?? (r.currency&&r.currency!=="EUR" ? "" : "1");
  if($("fx_info")) $("fx_info").textContent=(r.currency||"EUR")==="EUR" ? "EUR base currency" : "Saved indicative FX rate - editable";
  $("insurable_turnover_original").value=fmt(r.insurable_turnover_original ?? r.insurable_turnover ?? 0);
  $("insurable_turnover").value=fmt(r.insurable_turnover ?? 0);
  $("expected_premium_original").value=fmt(r.expected_premium_original ?? r.expected_premium ?? 0);
  $("expected_premium").value=fmt(r.expected_premium ?? 0);
  $("id").value=id;$("docsLocked").hidden=true;$("docsArea").hidden=false;$("reminder_amount").value="2";$("reminder_unit").value="days";$("reminder_time").value="09:00";$("reminder_note").value="";dlg.showModal();updateReminderPreview();await loadDocuments(id)
};
window.del=async id=>{if(!confirm("Delete prospect?"))return;if(on){let x=await S.from("prospects").delete().eq("id",id);if(x.error)return alert(x.error.message)}R=R.filter(x=>String(x.id)!==String(id));if(!on)localStorage.gpm=JSON.stringify(R);opts();render();table()}

$("form").onsubmit=async e=>{
  e.preventDefault();let r={};F.forEach(k=>r[k]=$(k).value);
  r.currency=r.currency||"EUR";
  r.fx_rate_to_eur=r.currency==="EUR"?1:n(r.fx_rate_to_eur);
  if(!r.fx_rate_to_eur)return alert("FX to EUR is required for non-EUR currencies. Please wait for the automatic rate or enter it manually.");
  r.insurable_turnover_original=parseMoneyInput(r.insurable_turnover_original);
  r.insurable_turnover=Math.round(r.insurable_turnover_original*r.fx_rate_to_eur);
  r.premium_rate=pct(r.premium_rate);
  r.expected_premium_original=Math.round(r.insurable_turnover_original*r.premium_rate/100);
  r.expected_premium=Math.round(r.expected_premium_original*r.fx_rate_to_eur);
  r.acceptance_rate=$("acceptance_rate").value.trim()===""?null:pct(r.acceptance_rate);
  r.offer_deadline=r.offer_deadline||null;r.policy_start_date=r.policy_start_date||null;
  r.closed_date=r.closed_date||null;
  let id=$("id").value;
  if(on){
    r.company_id=await ensureCompany(r);
    let x=id?await S.from("prospects").update(r).eq("id",id).select().single():await S.from("prospects").insert(r).select().single();
    if(x.error)return alert(x.error.message);
    R=id?R.map(z=>String(z.id)===String(id)?x.data:z):[x.data,...R];
    $("id").value=x.data.id;$("docsLocked").hidden=true;$("docsArea").hidden=false;
    await loadDocuments(x.data.id);
  }else{
    r.id=id||crypto.randomUUID();R=id?R.map(z=>String(z.id)===String(id)?r:z):[r,...R];localStorage.gpm=JSON.stringify(R)
  }
  opts();render();table();
  dlg.close();
};
async function uploadDocument(){
  if(!on)return alert("Document upload requires the shared Supabase database.");
  let opportunityId=$("id").value,file=$("document_file").files[0];
  if(!opportunityId)return alert("Save the opportunity first.");
  if(!file)return alert("Choose a PDF file.");
  if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf"))return alert("PDF files only.");
  let safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=`${opportunityId}/${Date.now()}_${safeName}`;
  let up=await S.storage.from("offers").upload(path,file,{contentType:"application/pdf",upsert:false});
  if(up.error)return alert("Upload failed: "+up.error.message);
  let doc=await S.from("opportunity_documents").insert({opportunity_id:opportunityId,document_type:$("document_type").value,description:$("document_description").value,file_path:path,file_name:file.name}).select().single();
  if(doc.error)return alert("Document record failed: "+doc.error.message);
  $("document_file").value="";$("document_description").value="";await loadDocuments(opportunityId)
}
async function loadDocuments(opportunityId){
  if(!on)return;
  let x=await S.from("opportunity_documents").select("*").eq("opportunity_id",opportunityId).order("created_at",{ascending:false});
  if(x.error){$("documentsList").innerHTML=`<p>${esc(x.error.message)}</p>`;return}
  DOCS_BY_OPPORTUNITY[opportunityId]=x.data||[];
  table();
  $("documentsList").innerHTML=x.data.length?x.data.map(d=>{
    let {data}=S.storage.from("offers").getPublicUrl(d.file_path);
    return `<div class="document-row"><b>${esc(d.document_type)}</b><div><a href="${data.publicUrl}" target="_blank" rel="noopener">${esc(d.file_name)}</a><br><span>${esc(d.description||"")}</span></div><span>${new Date(d.created_at).toLocaleDateString("en-GB")}</span><button type="button" onclick="deleteDocument('${d.id}','${esc(d.file_path)}')">Delete</button></div>`
  }).join(""):"<p>No documents attached yet.</p>"
}
window.deleteDocument=async(id,path)=>{
  if(!confirm("Delete this document?"))return;
  let a=await S.storage.from("offers").remove([path]);if(a.error)return alert(a.error.message);
  let b=await S.from("opportunity_documents").delete().eq("id",id);if(b.error)return alert(b.error.message);
  await loadDocuments($("id").value)
};
function makeCsv(rows,name){if(!rows.length)return alert("No data to export.");let keys=Object.keys(rows[0]),text="\ufeff"+keys.join(";")+"\n"+rows.map(r=>keys.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(";")).join("\n");let b=new Blob([text],{type:"text/csv;charset=utf-8"}),z=document.createElement("a");z.href=URL.createObjectURL(b);z.download=name;z.click();URL.revokeObjectURL(z.href)}
function exportCsv(){makeCsv(prospectFiltered(),"pipeline_report.csv")}
function exportSummary(k){let o={};filtered().forEach(r=>{let x=r[k]||"Not set";o[x]??={name:x,total:0,open:0,won:0,lost:0,expected_premium:0,insurable_turnover:0};let z=o[x];z.total++;let s=statusLower(r);if(s==="open")z.open++;if(s==="won")z.won++;if(s==="lost")z.lost++;z.expected_premium+=n(r.expected_premium);z.insurable_turnover+=n(r.insurable_turnover)});makeCsv(Object.values(o),`${k}_summary.csv`)}
init();
function reminderDate(){
  let amount=Math.max(0,parseInt($("reminder_amount").value||"0",10)),unit=$("reminder_unit").value;
  let d=new Date();
  if(unit==="days")d.setDate(d.getDate()+amount);
  if(unit==="weeks")d.setDate(d.getDate()+amount*7);
  if(unit==="months")d.setMonth(d.getMonth()+amount);
  let [h,m]=($("reminder_time").value||"09:00").split(":").map(Number);
  d.setHours(h||0,m||0,0,0); return d;
}
function updateReminderPreview(){
  if(!$("reminder_preview"))return;
  let d=reminderDate();
  $("reminder_preview").textContent="Calendar date: "+d.toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function icsDate(d){
  const p=x=>String(x).padStart(2,"0");
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"T"+p(d.getHours())+p(d.getMinutes())+"00";
}
function icsEscape(v){return String(v??"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;")}
function downloadCalendarReminder(){
  let d=reminderDate(),end=new Date(d.getTime()+30*60000);
  let note=$("reminder_note").value.trim()||"Follow up";
  let title=($("prospect_name").value.trim()||"Pipeline opportunity")+" - "+note;
  let lines=[
    "Prospect: "+$("prospect_name").value,
    "Policy ID: "+$("policy_id").value,
    "Customer ID: "+$("customer_id").value,
    "Customer country: "+$("customer_country").value,
    "Global country: "+$("global_country").value,
    "Sales Manager: "+$("sales_manager").value,
    "Broker: "+$("broker").value,
    "Broker contact: "+$("broker_contact").value,
    "Status: "+$("status").value,
    "Opportunity type: "+$("opportunity_type").value,
    "Acceptance rate: "+($("acceptance_rate").value?$("acceptance_rate").value+"%":""),
    "",
    "Reminder: "+note,
    "",
    "Prospect remarks: "+$("prospect_remarks").value
  ];
  let ics=[
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Global Pipeline Manager//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    "BEGIN:VEVENT","UID:"+crypto.randomUUID()+"@global-pipeline-manager",
    "DTSTAMP:"+icsDate(new Date()),"DTSTART:"+icsDate(d),"DTEND:"+icsDate(end),
    "SUMMARY:"+icsEscape(title),"DESCRIPTION:"+icsEscape(lines.join("\n")),
    "BEGIN:VALARM","TRIGGER:-PT0M","ACTION:DISPLAY","DESCRIPTION:"+icsEscape(title),"END:VALARM",
    "END:VEVENT","END:VCALENDAR"
  ].join("\r\n");
  let b=new Blob([ics],{type:"text/calendar;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download=(($("prospect_name").value||"pipeline").replace(/[^a-zA-Z0-9_-]/g,"_"))+"_reminder.ics";
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href)
}


function autocompleteField(inputId,listId){
  const input=$(inputId), list=$(listId);
  if(!input||!list||input.dataset.smartAutocomplete==="1")return;
  input.dataset.smartAutocomplete="1";

  function completeIfUnique(){
    const typed=input.value.trim().toLowerCase();
    if(!typed)return false;
    const options=[...list.options].map(o=>o.value).filter(Boolean);
    const exact=options.find(v=>v.toLowerCase()===typed);
    if(exact){input.value=exact;return true}

    // First prefer prefix matches: "sw" -> "Switzerland"
    let matches=options.filter(v=>v.toLowerCase().startsWith(typed));

    // If no prefix match, allow a unique contains match.
    if(matches.length===0){
      matches=options.filter(v=>v.toLowerCase().includes(typed));
    }

    if(matches.length===1){
      input.value=matches[0];
      return true;
    }
    return false;
  }

  input.addEventListener("keydown",e=>{
    if(e.key==="Tab"){
      completeIfUnique();
      // Normal Tab navigation continues automatically.
    } else if(e.key==="Enter"){
      if(completeIfUnique()) e.preventDefault();
    }
  });

  // Also complete when leaving the field with mouse/click if the match is unique.
  input.addEventListener("blur",()=>completeIfUnique());
}

function initTabAutocomplete(){
  [
    ["prospect_name","prospectsList"],
    ["policy_id","policiesList"],
    ["customer_id","customerIdsList"],
    ["customer_country","countriesList"],
    ["global_country","globalsList"],
    ["sales_manager","managersList"],
    ["broker","brokersList"],
    ["broker_contact","contactsList"],
    ["key_account_underwriter","kauList"]
  ].forEach(([inputId,listId])=>autocompleteField(inputId,listId));
}

function initAutomaticPremiumCalculation(){
  const turnover=$("insurable_turnover_original"), rateInput=$("premium_rate"), fx=$("fx_rate_to_eur");
  if(!turnover||!rateInput||!fx)return;

  turnover.addEventListener("input",()=>{
    const digits=String(turnover.value||"").replace(/\s/g,"").replace(/[^0-9\-]/g,"");
    if(digits!=="") turnover.value=fmt(parseMoneyInput(digits));
    calc();
  });
  turnover.addEventListener("blur",()=>{formatMoneyField(turnover);calc()});

  ["input","change","blur"].forEach(evt=>{
    rateInput.addEventListener(evt,calc);
    fx.addEventListener(evt,calc);
  });
}

const COLUMN_ORDER_KEY="gpmProspectColumnOrderV3";

function prospectTable(){
  const body=$("body");
  return body ? body.closest("table") : null;
}

function headerLabel(th){
  return (th.dataset.colKey || th.textContent || "").trim();
}

function ensureColumnKeys(){
  const table=prospectTable();
  if(!table)return;
  [...table.tHead.rows[0].cells].forEach((th,i)=>{
    if(!th.dataset.colKey){
      th.dataset.colKey = th.textContent.trim() || ("column_"+i);
    }
  });
}

function moveColumn(table,from,to){
  if(from===to)return;
  const rows=[...table.rows];
  rows.forEach(row=>{
    const cells=[...row.cells];
    const cell=cells[from];
    if(!cell)return;
    if(to>=cells.length-1) row.appendChild(cell);
    else if(from<to) row.insertBefore(cell,cells[to].nextSibling);
    else row.insertBefore(cell,cells[to]);
  });
}


function alignBodyToHeader(){
  const table=prospectTable();
  if(!table||!table.tHead||!table.tBodies[0])return;
  ensureColumnKeys();
  const order=[...table.tHead.rows[0].cells].map(headerLabel);

  [...table.tBodies[0].rows].forEach(row=>{
    const cells=[...row.cells];
    const byKey=new Map(cells.map(td=>[td.dataset.colKey,td]));
    const missing=order.filter(key=>!byKey.has(key));

    if(missing.length){
      console.warn("Column alignment skipped - missing cell keys:",missing);
      return;
    }
    order.forEach(key=>row.appendChild(byKey.get(key)));
  });
}

function currentColumnOrder(){
  const table=prospectTable();
  if(!table)return [];
  ensureColumnKeys();
  return [...table.tHead.rows[0].cells].map(headerLabel);
}

function saveColumnOrder(){
  localStorage.setItem(COLUMN_ORDER_KEY,JSON.stringify(currentColumnOrder()));
}

function applySavedColumnOrder(){
  const table=prospectTable();
  if(!table)return;
  ensureColumnKeys();
  let saved=[];
  try{ saved=JSON.parse(localStorage.getItem(COLUMN_ORDER_KEY)||"[]") }catch(e){}
  if(!saved.length)return;

  saved.forEach((key,targetIndex)=>{
    const headers=[...table.tHead.rows[0].cells];
    const from=headers.findIndex(th=>headerLabel(th)===key);
    if(from>=0 && from!==targetIndex) moveColumn(table,from,targetIndex);
  });
  alignBodyToHeader();
}

function initDraggableColumns(){
  const table=prospectTable();
  if(!table)return;
  ensureColumnKeys();
  applySavedColumnOrder();

  let draggedKey=null;

  [...table.tHead.rows[0].cells].forEach(th=>{
    // Keep Actions fixed on the far left so Edit/Delete is always easy to reach.
    if(headerLabel(th)==="Actions"){
      th.draggable=false;
      th.title="Actions stays fixed on the left";
      return;
    }

    th.draggable=true;
    th.classList.add("draggable-col");
    th.title="Drag to move this column";

    th.addEventListener("dragstart",e=>{
      draggedKey=headerLabel(th);
      th.classList.add("dragging-col");
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain",draggedKey);
    });

    th.addEventListener("dragend",()=>{
      th.classList.remove("dragging-col");
      draggedKey=null;
      document.querySelectorAll(".drag-over-col").forEach(x=>x.classList.remove("drag-over-col"));
    });

    th.addEventListener("dragover",e=>{
      e.preventDefault();
      if(!draggedKey || headerLabel(th)==="Actions")return;
      e.dataTransfer.dropEffect="move";
      th.classList.add("drag-over-col");
    });

    th.addEventListener("dragleave",()=>th.classList.remove("drag-over-col"));

    th.addEventListener("drop",e=>{
      e.preventDefault();
      th.classList.remove("drag-over-col");
      if(!draggedKey)return;
      const headers=[...table.tHead.rows[0].cells];
      const from=headers.findIndex(x=>headerLabel(x)===draggedKey);
      const to=headers.findIndex(x=>x===th);
      if(from<0||to<0||from===to)return;
      moveColumn(table,from,to);
      saveColumnOrder();
    });
  });
}

function resetColumnOrder(){
  localStorage.removeItem(COLUMN_ORDER_KEY);
  location.reload();
}

initAutomaticPremiumCalculation();
initDraggableColumns();


window.openFiles=async opportunityId=>{
  const r=R.find(x=>String(x.id)===String(opportunityId));
  if(!r)return;
  $("filesDlgTitle").textContent=(r.prospect_name||"Prospect")+" - Files";
  $("filesDlgMeta").textContent=[r.policy_id?("Policy ID: "+r.policy_id):"",r.customer_id?("Customer ID: "+r.customer_id):""].filter(Boolean).join(" | ");

  let docs=DOCS_BY_OPPORTUNITY[opportunityId]||[];
  if(on){
    const x=await S.from("opportunity_documents").select("*").eq("opportunity_id",opportunityId).order("created_at",{ascending:false});
    if(!x.error){
      docs=x.data||[];
      DOCS_BY_OPPORTUNITY[opportunityId]=docs;
      table();
    }
  }

  $("quickFilesList").innerHTML=docs.length ? docs.map(d=>{
    let url="#";
    if(on){
      const {data}=S.storage.from("offers").getPublicUrl(d.file_path);
      url=data.publicUrl;
    }
    const date=d.created_at?new Date(d.created_at).toLocaleDateString("en-GB"):"";
    return `<div class="quick-file-row">
      <div class="quick-file-icon">PDF</div>
      <div class="quick-file-main">
        <a href="${url}" target="_blank" rel="noopener">${esc(d.file_name)}</a>
        <div>${esc(d.document_type||"Document")}${d.description?" - "+esc(d.description):""}</div>
      </div>
      <div class="quick-file-date">${date}</div>
    </div>`;
  }).join("") : '<p>No files attached.</p>';

  filesDlg.showModal();
};


// v1.5.0 - ensure formatted whole-unit monetary display after form opens/edits
document.addEventListener("focusout",e=>{
  if(e.target && ["insurable_turnover_original"].includes(e.target.id)){
    formatMoneyField(e.target);
    calc();
  }
});

// v1.5.2 cleanup: remove obsolete column layout saved by pre-fix versions.
try{ localStorage.removeItem("gpmProspectColumnOrderV1"); }catch(e){}

// v1.5.3 - retry FX automatically if the selected non-EUR currency has no rate yet.
const fxField=$("fx_rate_to_eur");
if(fxField){
  fxField.addEventListener("focus",()=>{
    const c=$("currency")?.value||"EUR";
    if(c!=="EUR" && !fxField.value.trim()) currencyChanged();
  });
}

initDashboardClicks();

window.show=id=>{$("dash").hidden=id!=="dash";$("pros").hidden=id!=="pros";$("board").hidden=id!=="board";if(id==="dash")render();else if(id==="board")renderBoard();else table()};
