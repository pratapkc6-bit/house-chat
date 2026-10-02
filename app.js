(() => {
  'use strict';
  const VERSION = '0.1.0';
  const STORE_KEY = 'house-five-chat:v1';
  const THEME_KEY = 'house-five-chat:theme';
  const $ = (s) => document.querySelector(s);
  const els = {
    sidebar: $('#sidebar'), drawerScrim: $('#drawerScrim'), conversationList: $('#conversationList'),
    messages: $('#messages'), input: $('#composerInput'), send: $('#sendBtn'), search: $('#searchInput'),
    activeTitle: $('#activeTitle'), activeStatus: $('#activeStatus'), activeAvatar: $('#activeAvatar'),
    meName: $('#meName'), meAvatar: $('#meAvatar'), modeBadge: $('#modeBadge'), typing: $('#typing'),
    emojiTray: $('#emojiTray'), toast: $('#toast'), messageSearch: $('#messageSearch'),
    messageSearchInput: $('#messageSearchInput'), replyBar: $('#replyBar'), replyText: $('#replyText')
  };

  const seed = {
    me: { id: 'me', name: 'House member', initials: 'ME' },
    members: [
      { id: 'maya', name: 'Maya', initials: 'MA', online: true },
      { id: 'arun', name: 'Arun', initials: 'AR', online: true },
      { id: 'nima', name: 'Nima', initials: 'NI', online: false },
      { id: 'sita', name: 'Sita', initials: 'SI', online: true }
    ],
    conversations: [
      { id: 'house', type: 'group', title: 'House Five', initials: 'H5', unread: 0, members: ['me','maya','arun','nima','sita'] },
      { id: 'maya', type: 'dm', title: 'Maya', initials: 'MA', unread: 2, members: ['me','maya'] },
      { id: 'arun', type: 'dm', title: 'Arun', initials: 'AR', unread: 0, members: ['me','arun'] }
    ],
    messages: {
      house: [
        { id:'m1', from:'maya', text:'Kitchen is done. I moved the recycling out as well.', at: Date.now()-1000*60*52, reactions:{'👍':2} },
        { id:'m2', from:'me', text:'Perfect. I will take care of the bins tonight.', at: Date.now()-1000*60*45, reactions:{} },
        { id:'m3', from:'arun', text:'I left the spare key in the usual safe place.', at: Date.now()-1000*60*18, reactions:{'✓':1} }
      ],
      maya: [
        { id:'m4', from:'maya', text:'Can you check the shared shopping list when you get a chance?', at: Date.now()-1000*60*33, reactions:{} },
        { id:'m5', from:'maya', text:'I added rice and dishwashing liquid.', at: Date.now()-1000*60*30, reactions:{} }
      ],
      arun: [{ id:'m6', from:'me', text:'Thanks for sorting the internet bill.', at: Date.now()-1000*60*140, reactions:{'👍':1} }]
    },
    active: 'house'
  };

  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function load(){
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return saved && saved.conversations ? saved : clone(seed);
    } catch { return clone(seed); }
  }
  let state = load();
  let replyTo = null;
  let integration = { connected:false, returnUrl:null, apiBase:null };

  function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  function escapeHtml(v=''){ return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function member(id){ return id === state.me.id ? state.me : state.members.find(m=>m.id===id) || {name:'Member',initials:'?'}; }
  function conv(id=state.active){ return state.conversations.find(c=>c.id===id) || state.conversations[0]; }
  function latest(c){ const list=state.messages[c.id]||[]; return list[list.length-1]; }
  function time(ts){ return new Intl.DateTimeFormat([], {hour:'numeric',minute:'2-digit'}).format(new Date(ts)); }
  function dateLabel(ts){ const d=new Date(ts), today=new Date(); return d.toDateString()===today.toDateString()?'Today':new Intl.DateTimeFormat([], {weekday:'short',day:'numeric',month:'short'}).format(d); }
  function initials(name=''){ return name.split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'?'; }

  function renderConversations(){
    const q=els.search.value.trim().toLowerCase();
    els.conversationList.innerHTML = state.conversations
      .filter(c=>!q || c.title.toLowerCase().includes(q) || (latest(c)?.text||'').toLowerCase().includes(q))
      .map(c=>{
        const l=latest(c), active=c.id===state.active;
        return `<button class="conversation-item ${active?'active':''}" data-conv="${escapeHtml(c.id)}" type="button">
          <span class="avatar">${escapeHtml(c.initials||initials(c.title))}</span>
          <span class="conversation-copy"><strong>${escapeHtml(c.title)}</strong><span>${escapeHtml(l?.text||'No messages yet')}</span></span>
          <span class="conversation-meta"><span>${l?time(l.at):''}</span>${c.unread?`<span class="unread">${c.unread}</span>`:''}</span>
        </button>`;
      }).join('') || `<div style="padding:18px;color:var(--muted);font-size:11px">No conversations found.</div>`;
    els.conversationList.querySelectorAll('[data-conv]').forEach(btn=>btn.addEventListener('click',()=>openConversation(btn.dataset.conv)));
  }

  function renderHeader(){
    const c=conv();
    els.activeTitle.textContent=c.title;
    els.activeAvatar.textContent=c.initials||initials(c.title);
    if(c.type==='group') els.activeStatus.textContent=`${c.members.length} house members`;
    else {
      const other=c.members.map(member).find(m=>m.id!==state.me.id);
      els.activeStatus.textContent=other?.online?'online':'direct message';
    }
  }

  function renderMessages(){
    const list=(state.messages[state.active]||[]);
    const q=els.messageSearchInput.value.trim().toLowerCase();
    let previousDay='';
    els.messages.innerHTML=list.map(m=>{
      const person=member(m.from), mine=m.from===state.me.id, day=dateLabel(m.at), dayHtml=day!==previousDay?`<div class="day-label">${day}</div>`:'';
      previousDay=day;
      const reactions=Object.entries(m.reactions||{}).map(([emoji,count])=>`<button class="reaction" type="button" data-react="${escapeHtml(m.id)}" data-emoji="${escapeHtml(emoji)}">${emoji} ${count}</button>`).join('');
      const hit=q && m.text.toLowerCase().includes(q);
      return `${dayHtml}<div class="msg-row ${mine?'mine':''} ${hit?'message-highlight':''}" data-message="${escapeHtml(m.id)}">
        <span class="avatar">${escapeHtml(person.initials||initials(person.name))}</span>
        <div class="msg-stack"><div class="msg-name">${escapeHtml(person.name)}</div><div class="bubble">${escapeHtml(m.text)}</div>${reactions?`<div class="reaction-row">${reactions}</div>`:''}<div class="msg-time">${time(m.at)}${mine?' · sent':''}</div></div>
      </div>`;
    }).join('') || `<div style="height:100%;display:grid;place-items:center;color:var(--muted);font-size:12px">Start the conversation.</div>`;
    els.messages.querySelectorAll('[data-react]').forEach(btn=>btn.addEventListener('click',()=>react(btn.dataset.react,btn.dataset.emoji)));
    els.messages.querySelectorAll('[data-message]').forEach(row=>row.addEventListener('dblclick',()=>beginReply(row.dataset.message)));
    requestAnimationFrame(()=>{ els.messages.scrollTop=els.messages.scrollHeight; });
  }

  function renderProfile(){
    els.meName.textContent=state.me.name;
    els.meAvatar.textContent=state.me.initials||initials(state.me.name);
    els.modeBadge.textContent=integration.connected?'connected':'standalone';
  }
  function render(){ renderProfile(); renderConversations(); renderHeader(); renderMessages(); updateSend(); }

  function openConversation(id){
    if(!state.conversations.some(c=>c.id===id)) return;
    state.active=id; const c=conv(); c.unread=0; save(); render(); closeSidebar(); els.input.focus();
  }

  function sendMessage(){
    const text=els.input.value.trim(); if(!text) return;
    const msg={id:`m_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,from:state.me.id,text,at:Date.now(),reactions:{},replyTo:replyTo?.id||null};
    (state.messages[state.active] ||= []).push(msg); els.input.value=''; autoGrow(); clearReply(); save(); render();
    if(integration.connected && integration.apiBase) postRemoteMessage(msg).catch(()=>toast('Saved locally. Remote sync is unavailable.'));
    simulateReply();
  }

  async function postRemoteMessage(msg){
    const res=await fetch(`${integration.apiBase.replace(/\/$/,'')}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({conversationId:state.active,text:msg.text,clientMessageId:msg.id})});
    if(!res.ok) throw new Error('sync failed');
  }

  function simulateReply(){
    if(integration.connected || conv().type==='group') return;
    const other=conv().members.find(x=>x!==state.me.id); if(!other) return;
    els.typing.classList.remove('hidden');
    clearTimeout(simulateReply._t);
    simulateReply._t=setTimeout(()=>{
      els.typing.classList.add('hidden');
      const c=conv(); if(c.id!==state.active) return;
      (state.messages[c.id] ||= []).push({id:`m_${Date.now()}`,from:other,text:'Got it 👍',at:Date.now(),reactions:{}}); save(); renderMessages(); renderConversations();
    },900);
  }

  function react(id,emoji){
    const m=(state.messages[state.active]||[]).find(x=>x.id===id); if(!m)return;
    m.reactions ||= {}; m.reactions[emoji]=(m.reactions[emoji]||0)+1; save(); renderMessages();
  }
  function beginReply(id){ const m=(state.messages[state.active]||[]).find(x=>x.id===id); if(!m)return; replyTo=m; els.replyText.textContent=`Replying to: ${m.text.slice(0,90)}`; els.replyBar.classList.remove('hidden'); els.input.focus(); }
  function clearReply(){ replyTo=null; els.replyBar.classList.add('hidden'); }

  function newChatModal(){
    const candidates=state.members.filter(m=>!state.conversations.some(c=>c.type==='dm'&&c.members.includes(m.id)));
    const root=$('#modalRoot');
    root.innerHTML=`<div class="modal-backdrop"><div class="modal"><button class="icon-btn modal-close" id="modalClose">×</button><h2>New message</h2><p>Start a direct conversation with a house member.</p><div class="member-pick">${candidates.map(m=>`<button type="button" data-member="${m.id}"><b>${escapeHtml(m.name)}</b><br><small>${m.online?'online':'house member'}</small></button>`).join('')||'<span style="color:var(--muted);font-size:11px">Every member already has a conversation.</span>'}</div></div></div>`;
    $('#modalClose').onclick=()=>root.innerHTML='';
    root.querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>{ const m=member(b.dataset.member); const c={id:m.id,type:'dm',title:m.name,initials:m.initials||initials(m.name),unread:0,members:[state.me.id,m.id]}; state.conversations.push(c); state.messages[c.id]=[]; state.active=c.id; save(); root.innerHTML=''; render(); });
  }

  function infoModal(){
    const c=conv(), root=$('#modalRoot');
    root.innerHTML=`<div class="modal-backdrop"><div class="modal"><button class="icon-btn modal-close" id="modalClose">×</button><h2>${escapeHtml(c.title)}</h2><p>${c.type==='group'?'Household group conversation':'Private conversation between house members'}.</p><p><b>Microfrontend:</b> House Chat v${VERSION}<br><b>Mode:</b> ${integration.connected?'House Five connected':'standalone local preview'}<br><b>Future integration:</b> shared House Five identity and server-side authorization.</p></div></div>`;
    $('#modalClose').onclick=()=>root.innerHTML='';
  }

  function toast(text){ els.toast.textContent=text; els.toast.classList.remove('hidden'); clearTimeout(toast._t); toast._t=setTimeout(()=>els.toast.classList.add('hidden'),1800); }
  function autoGrow(){ els.input.style.height='auto'; els.input.style.height=`${Math.min(130,els.input.scrollHeight)}px`; updateSend(); }
  function updateSend(){ els.send.disabled=!els.input.value.trim(); }
  function openSidebar(){ els.sidebar.classList.add('open'); els.drawerScrim.classList.remove('hidden'); }
  function closeSidebar(){ els.sidebar.classList.remove('open'); els.drawerScrim.classList.add('hidden'); }
  function toggleMessageSearch(){ els.messageSearch.classList.toggle('hidden'); if(!els.messageSearch.classList.contains('hidden')) els.messageSearchInput.focus(); else {els.messageSearchInput.value=''; renderMessages();} }

  function setTheme(theme){ document.documentElement.dataset.theme=theme; localStorage.setItem(THEME_KEY,theme); }
  function toggleTheme(){ setTheme((document.documentElement.dataset.theme||'dark')==='dark'?'light':'dark'); }

  function returnHome(){
    const params=new URLSearchParams(location.search); const target=integration.returnUrl||params.get('return')||'/';
    location.href=target;
  }

  function applyContext(ctx={}){
    if(ctx.user){ state.me={id:String(ctx.user.id||'me'),name:ctx.user.displayName||ctx.user.name||'House member',initials:ctx.user.initials||initials(ctx.user.displayName||ctx.user.name||'House member')}; }
    if(Array.isArray(ctx.members)&&ctx.members.length){ state.members=ctx.members.filter(m=>String(m.id)!==state.me.id).map(m=>({id:String(m.id),name:m.displayName||m.name||'Member',initials:m.initials||initials(m.displayName||m.name||'Member'),online:Boolean(m.online)})); }
    integration={connected:true,returnUrl:ctx.returnUrl||'/',apiBase:ctx.apiBase||null}; render();
  }

  window.HouseFiveChat={
    version:VERSION,
    configure:applyContext,
    getState:()=>clone(state),
    resetLocal:()=>{localStorage.removeItem(STORE_KEY);state=clone(seed);render();}
  };

  $('#homeBtn').addEventListener('click',returnHome);
  $('#themeBtn').addEventListener('click',toggleTheme);
  $('#menuBtn').addEventListener('click',openSidebar);
  els.drawerScrim.addEventListener('click',closeSidebar);
  els.search.addEventListener('input',renderConversations);
  els.input.addEventListener('input',autoGrow);
  els.input.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} });
  els.send.addEventListener('click',sendMessage);
  $('#newChatBtn').addEventListener('click',newChatModal);
  $('#infoBtn').addEventListener('click',infoModal);
  $('#searchMessagesBtn').addEventListener('click',toggleMessageSearch);
  $('#closeMessageSearch').addEventListener('click',toggleMessageSearch);
  els.messageSearchInput.addEventListener('input',renderMessages);
  $('#clearReply').addEventListener('click',clearReply);
  $('#attachBtn').addEventListener('click',()=>toast('Attachment API hook is ready for the connected version.'));
  $('#emojiBtn').addEventListener('click',()=>els.emojiTray.classList.toggle('hidden'));
  const emojis=['👍','❤️','😂','🔥','🙏','✅'];
  els.emojiTray.innerHTML=emojis.map(e=>`<button type="button" data-emoji="${e}">${e}</button>`).join('');
  els.emojiTray.querySelectorAll('[data-emoji]').forEach(b=>b.addEventListener('click',()=>{els.input.value+=b.dataset.emoji;autoGrow();els.emojiTray.classList.add('hidden');els.input.focus();}));

  setTheme(localStorage.getItem(THEME_KEY)||'dark');
  render(); autoGrow();
})();
