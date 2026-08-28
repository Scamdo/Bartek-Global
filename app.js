const $=x=>document.getElementById(x);
const F=["prospect_name","policy_id","customer_id","customer_country","global_country","sales_manager","broker","broker_contact","offer_deadline","precheck","acceptance_rate","key_account_underwriter","opportunity_type","prospect_remarks","status","insurable_turnover","premium_rate","expected_premium","premium_principle","closed_date"];
let R=[],S=null,on=false,COMPANIES=[],DOCS_BY_OPPORTUNITY={};

const n=v=>Number(String(v??0).replace(/\s/g,"").replace(",",".").replace(/[^0-9.\-]/g,""))||0;
const fmt=v=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n(v)).replace(/,/g," ");
const pct=v=>n(String(v).replace("%",""));
const days=d=>d?Math.ceil((new Date(d+"T00:00:00")-new Date(new Date().toDateString()))/86400000):null;
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const uniq=k=>[...new Set(R.map(x=>x[k]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
const statusLower=r=>String(r.status||"").toLowerCase();

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
  let f=$("deadlinef")?.value;if(f==="overdue")a=a.filter(r=>statusLower(r)==="open"&&days(r.offer_deadline)<0);else if(f==="none")a=a.filter(r=>!r.offer_deadline);else if(f)a=a.filter(r=>{let d=days(r.offer_deadline);return d!==null&&d>=0&&d<=Number(f)});
  return a;
}
function group(a,k){let o={};a.forEach(r=>{let x=r[k]||"Not set";o[x]=(o[x]||0)+1});return o}
function renderBars(id,obj,filterId){let el=$(id),entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...entries.map(x=>x[1]));el.innerHTML=entries.length?entries.map(([k,v])=>`<div class="bar clickable" data-k="${esc(k)}"><span>${esc(k)}</span><div class="track"><div class="fill" style="width:${v/mx*100}%"></div></div><b>${v}</b></div>`).join(""):"<p>No data</p>";if(filterId)el.querySelectorAll(".bar").forEach(x=>x.onclick=()=>{$(filterId).value=x.dataset.k;render()})}
function render(){
  let a=filtered();
  $("total").textContent=a.length;$("open").textContent=a.filter(x=>statusLower(x)==="open").length;$("won").textContent=a.filter(x=>statusLower(x)==="won").length;$("lost").textContent=a.filter(x=>statusLower(x)==="lost").length;$("overdue").textContent=a.filter(x=>statusLower(x)==="open"&&days(x.offer_deadline)<0).length;$("due7").textContent=a.filter(x=>{let d=days(x.offer_deadline);return statusLower(x)==="open"&&d!==null&&d>=0&&d<=7}).length;$("premium").textContent=fmt(a.reduce((s,x)=>s+n(x.expected_premium),0));$("turnover").textContent=fmt(a.reduce((s,x)=>s+n(x.insurable_turnover),0));
  renderBars("countries",group(a,"customer_country"),"df");renderBars("managers",group(a,"sales_manager"),"mf");renderBars("brokers",group(a,"broker"),"bf");renderBars("statuses",group(a,"status"),"sf");
  let dl=a.filter(r=>statusLower(r)==="open"&&days(r.offer_deadline)!==null&&days(r.offer_deadline)<=30).sort((x,y)=>days(x.offer_deadline)-days(y.offer_deadline)).slice(0,20);
  $("deadlineBody").innerHTML=dl.map(r=>`<tr><td><b>${esc(r.prospect_name)}</b></td><td>${esc(r.customer_country)}</td><td>${esc(r.sales_manager)}</td><td>${esc(r.offer_deadline)}</td><td class="${days(r.offer_deadline)<0?"late":""}">${days(r.offer_deadline)}</td><td>${esc(r.status)}</td><td>${fmt(r.expected_premium)}</td></tr>`).join("");
}
function prospectFiltered(){
  let q=$("search").value.toLowerCase().trim(),a=R.filter(r=>!q||Object.values(r).some(v=>String(v??"").toLowerCase().includes(q)));
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
    const statusClass=(()=>{const s=statusLower(r);if(s==="won")return"prospect-won";if(s==="lost")return"prospect-lost";if(s==="open"||s==="ongoing")return"prospect-open";return"prospect-neutral"})();
    return `<tr class="${statusClass}"><td class="actions-cell"><button onclick="edit('${r.id}')">Edit</button> <button onclick="del('${r.id}')">Delete</button></td><td class="files-cell">${fileCell}</td><td><b>${esc(r.prospect_name)}</b></td><td>${esc(r.policy_id)}</td><td>${esc(r.customer_id)}</td><td>${esc(r.customer_country)}</td><td>${esc(r.global_country)}</td><td>${esc(r.sales_manager)}</td><td>${esc(r.broker)}</td><td>${esc(r.broker_contact)}</td><td>${esc(r.offer_deadline)}</td><td class="${days(r.offer_deadline)<0?"late":""}">${days(r.offer_deadline)??""}</td><td>${esc(r.precheck)}</td><td>${r.acceptance_rate!==null&&r.acceptance_rate!==undefined&&r.acceptance_rate!==""?pct(r.acceptance_rate).toFixed(1)+"%":""}</td><td>${esc(r.key_account_underwriter)}</td><td>${esc(r.opportunity_type)}</td><td class="rem">${esc(r.prospect_remarks)}</td><td>${esc(r.status)}</td><td>${fmt(r.insurable_turnover)}</td><td>${r.premium_rate?n(r.premium_rate).toFixed(3)+"%":""}</td><td>${fmt(r.expected_premium)}</td><td>${esc(r.premium_principle)}</td></tr>`;
  }).join("");
  applySavedColumnOrder();
}
function resetDashboardFilters(){["df","gf","mf","bf","sf","deadlinef"].forEach(id=>{if($(id))$(id).value=""});render()}
function show(x){$("dash").hidden=x!=="dash";$("pros").hidden=x!=="pros"}
async function openForm(){ $("form").reset();$("id").value="";$("status").value="Open";$("opportunity_type").value="New Business";$("docsLocked").hidden=false;$("docsArea").hidden=true;$("documentsList").innerHTML="";$("reminder_amount").value="2";$("reminder_unit").value="days";$("reminder_time").value="09:00";$("reminder_note").value="";dlg.showModal();updateReminderPreview()}
function calc(){
  const turnoverRaw=$("insurable_turnover").value.trim();
  const rateRaw=$("premium_rate").value.trim();
  if(!turnoverRaw||!rateRaw){$("expected_premium").value="";return}
  $("expected_premium").value=fmt(n(turnoverRaw)*pct(rateRaw)/100)
}

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
  F.forEach(k=>{if($(k))$(k).value=r[k]??""});$("id").value=id;$("docsLocked").hidden=true;$("docsArea").hidden=false;$("reminder_amount").value="2";$("reminder_unit").value="days";$("reminder_time").value="09:00";$("reminder_note").value="";dlg.showModal();updateReminderPreview();await loadDocuments(id)
};
window.del=async id=>{if(!confirm("Delete prospect?"))return;if(on){let x=await S.from("prospects").delete().eq("id",id);if(x.error)return alert(x.error.message)}R=R.filter(x=>String(x.id)!==String(id));if(!on)localStorage.gpm=JSON.stringify(R);opts();render();table()}

$("form").onsubmit=async e=>{
  e.preventDefault();let r={};F.forEach(k=>r[k]=$(k).value);
  r.insurable_turnover=n(r.insurable_turnover);r.expected_premium=n(r.expected_premium);r.premium_rate=pct(r.premium_rate);
  r.acceptance_rate=$("acceptance_rate").value.trim()===""?null:pct(r.acceptance_rate);
  r.offer_deadline=r.offer_deadline||null;
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
  const turnover=$("insurable_turnover"), rateInput=$("premium_rate");
  if(!turnover||!rateInput)return;
  ["input","change","blur"].forEach(evt=>{
    turnover.addEventListener(evt,calc);
    rateInput.addEventListener(evt,calc);
  });
}

const COLUMN_ORDER_KEY="gpmProspectColumnOrderV1";

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
