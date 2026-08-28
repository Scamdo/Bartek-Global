const $=x=>document.getElementById(x),F=["prospect_name","policy_id","customer_id","customer_country","global_country","sales_manager","broker","broker_contact","offer_deadline","precheck","key_account_underwriter","prospect_remarks","status","insurable_turnover","premium_rate","expected_premium","premium_principle"];let R=[],S=null,on=false;
const n=v=>Number(String(v??0).replace(/\s/g,"").replace(",",".").replace(/[^0-9.\-]/g,""))||0;
const fmt=v=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n(v)).replace(/,/g," ");
const rate=v=>n(String(v).replace("%",""));
const days=d=>d?Math.ceil((new Date(d+"T00:00:00")-new Date(new Date().toDateString()))/86400000):null;
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const uniq=k=>[...new Set(R.map(x=>x[k]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
const statusLower=r=>String(r.status||"").toLowerCase();

async function init(){
  try{
    S=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
    let x=await S.from("prospects").select("*").order("created_at",{ascending:false});
    if(x.error)throw x.error;R=x.data;on=true;$("mode").textContent="Shared online database";
  }catch(e){
    console.warn(e);R=JSON.parse(localStorage.gpm||"[]");$("mode").textContent="Local demo mode";
  }
  opts();render();table();
}
function setSelect(id,a,label){
  let el=$(id); if(!el)return; let old=el.value;
  el.innerHTML=`<option value="">${label}</option>`+a.map(x=>`<option>${esc(x)}</option>`).join("");
  if([...el.options].some(o=>o.value===old)) el.value=old;
}
function setList(id,a){let el=$(id);if(el)el.innerHTML=a.map(x=>`<option value="${esc(x)}">`).join("")}
function opts(){
  let countries=uniq("customer_country"),globals=uniq("global_country"),managers=uniq("sales_manager"),brokers=uniq("broker"),statuses=uniq("status");
  setSelect("df",countries,"All customer countries"); setSelect("gf",globals,"All global countries"); setSelect("mf",managers,"All Sales Managers");
  setSelect("bf",brokers,"All brokers"); setSelect("sf",statuses,"All statuses");
  setSelect("ptStatus",statuses,"All statuses"); setSelect("ptCountry",countries,"All countries"); setSelect("ptManager",managers,"All managers"); setSelect("ptBroker",brokers,"All brokers");
  setList("countriesList",countries);setList("globalsList",globals);setList("managersList",managers);setList("brokersList",brokers);
  setList("contactsList",uniq("broker_contact"));setList("kauList",uniq("key_account_underwriter"));
}
function filtered(){
  let a=[...R];
  let pairs=[["df","customer_country"],["gf","global_country"],["mf","sales_manager"],["bf","broker"],["sf","status"]];
  pairs.forEach(([id,k])=>{if($(id)?.value)a=a.filter(r=>String(r[k]||"")===$(id).value)});
  let f=$("deadlinef")?.value;
  if(f==="overdue")a=a.filter(r=>statusLower(r)==="open"&&days(r.offer_deadline)<0);
  else if(f==="none")a=a.filter(r=>!r.offer_deadline);
  else if(f)a=a.filter(r=>{let d=days(r.offer_deadline);return d!==null&&d>=0&&d<=Number(f)});
  return a;
}
function group(a,k){let o={};a.forEach(r=>{let x=r[k]||"Not set";o[x]=(o[x]||0)+1});return o}
function renderBars(id,obj,filterId){
  let el=$(id),entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...entries.map(x=>x[1]));
  el.innerHTML=entries.length?entries.map(([k,v])=>`<div class="bar clickable" data-k="${esc(k)}"><span>${esc(k)}</span><div class="track"><div class="fill" style="width:${v/mx*100}%"></div></div><b>${v}</b></div>`).join(""):"<p>No data</p>";
  if(filterId)el.querySelectorAll(".bar").forEach(x=>x.onclick=()=>{$(filterId).value=x.dataset.k;render()});
}
function render(){
  let a=filtered();
  $("total").textContent=a.length;$("open").textContent=a.filter(x=>statusLower(x)==="open").length;$("won").textContent=a.filter(x=>statusLower(x)==="won").length;
  $("lost").textContent=a.filter(x=>statusLower(x)==="lost").length;
  $("overdue").textContent=a.filter(x=>statusLower(x)==="open"&&days(x.offer_deadline)<0).length;
  $("due7").textContent=a.filter(x=>{let d=days(x.offer_deadline);return statusLower(x)==="open"&&d!==null&&d>=0&&d<=7}).length;
  $("premium").textContent=fmt(a.reduce((s,x)=>s+n(x.expected_premium),0));$("turnover").textContent=fmt(a.reduce((s,x)=>s+n(x.insurable_turnover),0));
  renderBars("countries",group(a,"customer_country"),"df");renderBars("managers",group(a,"sales_manager"),"mf");renderBars("brokers",group(a,"broker"),"bf");renderBars("statuses",group(a,"status"),"sf");
  let dl=a.filter(r=>statusLower(r)==="open"&&days(r.offer_deadline)!==null&&days(r.offer_deadline)<=30).sort((x,y)=>days(x.offer_deadline)-days(y.offer_deadline)).slice(0,20);
  $("deadlineBody").innerHTML=dl.map(r=>`<tr><td><b>${esc(r.prospect_name)}</b></td><td>${esc(r.customer_country)}</td><td>${esc(r.sales_manager)}</td><td>${esc(r.offer_deadline)}</td><td class="${days(r.offer_deadline)<0?"late":""}">${days(r.offer_deadline)}</td><td>${esc(r.status)}</td><td>${fmt(r.expected_premium)}</td></tr>`).join("");
}
function prospectFiltered(){
  let q=$("search").value.toLowerCase().trim(),a=R.filter(r=>!q||Object.values(r).some(v=>String(v??"").toLowerCase().includes(q)));
  let pairs=[["ptStatus","status"],["ptCountry","customer_country"],["ptManager","sales_manager"],["ptBroker","broker"]];
  pairs.forEach(([id,k])=>{if($(id)?.value)a=a.filter(r=>String(r[k]||"")===$(id).value)});
  return a;
}
function table(){
  let a=prospectFiltered();
  $("body").innerHTML=a.map(r=>`<tr><td><b>${esc(r.prospect_name)}</b></td><td>${esc(r.policy_id)}</td><td>${esc(r.customer_id)}</td><td>${esc(r.customer_country)}</td><td>${esc(r.global_country)}</td><td>${esc(r.sales_manager)}</td><td>${esc(r.broker)}</td><td>${esc(r.broker_contact)}</td><td>${esc(r.offer_deadline)}</td><td class="${days(r.offer_deadline)<0?"late":""}">${days(r.offer_deadline)??""}</td><td>${esc(r.precheck)}</td><td>${esc(r.key_account_underwriter)}</td><td class="rem">${esc(r.prospect_remarks)}</td><td>${esc(r.status)}</td><td>${fmt(r.insurable_turnover)}</td><td>${r.premium_rate?n(r.premium_rate).toFixed(3)+"%":""}</td><td>${fmt(r.expected_premium)}</td><td>${esc(r.premium_principle)}</td><td><button onclick="edit('${r.id}')">Edit</button> <button onclick="del('${r.id}')">Delete</button></td></tr>`).join("")
}
function resetDashboardFilters(){["df","gf","mf","bf","sf","deadlinef"].forEach(id=>{if($(id))$(id).value=""});render()}
function show(x){$("dash").hidden=x!=="dash";$("pros").hidden=x!=="pros"}
function openForm(){$("form").reset();$("id").value="";$("status").value="Open";dlg.showModal()}
function calc(){$("expected_premium").value=fmt(n($("insurable_turnover").value)*rate($("premium_rate").value)/100)}
window.edit=id=>{let r=R.find(x=>String(x.id)===String(id));F.forEach(k=>$(k).value=r[k]??"");$("id").value=id;dlg.showModal()};
window.del=async id=>{if(!confirm("Delete prospect?"))return;if(on){let x=await S.from("prospects").delete().eq("id",id);if(x.error)return alert(x.error.message)}R=R.filter(x=>String(x.id)!==String(id));if(!on)localStorage.gpm=JSON.stringify(R);opts();render();table()}
$("form").onsubmit=async e=>{e.preventDefault();let r={};F.forEach(k=>r[k]=$(k).value);r.insurable_turnover=n(r.insurable_turnover);r.expected_premium=n(r.expected_premium);r.premium_rate=rate(r.premium_rate);let id=$("id").value;if(on){let x=id?await S.from("prospects").update(r).eq("id",id).select().single():await S.from("prospects").insert(r).select().single();if(x.error)return alert(x.error.message);R=id?R.map(z=>String(z.id)===String(id)?x.data:z):[x.data,...R]}else{r.id=id||crypto.randomUUID();R=id?R.map(z=>String(z.id)===String(id)?r:z):[r,...R];localStorage.gpm=JSON.stringify(R)}dlg.close();opts();render();table()}
function makeCsv(rows,name){
  if(!rows.length)return alert("No data to export.");
  let keys=Object.keys(rows[0]),text="\ufeff"+keys.join(";")+"\n"+rows.map(r=>keys.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(";")).join("\n");
  let b=new Blob([text],{type:"text/csv;charset=utf-8"}),z=document.createElement("a");z.href=URL.createObjectURL(b);z.download=name;z.click();URL.revokeObjectURL(z.href)
}
function exportCsv(){makeCsv(prospectFiltered(),"pipeline_report.csv")}
function exportSummary(k){
  let o={};filtered().forEach(r=>{let x=r[k]||"Not set";o[x]??={name:x,total:0,open:0,won:0,lost:0,expected_premium:0,insurable_turnover:0};let z=o[x];z.total++;let s=statusLower(r);if(s==="open")z.open++;if(s==="won")z.won++;if(s==="lost")z.lost++;z.expected_premium+=n(r.expected_premium);z.insurable_turnover+=n(r.insurable_turnover)});
  makeCsv(Object.values(o),`${k}_summary.csv`)
}
init();