
const cfg = window.APP_CONFIG || {};
const useSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
const supabaseClient = useSupabase ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const LOCAL_KEY = "atradiusProspectPipelineFallback";
let records = [];
const $ = id => document.getElementById(id);

function parseNumber(value){
  if(typeof value==="number") return value;
  const s=String(value||"").trim().replace(/\s/g,"").replace("%","").replace(",",".");
  const n=Number(s); return Number.isFinite(n)?n:0;
}
function formatNumber(value,decimals=0){
  return new Intl.NumberFormat("fr-FR",{minimumFractionDigits:decimals,maximumFractionDigits:decimals})
    .format(Number(value||0)).replace(/\u202f/g," ");
}
function formatRate(v){return formatNumber(v,3)+"%"}
function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function formatDate(iso){if(!iso)return"";const [y,m,d]=iso.split("-");return `${d}.${m}.${y}`}
function daysLeft(deadline){
  if(!deadline)return null; const t=new Date();t.setHours(0,0,0,0);
  return Math.ceil((new Date(deadline+"T00:00:00")-t)/86400000);
}
function statusClass(s){return String(s||"").toLowerCase().replaceAll(" ","")}
function deadlineBadge(d){
  if(d===null)return '<span class="badge">No deadline</span>';
  if(d<0)return `<span class="badge overdue">${d}</span>`;
  if(d<=30)return `<span class="badge soon">${d}</span>`;
  return `<span class="badge">${d}</span>`;
}
async function loadRecords(){
  if(useSupabase){
    const {data,error}=await supabaseClient.from("prospects").select("*").order("updated_at",{ascending:false});
    if(error) throw error; records=(data||[]).map(fromDb);
  } else records=JSON.parse(localStorage.getItem(LOCAL_KEY)||"[]");
}
function fromDb(r){return{
  id:r.id, prospectName:r.prospect_name, policyId:r.policy_id, customerId:r.customer_id,
  customerCountry:r.customer_country, globalCountry:r.global_country, salesManager:r.sales_manager,
  broker:r.broker, brokerContact:r.broker_contact, offerDeadline:r.offer_deadline, precheck:r.precheck,
  kau:r.kau, prospectRemarks:r.prospect_remarks, status:r.status, insurableTurnover:Number(r.insurable_turnover||0),
  premiumRate:Number(r.premium_rate||0), expectedPremium:Number(r.expected_premium||0),
  premiumPrinciple:r.premium_principle, createdAt:r.created_at, updatedAt:r.updated_at
}}
function toDb(r){return{
  id:r.id, prospect_name:r.prospectName, policy_id:r.policyId, customer_id:r.customerId,
  customer_country:r.customerCountry, global_country:r.globalCountry, sales_manager:r.salesManager,
  broker:r.broker, broker_contact:r.brokerContact, offer_deadline:r.offerDeadline||null, precheck:r.precheck,
  kau:r.kau, prospect_remarks:r.prospectRemarks, status:r.status, insurable_turnover:r.insurableTurnover,
  premium_rate:r.premiumRate, expected_premium:r.expectedPremium, premium_principle:r.premiumPrinciple
}}
async function saveRecord(r){
  if(useSupabase){
    const {error}=await supabaseClient.from("prospects").upsert(toDb(r)); if(error)throw error;
  } else {
    const i=records.findIndex(x=>x.id===r.id); if(i>=0)records[i]=r; else records.push(r);
    localStorage.setItem(LOCAL_KEY,JSON.stringify(records));
  }
}
async function removeRecord(id){
  if(useSupabase){const {error}=await supabaseClient.from("prospects").delete().eq("id",id);if(error)throw error}
  else {records=records.filter(r=>r.id!==id);localStorage.setItem(LOCAL_KEY,JSON.stringify(records))}
}
function unique(field){return [...new Set(records.map(r=>r[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function fillSelect(id,items,first){
  const el=$(id), current=el.value; el.innerHTML=`<option value="">${first}</option>`+items.map(v=>`<option>${safe(v)}</option>`).join("");
  if([...el.options].some(o=>o.value===current))el.value=current;
}
function fillList(id,items){$(id).innerHTML=items.map(v=>`<option value="${safe(v)}"></option>`).join("")}
function refreshLookups(){
  const statuses=unique("status"), cc=unique("customerCountry"), gc=unique("globalCountry"), sm=unique("salesManager"), br=unique("broker");
  fillSelect("dashStatus",statuses,"All statuses"); fillSelect("tableStatus",statuses,"All statuses");
  fillSelect("dashCustomerCountry",cc,"All countries"); fillSelect("tableCustomerCountry",cc,"All countries");
  fillSelect("dashGlobalCountry",gc,"All global countries"); fillSelect("dashSalesManager",sm,"All managers");
  fillSelect("tableSalesManager",sm,"All managers"); fillSelect("dashBroker",br,"All brokers");
  fillList("customerCountryList",cc); fillList("globalCountryList",gc); fillList("salesManagerList",sm);
  fillList("brokerList",br); fillList("brokerContactList",unique("brokerContact")); fillList("kauList",unique("kau"));
}
function dashboardData(){
  return records.filter(r=>{
    if($("dashStatus").value&&r.status!==$("dashStatus").value)return false;
    if($("dashCustomerCountry").value&&r.customerCountry!==$("dashCustomerCountry").value)return false;
    if($("dashGlobalCountry").value&&r.globalCountry!==$("dashGlobalCountry").value)return false;
    if($("dashSalesManager").value&&r.salesManager!==$("dashSalesManager").value)return false;
    if($("dashBroker").value&&r.broker!==$("dashBroker").value)return false;
    const f=$("dashDeadline").value,d=daysLeft(r.offerDeadline);
    if(f==="overdue"&&!(d!==null&&d<0))return false;
    if(f==="7"&&!(d!==null&&d>=0&&d<=7))return false;
    if(f==="30"&&!(d!==null&&d>=0&&d<=30))return false;
    if(f==="none"&&d!==null)return false;
    return true;
  })
}
function renderBars(id,counts){
  const entries=Object.entries(counts),max=Math.max(1,...entries.map(x=>x[1]));
  $(id).innerHTML=entries.length?entries.map(([k,v],i)=>`
    <div class="bar-row"><div>${safe(k)}</div><div class="bar-track"><div class="bar-fill ${i%2?"green":""}" style="width:${v/max*100}%"></div></div><div class="num">${formatNumber(v)}</div></div>
  `).join(""):"No data";
}
function renderDashboard(){
  const d=dashboardData(), closed=new Set(["Closed","Won","Lost"]);
  $("kpiTotal").textContent=formatNumber(d.length); $("kpiOpen").textContent=formatNumber(d.filter(r=>r.status==="Open").length);
  $("kpiClosed").textContent=formatNumber(d.filter(r=>closed.has(r.status)).length);
  $("kpiDue30").textContent=formatNumber(d.filter(r=>{const x=daysLeft(r.offerDeadline);return x!==null&&x>=0&&x<=30}).length);
  $("kpiOverdue").textContent=formatNumber(d.filter(r=>{const x=daysLeft(r.offerDeadline);return x!==null&&x<0}).length);
  $("kpiPremium").textContent=formatNumber(d.reduce((s,r)=>s+r.expectedPremium,0));
  const byCountry={}; d.forEach(r=>{const c=r.customerCountry||"Not set";byCountry[c]=(byCountry[c]||0)+1});
  const byStatus={}; d.forEach(r=>{const s=r.status||"Not set";byStatus[s]=(byStatus[s]||0)+1});
  renderBars("countryChart",byCountry);renderBars("statusChart",byStatus);
}
function tableData(){
  const q=$("search").value.trim().toLowerCase();
  let d=records.filter(r=>{
    const h=Object.values(r).join(" ").toLowerCase();
    return(!q||h.includes(q))&&(!$("tableStatus").value||r.status===$("tableStatus").value)
    &&(!$("tableCustomerCountry").value||r.customerCountry===$("tableCustomerCountry").value)
    &&(!$("tableSalesManager").value||r.salesManager===$("tableSalesManager").value)
  });
  const s=$("sortBy").value;
  d.sort((a,b)=>s==="prospectName"?a.prospectName.localeCompare(b.prospectName):
    s==="turnoverDesc"?b.insurableTurnover-a.insurableTurnover:
    s==="premiumDesc"?b.expectedPremium-a.expectedPremium:
    s==="updatedDesc"?new Date(b.updatedAt)-new Date(a.updatedAt):
    ((daysLeft(a.offerDeadline)??999999)-(daysLeft(b.offerDeadline)??999999)));
  return d;
}
function renderTable(){
  const d=tableData(); $("recordsBody").innerHTML=d.length?d.map(r=>`<tr>
    <td><b>${safe(r.prospectName)}</b></td><td>${safe(r.policyId)}</td><td>${safe(r.customerId)}</td>
    <td>${safe(r.customerCountry)}</td><td>${safe(r.globalCountry)}</td><td>${safe(r.salesManager)}</td>
    <td>${safe(r.broker)}</td><td>${safe(r.brokerContact)}</td><td>${formatDate(r.offerDeadline)}</td>
    <td class="num">${deadlineBadge(daysLeft(r.offerDeadline))}</td><td>${safe(r.precheck)}</td><td>${safe(r.kau)}</td>
    <td>${safe(r.prospectRemarks)}</td><td><span class="badge ${statusClass(r.status)}">${safe(r.status)}</span></td>
    <td class="num">${formatNumber(r.insurableTurnover)}</td><td class="num">${formatRate(r.premiumRate)}</td>
    <td class="num">${formatNumber(r.expectedPremium)}</td><td>${safe(r.premiumPrinciple)}</td>
    <td><button class="secondary small" onclick="editRecord('${r.id}')">Edit</button><button class="secondary small" onclick="deleteRecord('${r.id}')">Delete</button></td>
  </tr>`).join(""):`<tr><td colspan="19">No matching records.</td></tr>`
}
async function refresh(){await loadRecords();refreshLookups();renderDashboard();renderTable()}
function clearForm(){$("recordForm").reset();$("recordId").value="";$("status").value="Open";$("premiumPrinciple").value="turnover"}
$("calculatePremium").onclick=()=>{$("expectedPremium").value=formatNumber(parseNumber($("insurableTurnover").value)*parseNumber($("premiumRate").value)/100)}
["insurableTurnover","expectedPremium"].forEach(id=>$(id).addEventListener("blur",e=>{const n=parseNumber(e.target.value);e.target.value=n?formatNumber(n):""}))
$("premiumRate").addEventListener("blur",e=>{const n=parseNumber(e.target.value);e.target.value=n?formatRate(n):""})
$("clearForm").onclick=clearForm;
$("recordForm").addEventListener("submit",async e=>{
  e.preventDefault();const id=$("recordId").value||crypto.randomUUID();const old=records.find(r=>r.id===id);
  let exp=parseNumber($("expectedPremium").value);if(!exp)exp=parseNumber($("insurableTurnover").value)*parseNumber($("premiumRate").value)/100;
  const r={id,prospectName:$("prospectName").value.trim(),policyId:$("policyId").value.trim(),customerId:$("customerId").value.trim(),
    customerCountry:$("customerCountry").value.trim(),globalCountry:$("globalCountry").value.trim(),salesManager:$("salesManager").value.trim(),
    broker:$("broker").value.trim(),brokerContact:$("brokerContact").value.trim(),offerDeadline:$("offerDeadline").value,precheck:$("precheck").value,
    kau:$("kau").value.trim(),prospectRemarks:$("prospectRemarks").value.trim(),status:$("status").value,
    insurableTurnover:parseNumber($("insurableTurnover").value),premiumRate:parseNumber($("premiumRate").value),expectedPremium:exp,
    premiumPrinciple:$("premiumPrinciple").value,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  await saveRecord(r);clearForm();await refresh()
});
window.editRecord=id=>{const r=records.find(x=>x.id===id);if(!r)return;Object.keys(r).forEach(k=>{if($(k))$(k).value=r[k]??""});
  $("recordId").value=r.id;$("insurableTurnover").value=formatNumber(r.insurableTurnover);$("premiumRate").value=formatRate(r.premiumRate);
  $("expectedPremium").value=formatNumber(r.expectedPremium);window.scrollTo({top:0,behavior:"smooth"})
}
window.deleteRecord=async id=>{if(confirm("Delete this prospect?")){await removeRecord(id);await refresh()}}
["dashStatus","dashCustomerCountry","dashGlobalCountry","dashSalesManager","dashBroker","dashDeadline"].forEach(id=>$(id).addEventListener("input",renderDashboard));
["search","tableStatus","tableCustomerCountry","tableSalesManager","sortBy"].forEach(id=>$(id).addEventListener("input",renderTable));
$("resetDashboard").onclick=()=>{["dashStatus","dashCustomerCountry","dashGlobalCountry","dashSalesManager","dashBroker","dashDeadline"].forEach(id=>$(id).value="");renderDashboard()}
function download(name,content,type){const b=new Blob([content],{type}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href)}
function csv(rows,headers){const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;return "\ufeff"+[headers,...rows].map(r=>r.map(esc).join(";")).join("\n")}
$("exportVisibleCsv").onclick=()=>{const d=tableData(),headers=["Prospect name","Policy ID","Customer ID","Customer country","Global country","Sales Manager","Broker","Broker contact","Offer deadline","Days left","Precheck","Key Account Underwriter","Prospect remarks","Status","Insurable turnover","Premium rate","Expected premium","Premium principle"];
  const rows=d.map(r=>[r.prospectName,r.policyId,r.customerId,r.customerCountry,r.globalCountry,r.salesManager,r.broker,r.brokerContact,formatDate(r.offerDeadline),daysLeft(r.offerDeadline)??"",r.precheck,r.kau,r.prospectRemarks,r.status,formatNumber(r.insurableTurnover),formatRate(r.premiumRate),formatNumber(r.expectedPremium),r.premiumPrinciple]);
  download("visible-prospect-report.csv",csv(rows,headers),"text/csv;charset=utf-8")
}
$("exportCountryCsv").onclick=()=>{const map={};dashboardData().forEach(r=>{const c=r.customerCountry||"Not set";map[c]??={country:c,total:0,open:0,closed:0,turnover:0,premium:0};const x=map[c];x.total++;if(r.status==="Open")x.open++;if(["Closed","Won","Lost"].includes(r.status))x.closed++;x.turnover+=r.insurableTurnover;x.premium+=r.expectedPremium});
  const rows=Object.values(map).sort((a,b)=>a.country.localeCompare(b.country)).map(x=>[x.country,x.total,x.open,x.closed,formatNumber(x.turnover),formatNumber(x.premium)]);
  download("country-summary-report.csv",csv(rows,["Customer country","Total topics","Open","Closed / Won / Lost","Insurable turnover","Expected premium"]),"text/csv;charset=utf-8")
}
$("exportJson").onclick=()=>download("atradius-pipeline-backup.json",JSON.stringify(records,null,2),"application/json");
$("importJson").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;const arr=JSON.parse(await f.text());for(const r of arr){r.id=r.id||crypto.randomUUID();await saveRecord(r)}await refresh();e.target.value=""});
(async()=>{try{$("modeBadge").textContent=useSupabase?"Shared online database":"Local demo mode";await refresh()}catch(e){$("modeBadge").textContent="Connection error";alert(e.message)}})();
