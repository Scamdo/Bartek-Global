const $=x=>document.getElementById(x);
const F=["prospect_name","policy_id","customer_id","customer_country","global_country","sales_manager","broker","broker_contact","offer_deadline","policy_start_date","precheck","acceptance_rate","key_account_underwriter","opportunity_type","prospect_remarks","status","currency","fx_rate_to_eur","insurable_turnover_original","insurable_turnover","premium_rate","expected_premium_original","expected_premium","premium_principle","closed_date"];
const APP_VERSION="1.9.8";
let R=[],S=null,on=false,COMPANIES=[],DOCS_BY_OPPORTUNITY={},DASH_DRILL=null,CURRENT_USER=null,CURRENT_ACCESS=null,REMINDERS=[],PASSWORD_RECOVERY_MODE=false;
const RECOVERY_URL_AT_BOOT=(()=>{
  const u=String(window.location.href||"").toLowerCase();
  return u.includes("type=recovery") || u.includes("type%3drecovery");
})();
if(RECOVERY_URL_AT_BOOT){
  PASSWORD_RECOVERY_MODE=true;
  sessionStorage.setItem("gpm_password_recovery_mode","1");
}

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
  S=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  if($("loginForm"))$("loginForm").addEventListener("submit",signInWithPassword);
  if($("resetPasswordForm"))$("resetPasswordForm").addEventListener("submit",setRecoveredPassword);

  // If this page was opened from a Supabase recovery link, lock the UI in
  // password-reset mode before Supabase consumes/cleans the URL fragment.
  if(RECOVERY_URL_AT_BOOT || sessionStorage.getItem("gpm_password_recovery_mode")==="1"){
    PASSWORD_RECOVERY_MODE=true;
    sessionStorage.setItem("gpm_password_recovery_mode","1");
    showPasswordReset();
  }

  S.auth.onAuthStateChange((event,session)=>{
    // PASSWORD_RECOVERY can arrive after INITIAL_SESSION. Once recovery starts,
    // no auth event may open the secure app until the password is actually set.
    if(event==="PASSWORD_RECOVERY"){
      PASSWORD_RECOVERY_MODE=true;
      sessionStorage.setItem("gpm_password_recovery_mode","1");
      showPasswordReset();
      return;
    }

    if(PASSWORD_RECOVERY_MODE || RECOVERY_URL_AT_BOOT || sessionStorage.getItem("gpm_password_recovery_mode")==="1"){
      PASSWORD_RECOVERY_MODE=true;
      sessionStorage.setItem("gpm_password_recovery_mode","1");
      showPasswordReset();
      return;
    }

    if(event==="SIGNED_OUT"){
      CURRENT_USER=null;CURRENT_ACCESS=null;on=false;
      showAuthGate();
      return;
    }

    // Run secure-app entry outside the auth callback's synchronous flow.
    if(session?.user && (!CURRENT_USER || CURRENT_USER.id!==session.user.id)){
      setTimeout(()=>enterSecureApp(session.user),0);
    }
  });

  const {data:{session},error}=await S.auth.getSession();
  if(error)console.warn(error);

  if(PASSWORD_RECOVERY_MODE || RECOVERY_URL_AT_BOOT || sessionStorage.getItem("gpm_password_recovery_mode")==="1"){
    PASSWORD_RECOVERY_MODE=true;
    sessionStorage.setItem("gpm_password_recovery_mode","1");
    showPasswordReset();
    return;
  }

  if(session?.user && isRecentUnfinishedRecovery(session.user)){
    PASSWORD_RECOVERY_MODE=true;
    sessionStorage.setItem("gpm_password_recovery_mode","1");
    showPasswordReset();
  }else if(session?.user){
    await enterSecureApp(session.user);
  }else{
    showAuthGate();
  }
}

function recoverySentMs(user){
  const t=Date.parse(user?.recovery_sent_at||"");
  return Number.isFinite(t)?t:0;
}
function isRecentUnfinishedRecovery(user){
  const sent=recoverySentMs(user);
  if(!sent)return false;
  const completed=Number(localStorage.getItem("gpm_password_reset_completed_at")||0);
  return sent>completed && Date.now()-sent<60*60*1000;
}
function showAuthGate(message=""){
  if($("authGate"))$("authGate").hidden=false;
  if($("appShell"))$("appShell").hidden=true;
  if($("loginForm"))$("loginForm").hidden=false;
  if($("resetPasswordForm"))$("resetPasswordForm").hidden=true;
  if($("authSessionNote"))$("authSessionNote").textContent="Your session will stay signed in on this device until you sign out.";
  if($("authMessage"))$("authMessage").textContent=message;
}
function showPasswordReset(message="Recovery link verified. Please choose your new password."){
  if($("authGate"))$("authGate").hidden=false;
  if($("appShell"))$("appShell").hidden=true;
  if($("loginForm"))$("loginForm").hidden=true;
  if($("resetPasswordForm"))$("resetPasswordForm").hidden=false;
  if($("authSessionNote"))$("authSessionNote").textContent="After setting the password, this device will remain signed in.";
  if($("authMessage"))$("authMessage").textContent=message;
  setTimeout(()=>$("newPassword")?.focus(),0);
}
function showSecureApp(){
  if($("authGate"))$("authGate").hidden=true;
  if($("appShell"))$("appShell").hidden=false;
}
window.sendPasswordRecovery=async function sendPasswordRecovery(){
  const email=$("loginEmail")?.value.trim().toLowerCase();
  const msg=$("authMessage");
  if(!email){msg.textContent="Enter your business email first.";$("loginEmail")?.focus();return}
  const btn=$("forgotPasswordBtn");btn.disabled=true;btn.textContent="Sending...";msg.textContent="";
  try{
    const {error}=await S.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
    if(error)throw error;
    msg.textContent="Password recovery email sent. Please use the link in that email.";
  }catch(err){
    console.warn(err);
    const raw=String(err?.message||"").toLowerCase();
    msg.textContent=raw.includes("rate limit")?"Email rate limit reached. Please wait before requesting another recovery email.":(err?.message||"Could not send recovery email.");
  }finally{btn.disabled=false;btn.textContent="Forgot password?"}
}
async function setRecoveredPassword(e){
  e.preventDefault();
  const p1=$("newPassword").value;
  const p2=$("confirmNewPassword").value;
  const msg=$("authMessage"),btn=$("resetPasswordBtn");
  msg.textContent="";
  if(p1.length<8){msg.textContent="Use at least 8 characters.";return}
  if(p1!==p2){msg.textContent="The passwords do not match.";return}
  btn.disabled=true;btn.textContent="Saving...";
  try{
    const {data,error}=await S.auth.updateUser({password:p1});
    if(error)throw error;
    localStorage.setItem("gpm_password_reset_completed_at",String(Date.now()));
    PASSWORD_RECOVERY_MODE=false;
    sessionStorage.removeItem("gpm_password_recovery_mode");
    msg.textContent="Password set successfully. Opening Global Pipeline Manager...";
    const user=data?.user||(await S.auth.getUser()).data?.user;
    if(!user)throw new Error("Password was saved, but the secure session could not be opened.");
    await enterSecureApp(user);
  }catch(err){
    console.warn(err);
    msg.textContent=err?.message||"Could not set the new password.";
  }finally{btn.disabled=false;btn.textContent="Set new password"}
}
async function signInWithPassword(e){
  e.preventDefault();
  const email=$("loginEmail").value.trim().toLowerCase();
  const password=$("loginPassword").value;
  const msg=$("authMessage"),btn=$("loginBtn");
  msg.textContent="";btn.disabled=true;btn.textContent="Signing in...";
  try{
    const {data,error}=await S.auth.signInWithPassword({email,password});
    if(error)throw error;
    if(!data?.user)throw new Error("Sign-in failed.");
  }catch(err){
    console.warn(err);
    const raw=String(err?.message||"").toLowerCase();
    if(raw.includes("invalid login credentials")){
      msg.textContent="Incorrect email or password.";
    }else if(raw.includes("email not confirmed")){
      msg.textContent="Your email is not confirmed yet.";
    }else{
      msg.textContent=err?.message||"Sign-in failed.";
    }
  }finally{
    btn.disabled=false;btn.textContent="Sign in";
  }
}
async function enterSecureApp(user){
  CURRENT_USER=user;
  const email=String(user.email||"").toLowerCase();

  const {data:access,error:accessError}=await S.from("allowed_users")
    .select("email,display_name,role,active")
    .eq("email",email)
    .eq("active",true)
    .maybeSingle();

  if(accessError||!access){
    await S.auth.signOut();
    showAuthGate("Access denied. Ask the administrator to authorize your email.");
    return;
  }

  CURRENT_ACCESS=access;
  if($("currentUserEmail"))$("currentUserEmail").textContent=access.display_name||user.email||"";
  if($("currentUserRole"))$("currentUserRole").textContent=String(access.role||"user").toUpperCase();
  if($("adminUsersNav"))$("adminUsersNav").hidden=!isAdmin();
  showSecureApp();

  try{
    const x=await S.from("prospects").select("*").order("created_at",{ascending:false});
    if(x.error)throw x.error;R=x.data||[];

    const c=await S.from("companies").select("*");
    if(c.error)throw c.error;COMPANIES=c.data||[];

    const docs=await S.from("opportunity_documents")
      .select("id,opportunity_id,document_type,description,file_path,file_name,created_at")
      .order("created_at",{ascending:false});
    if(docs.error)throw docs.error;

    DOCS_BY_OPPORTUNITY={};
    (docs.data||[]).forEach(d=>(DOCS_BY_OPPORTUNITY[d.opportunity_id]??=[]).push(d));

    const rem=await S.from("reminders").select("*").order("due_at",{ascending:true});
    if(rem.error)throw rem.error;
    REMINDERS=rem.data||[];

    on=true;
    if($("mode"))$("mode").textContent="Secure online database";
    await ensureAutomaticReminders();opts();render();table();if(typeof updateSidebar==="function")updateSidebar();
  }catch(err){
    console.error(err);
    on=false;
    showAuthGate("Secure database access failed. Please contact the administrator.");
  }
}
window.signOutUser=async()=>{
  if(S)await S.auth.signOut();
  R=[];COMPANIES=[];DOCS_BY_OPPORTUNITY={};REMINDERS=[];on=false;
};
function isAdmin(){return String(CURRENT_ACCESS?.role||"").toLowerCase()==="admin"}


async function loadAdminUsers(){
  if(!isAdmin())return;
  const body=$("adminUsersBody");if(!body)return;
  body.innerHTML='<tr><td colspan="5">Loading...</td></tr>';
  const {data,error}=await S.from("allowed_users").select("email,display_name,role,active,created_at").order("email");
  if(error){body.innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return}
  body.innerHTML=(data||[]).map(u=>`<tr>
    <td>${esc(u.email)}</td>
    <td>${esc(u.display_name||"")}</td>
    <td><select onchange="adminChangeRole('${esc(u.email)}',this.value)" ${String(u.email).toLowerCase()===String(CURRENT_USER?.email||"").toLowerCase()?"disabled":""}>
      <option value="user" ${u.role==="user"?"selected":""}>User</option>
      <option value="admin" ${u.role==="admin"?"selected":""}>Admin</option>
    </select></td>
    <td><span class="access-pill ${u.active?"active":"blocked"}">${u.active?"Active":"Blocked"}</span></td>
    <td>
      ${String(u.email).toLowerCase()===String(CURRENT_USER?.email||"").toLowerCase()
        ? '<span class="muted">Current user</span>'
        : `<button onclick="adminToggleUser('${esc(u.email)}',${u.active?"false":"true"})">${u.active?"Block":"Activate"}</button>`}
    </td>
  </tr>`).join("")||'<tr><td colspan="5">No users.</td></tr>';
}

window.adminAddAllowedUser=async()=>{
  if(!isAdmin())return alert("Admin access required.");
  const email=$("adminNewEmail").value.trim().toLowerCase();
  const display_name=$("adminNewName").value.trim();
  const role=$("adminNewRole").value;
  if(!email)return alert("Enter an email address.");
  const {error}=await S.from("allowed_users").upsert({email,display_name,role,active:true},{onConflict:"email"});
  if(error)return alert(error.message);
  $("adminNewEmail").value="";$("adminNewName").value="";$("adminNewRole").value="user";
  await loadAdminUsers();
};

window.adminToggleUser=async(email,active)=>{
  if(!isAdmin())return alert("Admin access required.");
  const {error}=await S.from("allowed_users").update({active}).eq("email",email);
  if(error)return alert(error.message);
  await loadAdminUsers();
};

window.adminChangeRole=async(email,role)=>{
  if(!isAdmin())return alert("Admin access required.");
  const {error}=await S.from("allowed_users").update({role}).eq("email",email);
  if(error){alert(error.message);await loadAdminUsers();return}
  await loadAdminUsers();
};

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
  $("total").textContent=a.length;$("open").textContent=a.filter(isPipelineOpen).length;$("won").textContent=a.filter(x=>statusLower(x)==="won").length;$("lost").textContent=a.filter(x=>statusLower(x)==="lost").length;$("overdue").textContent=a.filter(x=>isPipelineOpen(x)&&days(x.offer_deadline)<0).length;$("due7").textContent=a.filter(x=>{let d=days(x.offer_deadline);return isPipelineOpen(x)&&d!==null&&d>=0&&d<=7}).length;$("premium").textContent=moneyText(a.reduce((s,x)=>s+n(x.expected_premium),0),"EUR");$("turnover").textContent=moneyText(a.reduce((s,x)=>s+n(x.insurable_turnover),0),"EUR");
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
    return `<tr class="${statusClass}"><td data-col-key="Actions" class="actions-cell"><button onclick="edit('${r.id}')">Edit</button> ${isAdmin()?`<button onclick="del('${r.id}')">Delete</button>`:""}</td><td data-col-key="Files" class="files-cell">${fileCell}</td><td data-col-key="Prospect name"><b>${esc(r.prospect_name)}</b></td><td data-col-key="Policy ID">${esc(r.policy_id)}</td><td data-col-key="Customer ID">${esc(r.customer_id)}</td><td data-col-key="Customer country">${esc(r.customer_country)}</td><td data-col-key="Global country">${esc(r.global_country)}</td><td data-col-key="Sales Manager">${esc(r.sales_manager)}</td><td data-col-key="Broker">${esc(r.broker)}</td><td data-col-key="Broker contact">${esc(r.broker_contact)}</td><td data-col-key="Offer deadline">${esc(r.offer_deadline)}</td><td data-col-key="Policy start date">${esc(r.policy_start_date)}</td><td data-col-key="Days left" class="${days(r.offer_deadline)<0?"late":""}">${days(r.offer_deadline)??""}</td><td data-col-key="Precheck">${esc(r.precheck)}</td><td data-col-key="Acceptance rate">${r.acceptance_rate!==null&&r.acceptance_rate!==undefined&&r.acceptance_rate!==""?pct(r.acceptance_rate).toFixed(1)+"%":""}</td><td data-col-key="KAU">${esc(r.key_account_underwriter)}</td><td data-col-key="Opportunity type">${esc(r.opportunity_type)}</td><td data-col-key="Remarks" class="rem">${esc(r.prospect_remarks)}</td><td data-col-key="Status">${esc(r.status)}</td><td data-col-key="Currency">${esc(r.currency||"EUR")}</td><td data-col-key="Insurable turnover">${fmt(r.insurable_turnover_original ?? r.insurable_turnover)}</td><td data-col-key="Turnover EUR">${moneyText(r.insurable_turnover,"EUR")}</td><td data-col-key="Premium rate">${r.premium_rate?n(r.premium_rate).toFixed(3)+"%":""}</td><td data-col-key="Expected premium">${moneyText(r.expected_premium_original ?? r.expected_premium,r.currency||"EUR")}</td><td data-col-key="Expected premium EUR">${moneyText(r.expected_premium,"EUR")}</td><td data-col-key="Premium principle">${esc(r.premium_principle)}</td></tr>`;
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
  $("id").value=id;$("docsLocked").hidden=true;$("docsArea").hidden=false;
  if($("systemReminderLocked"))$("systemReminderLocked").hidden=true;
  if($("systemReminderArea"))$("systemReminderArea").hidden=false;
  $("reminder_amount").value="2";$("reminder_unit").value="days";$("reminder_time").value="09:00";$("reminder_note").value="";
  setDefaultSystemReminder(r);dlg.showModal();updateReminderPreview();await loadDocuments(id);renderProspectReminders(id)
};
window.del=async id=>{if(!isAdmin())return alert("Only an administrator can delete prospects.");if(!confirm("Delete prospect?"))return;if(on){let x=await S.from("prospects").delete().eq("id",id);if(x.error)return alert(x.error.message)}R=R.filter(x=>String(x.id)!==String(id));if(!on)localStorage.gpm=JSON.stringify(R);opts();render();table()}

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

  const enriched=await Promise.all((x.data||[]).map(async d=>{
    const signed=await S.storage.from("offers").createSignedUrl(d.file_path,600);
    return {...d,signed_url:signed.data?.signedUrl||""};
  }));

  $("documentsList").innerHTML=enriched.length?enriched.map(d=>{
    return `<div class="document-row"><b>${esc(d.document_type)}</b><div>${d.signed_url?`<a href="${d.signed_url}" target="_blank" rel="noopener">${esc(d.file_name)}</a>`:`<span>${esc(d.file_name)}</span>`}<br><span>${esc(d.description||"")}</span></div><span>${new Date(d.created_at).toLocaleDateString("en-GB")}</span>${isAdmin()?`<button type="button" onclick="deleteDocument('${d.id}','${esc(d.file_path)}')">Delete</button>`:"<span></span>"}</div>`
  }).join(""):"<p>No documents attached yet.</p>"
}
window.deleteDocument=async(id,path)=>{
  if(!isAdmin())return alert("Only an administrator can delete documents.");
  if(!confirm("Delete this document?"))return;
  let a=await S.storage.from("offers").remove([path]);if(a.error)return alert(a.error.message);
  let b=await S.from("opportunity_documents").delete().eq("id",id);if(b.error)return alert(b.error.message);
  await loadDocuments($("id").value)
};
function makeCsv(rows,name){if(!rows.length)return alert("No data to export.");let keys=Object.keys(rows[0]),text="\ufeff"+keys.join(";")+"\n"+rows.map(r=>keys.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(";")).join("\n");let b=new Blob([text],{type:"text/csv;charset=utf-8"}),z=document.createElement("a");z.href=URL.createObjectURL(b);z.download=name;z.click();URL.revokeObjectURL(z.href)}
function exportCsv(){makeCsv(prospectFiltered(),"pipeline_report.csv")}

window.runAiPipelineReview=async function(){
  const dlg=$("aiReviewDlg"),body=$("aiReviewBody"),meta=$("aiReviewMeta"),btn=$("aiReviewBtn");
  const prospects=filtered().filter(isPipelineOpen);
  if(!prospects.length){
    alert("There are no active pipeline opportunities in the current Dashboard filters.");
    return;
  }
  if(dlg&&!dlg.open)dlg.showModal();
  if(meta)meta.textContent=`Analysing ${prospects.length} active ${prospects.length===1?"opportunity":"opportunities"} from the current Dashboard view.`;
  if(body)body.innerHTML='<div class="ai-loading"><span class="ai-spinner"></span><div><b>AI Pipeline Review is running...</b><p>Reviewing priorities, deadlines, commercial opportunities and recommended actions.</p></div></div>';;
  if(btn){btn.disabled=true;btn.textContent="Analysing..."}
  try{
    const {data,error}=await S.functions.invoke("ai-pipeline-review",{body:{prospects}});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    const review=String(data?.review||"").trim();
    if(!review)throw new Error("AI returned an empty review.");
    if(body)body.innerHTML=`<div class="ai-review-text">${formatAiReview(review)}</div>`;
    if(meta)meta.textContent=`AI review of ${data?.opportunity_count||prospects.length} active ${prospects.length===1?"opportunity":"opportunities"}. Generated ${new Date().toLocaleString()}.`;
  }catch(err){
    console.error("AI Pipeline Review failed",err);
    let msg=String(err?.message||"AI Pipeline Review failed.");
    if(msg.toLowerCase().includes("failed to send a request"))msg="Could not reach the AI function. Check the Edge Function deployment and try again.";
    if(body)body.innerHTML=`<div class="ai-error"><b>AI review could not be completed.</b><p>${esc(msg)}</p><p>Check Edge Functions → ai-pipeline-review → Logs for details.</p></div>`;
    if(meta)meta.textContent="No OpenAI analysis was saved or applied to the pipeline.";
  }finally{
    if(btn){btn.disabled=false;btn.textContent="AI Pipeline Review"}
  }
};

function formatAiReview(text){
  let out=esc(text).replace(/\r\n/g,"\n");
  out=out.replace(/^#{1,3}\s*(.+)$/gm,'<h3>$1</h3>');
  out=out.replace(/^\s*\*\*(.+?)\*\*\s*$/gm,'<h3>$1</h3>');
  out=out.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  out=out.replace(/^[-•]\s+(.+)$/gm,'<div class="ai-bullet">• $1</div>');
  out=out.replace(/^\d+\.\s+([A-Z][A-Z /&-]{2,})$/gm,'<h3>$1</h3>');
  out=out.replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>');
  return out;
}

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

  const enriched=await Promise.all(docs.map(async d=>{
    const signed=await S.storage.from("offers").createSignedUrl(d.file_path,600);
    return {...d,signed_url:signed.data?.signedUrl||""};
  }));

  $("quickFilesList").innerHTML=enriched.length ? enriched.map(d=>{
    const date=d.created_at?new Date(d.created_at).toLocaleDateString("en-GB"):"";
    return `<div class="quick-file-row">
      <div class="quick-file-icon">PDF</div>
      <div class="quick-file-main">
        ${d.signed_url?`<a href="${d.signed_url}" target="_blank" rel="noopener">${esc(d.file_name)}</a>`:`<b>${esc(d.file_name)}</b>`}
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


function localDateKey(d){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`}
function dueLocalDateTime(dateStr,timeStr="09:00"){if(!dateStr)return null;const d=new Date(`${dateStr}T${timeStr||"09:00"}:00`);return isNaN(d)?null:d.toISOString()}
function reminderProspect(id){return R.find(r=>String(r.id)===String(id))}
function reminderIsOpen(x){return x.status==="open"}
function reminderDays(x){if(!x?.due_at)return null;const t=new Date();t.setHours(0,0,0,0);const d=new Date(x.due_at);d.setHours(0,0,0,0);return Math.round((d-t)/86400000)}
function defaultReminderAssignee(r){return r?.sales_manager||CURRENT_ACCESS?.display_name||CURRENT_USER?.email||""}
function setDefaultSystemReminder(r){const d=new Date();d.setDate(d.getDate()+7);if($("sys_reminder_date"))$("sys_reminder_date").value=localDateKey(d);if($("sys_reminder_time"))$("sys_reminder_time").value="09:00";if($("sys_reminder_type"))$("sys_reminder_type").value="Follow-up";if($("sys_reminder_assignee"))$("sys_reminder_assignee").value=defaultReminderAssignee(r);if($("sys_reminder_note"))$("sys_reminder_note").value=""}
async function createReminder(payload){const x=await S.from("reminders").insert(payload).select().single();if(x.error){alert(x.error.message);return null}REMINDERS.push(x.data);REMINDERS.sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));updateTaskSidebar();return x.data}
window.addSystemReminderFromDialog=async()=>{const opportunity_id=$("id").value;if(!opportunity_id)return alert("Save the prospect first.");const date=$("sys_reminder_date").value,time=$("sys_reminder_time").value||"09:00";if(!date)return alert("Choose a reminder date.");const r=reminderProspect(opportunity_id);const made=await createReminder({opportunity_id,due_at:dueLocalDateTime(date,time),reminder_type:$("sys_reminder_type").value,note:$("sys_reminder_note").value.trim(),assigned_to:$("sys_reminder_assignee").value.trim()||defaultReminderAssignee(r),status:"open",automatic:false,created_by:CURRENT_USER?.email||null});if(made){$("sys_reminder_note").value="";renderProspectReminders(opportunity_id)}};
function renderProspectReminders(opportunityId){const root=$("prospectRemindersList");if(!root)return;const rows=REMINDERS.filter(x=>String(x.opportunity_id)===String(opportunityId)).sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));root.innerHTML=rows.length?`<div class="mini-reminders">${rows.map(x=>`<div class="mini-reminder ${x.status!=="open"?"done":""}"><div><b>${new Date(x.due_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</b><span>${esc(x.reminder_type)}${x.note?" · "+esc(x.note):""}</span></div><div>${x.status==="open"?`<button type="button" onclick="completeReminder('${x.id}',true)">Done</button>`:`<span>Done</span>`}</div></div>`).join("")}</div>`:'<p class="muted">No system reminders yet.</p>'}
window.completeReminder=async(id,fromDialog=false)=>{const x=REMINDERS.find(r=>String(r.id)===String(id));if(!x)return;const u=await S.from("reminders").update({status:"done",completed_at:new Date().toISOString()}).eq("id",id);if(u.error)return alert(u.error.message);x.status="done";x.completed_at=new Date().toISOString();updateTaskSidebar();renderTasks();if(fromDialog)renderProspectReminders(x.opportunity_id)};
window.reopenReminder=async id=>{const x=REMINDERS.find(r=>String(r.id)===String(id));if(!x)return;const u=await S.from("reminders").update({status:"open",completed_at:null}).eq("id",id);if(u.error)return alert(u.error.message);x.status="open";x.completed_at=null;updateTaskSidebar();renderTasks()};
async function ensureAutomaticReminders(){if(!on)return;const existing=new Set(REMINDERS.map(x=>x.auto_key).filter(Boolean)),ins=[];R.filter(isPipelineOpen).forEach(r=>{if(r.created_at){const d=new Date(r.created_at);d.setDate(d.getDate()+7);d.setHours(9,0,0,0);const key=`created7:${r.id}`;if(!existing.has(key))ins.push({opportunity_id:r.id,due_at:d.toISOString(),reminder_type:"Follow-up",note:"7-day follow-up after prospect creation",assigned_to:defaultReminderAssignee(r),status:"open",automatic:true,auto_key:key,created_by:"system"})}if(r.offer_deadline){[7,2].forEach(nDays=>{const d=new Date(r.offer_deadline+"T09:00:00");d.setDate(d.getDate()-nDays);const key=`deadline${nDays}:${r.id}:${r.offer_deadline}`;if(!existing.has(key))ins.push({opportunity_id:r.id,due_at:d.toISOString(),reminder_type:"Offer deadline",note:`Offer deadline in ${nDays} days`,assigned_to:defaultReminderAssignee(r),status:"open",automatic:true,auto_key:key,created_by:"system"})})}});if(ins.length){const x=await S.from("reminders").upsert(ins,{onConflict:"auto_key",ignoreDuplicates:true}).select();if(!x.error&&x.data?.length)REMINDERS.push(...x.data);else if(x.error)console.warn(x.error)}updateTaskSidebar()}
function taskRows(){const scope=$("taskScope")?.value||"open",assignee=$("taskAssignee")?.value||"",type=$("taskTypeFilter")?.value||"",q=($("taskSearch")?.value||"").toLowerCase().trim();let a=[...REMINDERS];if(scope==="open")a=a.filter(reminderIsOpen);if(scope==="done")a=a.filter(x=>x.status==="done");if(scope==="overdue")a=a.filter(x=>reminderIsOpen(x)&&reminderDays(x)<0);if(scope==="today")a=a.filter(x=>reminderIsOpen(x)&&reminderDays(x)===0);if(scope==="week")a=a.filter(x=>{const d=reminderDays(x);return reminderIsOpen(x)&&d!==null&&d>=0&&d<=7});if(assignee)a=a.filter(x=>x.assigned_to===assignee);if(type)a=a.filter(x=>x.reminder_type===type);if(q)a=a.filter(x=>{const r=reminderProspect(x.opportunity_id);return [r?.prospect_name,x.note,x.reminder_type,x.assigned_to].join(" ").toLowerCase().includes(q)});return a.sort((x,y)=>String(x.due_at).localeCompare(String(y.due_at)))}
function populateTaskFilters(){const fill=(id,vals,label)=>{const e=$(id);if(!e)return;const cur=e.value;e.innerHTML=`<option value="">${label}</option>`+[...new Set(vals.filter(Boolean))].sort().map(v=>`<option>${esc(v)}</option>`).join("");if([...e.options].some(o=>o.value===cur))e.value=cur};fill("taskAssignee",REMINDERS.map(x=>x.assigned_to),"All assignees");fill("taskTypeFilter",REMINDERS.map(x=>x.reminder_type),"All types")}
window.renderTasks=()=>{const body=$("tasksBody");if(!body)return;populateTaskFilters();const a=taskRows(),open=REMINDERS.filter(reminderIsOpen),over=open.filter(x=>reminderDays(x)<0),today=open.filter(x=>reminderDays(x)===0);$("taskSummary").innerHTML=`<b>${open.length}</b> open · <b>${over.length}</b> overdue · <b>${today.length}</b> due today`;body.innerHTML=a.length?a.map(x=>{const r=reminderProspect(x.opportunity_id),d=reminderDays(x),cl=x.status==="done"?"task-done":d<0?"task-overdue":d===0?"task-today":"";return `<tr class="${cl}"><td><b>${new Date(x.due_at).toLocaleDateString("en-GB")}</b><br><span class="muted">${new Date(x.due_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span></td><td><button class="link-button" onclick="edit('${x.opportunity_id}')">${esc(r?.prospect_name||"Unknown prospect")}</button></td><td>${esc(x.reminder_type||"")}</td><td>${esc(x.note||"")}</td><td>${esc(x.assigned_to||"")}</td><td>${x.automatic?'<span class="auto-pill">Automatic</span>':'Manual'}</td><td>${x.status==="done"?'<span class="access-pill active">Done</span>':'<span class="access-pill blocked">Open</span>'}</td><td>${x.status==="open"?`<button onclick="completeReminder('${x.id}')">Done</button>`:`<button onclick="reopenReminder('${x.id}')">Reopen</button>`}</td></tr>`}).join(""):'<tr><td colspan="8">No reminders for this view.</td></tr>'};
function updateTaskSidebar(){const open=REMINDERS.filter(reminderIsOpen),over=open.filter(x=>reminderDays(x)<0),today=open.filter(x=>reminderDays(x)===0),week=open.filter(x=>{const d=reminderDays(x);return d!==null&&d>=0&&d<=7});[["sideTasksOpen",open.length],["sideTasksOverdue",over.length],["sideTasksToday",today.length],["sideTasksWeek",week.length]].forEach(([id,v])=>{if($(id))$(id).textContent=v})}
window.openTaskView=scope=>{show("tasks");if($("taskScope"))$("taskScope").value=scope;renderTasks()};

function policyStartDays(r){if(!r.policy_start_date)return null;const t=new Date();t.setHours(0,0,0,0);return Math.ceil((new Date(r.policy_start_date+"T00:00:00")-t)/86400000)}
function updateSidebar(){
 const active=R.filter(isPipelineOpen),over=active.filter(r=>days(r.offer_deadline)!==null&&days(r.offer_deadline)<0),due=active.filter(r=>{const d=days(r.offer_deadline);return d!==null&&d>=0&&d<=7}),starts=active.filter(r=>{const d=policyStartDays(r);return d!==null&&d>=0&&d<=90}),won=R.filter(r=>statusLower(r)==="won");
 [["sideOverdue",over.length],["sideDue7",due.length],["sideStarts90",starts.length],["sideWon",won.length],["sideAttention",new Set([...over,...due].map(r=>r.id)).size]].forEach(([id,v])=>{if($(id))$(id).textContent=v});
 if($("sidePipelinePremium"))$("sidePipelinePremium").textContent=moneyText(active.reduce((s,r)=>s+n(r.expected_premium),0),"EUR");
 if($("sideStartsPremium"))$("sideStartsPremium").textContent=moneyText(starts.reduce((s,r)=>s+n(r.expected_premium),0),"EUR"); updateTaskSidebar();
}
window.openSidebarView=type=>{if(type==="overdue"||type==="due7"||type==="won")return openDashboardDrill(type);const ids=R.filter(isPipelineOpen).filter(r=>{const d=policyStartDays(r);return d!==null&&d>=0&&d<=90}).map(r=>String(r.id));DASH_DRILL={ids,label:"Policy starts - next 90 days"};updateDrillBanner();show("pros");table()};
window.renderDocuments=()=>{const b=$("allDocsBody");if(!b)return;const q=($("docSearch")?.value||"").toLowerCase(),rows=[];R.forEach(r=>(DOCS_BY_OPPORTUNITY[r.id]||[]).forEach(d=>{if(!q||[r.prospect_name,r.customer_country,d.file_name,d.document_type,d.description].join(" ").toLowerCase().includes(q))rows.push({r,d})}));b.innerHTML=rows.length?rows.map(({r,d})=>`<tr><td><b>${esc(r.prospect_name)}</b></td><td>${esc(r.customer_country)}</td><td>${esc(d.file_name)}</td><td>${esc(d.document_type)}</td><td>${esc(d.description)}</td><td>${d.created_at?new Date(d.created_at).toLocaleDateString():""}</td><td><button onclick="openFiles('${r.id}')">Open</button></td></tr>`).join(""):'<tr><td colspan="7">No documents found.</td></tr>'};
window.renderReports=()=>{const p=$("policyStartReport"),s=$("stageReport");if(!p||!s)return;const a=R.filter(isPipelineOpen),b={"Next 30 days":0,"31-60 days":0,"61-90 days":0,"Later":0,"No start date":0};a.forEach(r=>{const d=policyStartDays(r);if(d===null)b["No start date"]++;else if(d>=0&&d<=30)b["Next 30 days"]++;else if(d<=60)b["31-60 days"]++;else if(d<=90)b["61-90 days"]++;else if(d>90)b["Later"]++});p.innerHTML=Object.entries(b).map(([k,v])=>`<div class="report-line"><span>${k}</span><b>${v}</b></div>`).join("");const g={};R.forEach(r=>{const x=normalizeBoardStage(r.status);g[x]=(g[x]||0)+1});s.innerHTML=BOARD_STAGES.map(x=>`<div class="report-line"><span>${x}</span><b>${g[x]||0}</b></div>`).join("")};

window.show=x=>{["dash","pros","board","tasks","documents","reports","adminUsers"].forEach(id=>{if($(id))$(id).hidden=id!==x});if(x==="dash")render();else if(x==="board")renderBoard();else if(x==="tasks")renderTasks();else if(x==="documents")renderDocuments();else if(x==="reports")renderReports();else if(x==="adminUsers")loadAdminUsers();else table();updateSidebar()};
setTimeout(updateSidebar,0);
