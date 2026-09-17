/* Standalone simulation: deliberately does not import Willow, call Trilium or use the clipboard/network. */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    leaf:'M3 14C2 5 10 2 14 2c0 8-3 13-11 12ZM3 14 11 6',
    undo:'M6 4 2 8l4 4M2 8h8a5 5 0 0 1 0 10', redo:'m14 4 4 4-4 4m4-4h-8a5 5 0 0 0 0 10',
    child:'M3 3v12h6M3 7h6m5 3v8m-4-4h8', sibling:'M3 4h14M3 10h6m5-3v10m-5-5h10',
    edit:'m4 14 9-9 3 3-9 9-4 1 1-4ZM12 6l3 3', checkbox:'M8 3H3v14h14v-6M7 8l4 4 7-9',
    collapse:'M3 10h14m-4-4 4 4-4 4M7 6l-4 4 4 4', more:'M4 10h.01M10 10h.01M16 10h.01',
    chevron:'m7 4 6 6-6 6', down:'m5 8 5 5 5-5', plus:'M10 3v14M3 10h14', minus:'M3 10h14',
    fit:'M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4', search:'M14 14l4 4M15 9A6 6 0 1 1 3 9a6 6 0 0 1 12 0',
    note:'M4 2h8l4 4v12H4ZM12 2v5h4', folder:'M2 5h6l2 2h8v10H2Z', map:'M4 10h6m0-6v12m0-12h6m-6 12h6',
    clock:'M10 5v5l3 2M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', settings:'M10 2v3m0 10v3M2 10h3m10 0h3M4 4l2 2m8 8 2 2M4 16l2-2m8-8 2-2M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    back:'m12 4-6 6 6 6', forward:'m8 4 6 6-6 6', split:'M2 3h16v14H2Zm8 0v14', check:'m4 10 4 4 8-9',
    lock:'M5 9h10v9H5ZM7 9V5a3 3 0 0 1 6 0v4', help:'M8 7a3 3 0 1 1 4 2c-2 1-2 2-2 3m0 3h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    home:'m2 9 8-7 8 7M5 7v11h10V7', star:'m10 2 2.5 5 5.5 1-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1Z'
  };
  // Original Willow paths, drawn on CKEditor’s 20px grid. No third-party SVGs copied.
  const refinedPaths = {
    undo: '<path d="M6.5 3.5 2.75 7.25 6.5 11M3.5 7.25h8.25a4.5 4.5 0 0 1 0 9H8.5"/>',
    redo: '<path d="m13.5 3.5 3.75 3.75L13.5 11m3-3.75H8.25a4.5 4.5 0 0 0 0 9h3.25"/>',
    child: '<rect x="2.75" y="2.75" width="7.5" height="4.5" rx=".6"/><path d="M6.5 7.5V14h1.75M14.75 11v6m-3-3h6"/>',
    sibling: '<rect x="3.75" y="2.75" width="10.5" height="4.5" rx=".6"/><path d="M4 12.5h4m-4 4h4m6.5-5.5v7m-3.5-3.5h7"/>',
    delete: '<path fill="currentColor" stroke="none" d="M2.6 3.5C1.8 3.1 2.8 2 3.8 2.1C6.3 2.9 9.7 6 12.6 9.7C14.8 12.3 16.5 15.6 17.1 17.6C15.5 16.2 13.5 12.8 10.7 10.1C7.5 7.2 4.5 4.7 2.6 3.5ZM3.4 17.8C2.4 16.5 4.1 13.6 6.8 10.6C10.6 6.4 15.4 2.8 18.7 2C16.4 3.8 13.4 6.2 10.4 9.8C7.8 12.9 6.1 15.5 5.4 17.3C5 18.3 4 18.5 3.4 17.8Z"/>',
    edit: '<path d="m4 12.5 8.5-8.5 3.5 3.5-8.5 8.5-4.25.75L4 12.5ZM10.75 5.75l3.5 3.5"/>',
    checkbox: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="m6 10 2.75 2.75L14.25 7"/>',
    collapse: '<circle cx="10" cy="10" r="7.25"/><path d="M10 6.5v7M6.5 10h7"/>',
    expand: '<circle cx="10" cy="10" r="7.25"/><path d="M10 6.5v7M6.5 10h7"/>',
    help: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.25"/><path d="M5 7.5h.25m3-.0h.25m3 0h.25m3 0h.25M5 10h.25m3 0h.25m3 0h.25m3 0h.25M6.25 13h7.5"/>',
    documentation: '<circle cx="10" cy="10" r="7.25"/><path d="M7.8 7.6a2.3 2.3 0 0 1 4.5 .7c0 1.6-2.3 1.8-2.3 3.4m0 2.5h.01"/>',
    fit: '<path d="M7.5 3H3v4.5M12.5 3H17v4.5M3 12.5V17h4.5M17 12.5V17h-4.5"/>',
    plus: '<path d="M10 3.5v13M3.5 10h13"/>', minus: '<path d="M3.5 10h13"/>',
    down: '<path d="m5.5 8 4.5 4.5L14.5 8"/>'
  };
  const icon = name => refinedPaths[name]
    ? `<svg class="icon refined-icon" viewBox="0 0 20 20" aria-hidden="true">${refinedPaths[name]}</svg>`
    : `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="${paths[name] || paths.note}"/></svg>`;
  const query = new URLSearchParams(location.search);
  let theme = query.get('theme') === 'dark' ? 'dark' : 'light';
  let layout = query.get('layout') === 'split' ? 'split' : 'full';
  let platform = query.get('platform') === 'windows' ? 'windows' : 'mac';
  let mode = query.get('state') || 'saved';
  const states = [['saved','Saved'],['editing','Editing label'],['unsaved','Unsaved changes'],['saving','Saving…'],['error','Save failed'],['conflict','Incoming changes'],['recovering','Recovering…'],['readonly','Read-only note'],['viewer','Viewing in second pane'],['loading','Loading map'],['invalid','Invalid document']];
  if (!states.some(([id])=>id===mode)) mode='saved';
  let nodes, selected, zoom = 1, undoStack = [], redoStack = [], clip = [], timer, toastTimer, editId, provisionalSnapshot, sourceShown = false;
  let menuTrigger, uiHidden = false;
  const primary = () => platform === 'mac' ? '⌘' : 'Ctrl+';
  const short = s => s.replace('Primary+',primary());
  const option = (id,label,value) => `<option value="${id}" ${id===value?'selected':''}>${label}</option>`;
  function seed() {
    nodes = [
      {id:'root',text:'Field guide',parent:null},
      {id:'purpose',text:'Purpose',parent:'root',side:'left'},
      {id:'audience',text:'A calmer workspace',parent:'purpose'},
      {id:'principle',text:'Keep the map in focus',parent:'purpose'},
      {id:'research',text:'Research',parent:'root',side:'left'},
      {id:'notes',text:'Collect field notes',parent:'research',checked:true},
      {id:'interviews',text:'Three short interviews',parent:'research',checked:false},
      {id:'archive',text:'Reference archive',parent:'research',collapsed:true},
      {id:'hidden1',text:'Previous studies',parent:'archive'},
      {id:'hidden2',text:'Reading list',parent:'archive'},
      {id:'structure',text:'Structure',parent:'root',side:'right'},
      {id:'outline',text:'Draft the outline',parent:'structure',checked:false},
      {id:'examples',text:'Choose examples',parent:'structure',checked:true},
      {id:'link',text:'https://triliumnotes.org',parent:'structure'},
      {id:'publish',text:'Publish',parent:'root',side:'right'},
      {id:'review',text:'Review together',parent:'publish',checked:false},
      {id:'release',text:'Share the first edition',parent:'publish'},
      {id:'later',text:'Next iteration',parent:'root',side:'right',collapsed:true},
      {id:'feedback',text:'Gather feedback',parent:'later'}
    ];
    selected = ['outline']; undoStack=[]; redoStack=[]; editId=undefined; provisionalSnapshot=undefined;
  }
  seed();
  document.documentElement.dataset.theme=theme;
  $('#app').innerHTML = `
    <header class="lab">
      <div class="lab-top"><div class="wordmark">${icon('leaf')} willow <small>Design study / 06</small></div>
        <div class="preview-controls"><label>Theme <select id="theme">${option('light','Light',theme)}${option('dark','Dark',theme)}</select></label><label>Viewport <select id="layout">${option('full','Full width',layout)}${option('split','Narrow split pane',layout)}</select></label></div>
      </div>
      <div class="lab-bottom"><div><h1>Toolbar & status bar</h1><p>Clear actions, quiet status, and a shared command vocabulary.</p></div>
        <div class="scenarios"><label>State <select id="state">${states.map(([id,label])=>option(id,label,mode)).join('')}</select></label>
        <label>Selection <select id="selection">${[['single','Task'],['multiple','Two tasks'],['branch','Branch'],['root','Root'],['link','Link'],['none','None']].map(([id,label])=>option(id,label,'single')).join('')}</select></label>
        <label>Keys <select id="platform">${option('mac','Mac',platform)}${option('windows','Win / Linux',platform)}</select></label><button id="reset">Reset demo</button></div>
      </div>
    </header>
    <div class="shell ${layout==='split'?'split':''}">
      <aside class="launcher" aria-label="Trilium launcher (static preview)"><span class="brand">${icon('leaf')}</span>${['note','search','map','clock','star'].map(icon).join('')}<span class="bottom">${icon('settings')}</span></aside>
      <aside class="sidebar" aria-label="Trilium note tree (static preview)"><div class="search">Quick search ${icon('search')}</div>
        <div class="tree-row">${icon('down')}${icon('folder')} Personal</div><div class="tree-row indent">${icon('note')} Inbox</div><div class="tree-row indent">${icon('note')} Daily notes</div>
        <div class="tree-row">${icon('down')}${icon('folder')} Projects</div><div class="tree-row indent selected">${icon('map')} Field guide</div><div class="tree-row indent">${icon('note')} Working notes</div><div class="tree-row indent">${icon('note')} Reading list</div>
        <div class="tree-label">Workspace</div><div class="tree-row">${icon('chevron')}${icon('folder')} Archive</div><div class="tree-row">${icon('chevron')}${icon('folder')} Templates</div>
      </aside>
      <main class="workspace"><div class="tabs">${icon('back')}${icon('forward')}<div class="tab">${icon('map')} Field guide <span class="close">×</span></div>${icon('plus')}</div>
        <div class="panes"><section class="note-pane" aria-label="Willow mindmap preview">
          <header class="note-header"><span class="note-emblem">${icon('map')}</span><span class="note-title">Field guide</span><span class="header-save"></span><span class="note-type">Render note⌄</span><span class="header-icon optional">${icon('split')}</span><span class="header-icon">${icon('more')}</span></header>
          <div class="map-area"><div class="toolbar" role="toolbar" aria-label="Mindmap commands"></div><div id="notice-slot"></div><div class="canvas" tabindex="0" role="tree" aria-label="Field guide mindmap; simulated interactions" aria-multiselectable="true"></div><footer class="statusbar" aria-label="Mindmap status and viewport"></footer><span class="sr-only" id="announcement" role="status" aria-live="polite"></span></div>
        </section><section class="other-pane" aria-label="Working notes (static preview)"><header class="note-header"><span class="note-emblem">${icon('note')}</span><span class="note-title">Working notes</span><span class="header-save">✓ Saved</span></header><article class="other-content"><p class="muted">PROJECTS / FIELD GUIDE</p><h2>A little room to think.</h2><p>The guide starts with a simple question: what belongs in a calmer workspace?</p><h3>For the next review</h3><ul><li>Walk through the outline.</li><li>Choose a few useful examples.</li><li>Keep the first edition small.</li></ul><blockquote>Make the next action easy to find, then let the work take the space.</blockquote><p class="muted">This neighboring note is part of the shared preview fixture.</p></article></section></div>
        <div class="host-footer">${icon('home')} › Projects › <b>Field guide</b><span class="right">1 path · 2 attributes</span></div>
      </main>
    </div>
    <div class="review-note"><span>200ms tooltips · 10-point zoom buttons · keyboard shortcuts dialog</span><span>Local simulation · select nodes, open More or right-click · no changes are saved</span></div>`;
  const pane = $('.note-pane'), canvas = $('.canvas'), area = $('.map-area');
  const active = () => nodes.find(n=>n.id===selected.at(-1));
  const children = id => nodes.filter(n=>n.parent===id);
  const blocked = () => ['readonly','viewer','loading','invalid','recovering'].includes(mode);
  const missing = () => ['loading','invalid'].includes(mode);
  const snap = () => JSON.stringify({nodes,selected});
  function restore(value) { ({nodes,selected}=JSON.parse(value)); }
  function visibleNodes() { return nodes.filter(n=> { let p=n; while(p.parent) { p=nodes.find(a=>a.id===p.parent); if(!p || p.collapsed)return false; } return true; }); }
  const menuItems = () => [
    ['edit','Edit','F2'],['insertChild','Add child','Tab',true],['insertBefore','Add sibling before','Shift+Enter'],['insertAfter','Add sibling after','Enter'],['insertParent','Insert parent','Shift+Tab'],['delete','Delete','Delete'],
    ['cut','Cut','Primary+X',true],['copy','Copy','Primary+C'],['paste','Paste','Primary+V'],['toggleCollapse',active()?.collapsed?'Expand':'Collapse','Space',true],
    [active()?.checked!==undefined?'removeCheckbox':'addCheckbox',active()?.checked!==undefined?'Remove checkbox':'Add checkbox','Primary+1',true],['toggleChecked','Toggle checked state','Ctrl+Space'],['openLink','Open link','',true]
  ];
  const contextMenuItems = () => [...menuItems(), ['toggleUI',uiHidden?'Show UI':'Hide UI','',true]];
  function can(cmd) {
    if(['help','documentation','hideUI','toggleUI','actions'].includes(cmd))return true;
    if(missing() || mode==='recovering')return false;
    if(['zoomIn','zoomOut','resetZoom','fit','help','actions'].includes(cmd))return true;
    if(cmd==='copy')return selected.length>0;
    if(cmd==='openLink')return /^https?:\/\/\S+$/.test(active()?.text||'');
    if(blocked())return false;
    if(cmd==='undo')return undoStack.length>0 || !!provisionalSnapshot;
    if(cmd==='redo')return redoStack.length>0;
    if(!selected.length)return false;
    if(cmd==='delete'||cmd==='cut')return !selected.includes('root');
    if(cmd==='toggleCollapse')return children(active().id).length>0;
    if(cmd==='toggleChecked')return selected.some(id=>nodes.find(n=>n.id===id)?.checked!==undefined);
    return true;
  }
  function btn(cmd,name,ic,cls='') {
    const shortcut = menuItems().find(a=>a[0]===cmd)?.[2] || ({undo:'Primary+Z',redo:'Primary+Shift+Z',fit:'Primary+Shift+0',resetZoom:'Primary+0',zoomIn:'Primary++',zoomOut:'Primary+-'}[cmd]);
    return `<button type="button" data-command="${cmd}" class="${cls}" aria-label="${name}" data-tooltip="${name}${shortcut?' ('+short(shortcut)+')':''}" ${can(cmd)?'':'disabled'}>${icon(ic)}${cls.includes('icon-only')?'':`<span>${name}</span>`}</button>`;
  }
  function renderToolbar() {
    const checkbox=active()?.checked!==undefined?'removeCheckbox':'addCheckbox';
    const checkLabel=checkbox==='removeCheckbox'?'Remove checkbox':'Add checkbox';
    hideTooltip();
    $('.toolbar').innerHTML=`<div class="group history-group">${btn('undo','Undo','undo','icon-only')}${btn('redo','Redo','redo','icon-only')}</div><span class="divider history-divider"></span>
      <div class="group creation-group">${btn('insertChild','Add child','child')}${btn('insertAfter','Add sibling','sibling')}${btn('delete','Delete','delete','icon-only')}</div><span class="divider edit-divider"></span>
      <div class="group edit-group">${btn('edit','Edit','edit','icon-only')}${btn(checkbox,checkLabel,'checkbox','icon-only')}${btn('toggleCollapse',active()?.collapsed?'Expand':'Collapse',active()?.collapsed?'expand':'collapse','icon-only')}</div>
      <button data-command="actions" class="more-button" aria-label="More commands" aria-haspopup="menu" aria-expanded="false" data-tooltip="More commands" ${can('actions')?'':'disabled'}><span>More</span>${icon('down')}</button>
      <span class="spacer"></span>${btn('help','Keyboard shortcuts','help','icon-only shortcuts-button')}${btn('documentation','Documentation','documentation','icon-only documentation-button')}`;
  }
  function renderStatus() {
    let context='';
    if(mode==='readonly')context='Read-only';
    if(mode==='viewer')context='Viewing · another pane owns editing';
    if(mode==='editing')context='Editing label · Enter to finish · Esc to cancel';
    if(mode==='loading')context='Loading map…';
    if(mode==='invalid')context='Map unavailable';
    if(mode==='recovering')context='Recovering…';
    $('.statusbar').innerHTML=`<span class="context" title="${esc(context)}">${esc(context)}</span><span class="spacer"></span><div class="zoom-tools">${btn('zoomOut','Zoom out','minus','icon-only')}<button class="zoom" data-command="resetZoom" data-tooltip="Reset zoom (${short('Primary+0')})" aria-label="Reset zoom to 100 percent" ${missing()||mode==='recovering'?'disabled':''}>${Math.round(zoom*100)}%</button>${btn('zoomIn','Zoom in','plus','icon-only')}<span class="divider"></span><button data-command="fit" data-tooltip="Fit map (${short('Primary+Shift+0')})" ${can('fit')?'':'disabled'}>${icon('fit')}<span class="fit-label">Fit</span></button></div>`;
    $('[data-command="zoomOut"]').disabled ||= zoom<=.25;
    $('[data-command="zoomIn"]').disabled ||= zoom>=4;
  }
  function renderState() {
    $('#state').value=mode;
    const label={saved:'Saved',editing:'Unsaved',unsaved:'Unsaved',saving:'Saving…',error:'Save failed',conflict:'Conflict',recovering:'Recovering…',readonly:'Read-only',viewer:'Saved',loading:'Loading…',invalid:'Error'}[mode];
    $('.header-save').innerHTML=(mode==='saved'||mode==='viewer'?icon('check'):'')+label;
    $('.header-save').classList.toggle('error',['error','conflict','invalid'].includes(mode));
    const notice={
      error:['Save failed.','Your draft is retained in this session.', [['retry','Retry save'],['keep','Keep both'],['incoming','Use incoming']]],
      conflict:['Another version arrived.','Keep both saves local work as a sibling map, then loads the saved original.',[['keep','Keep both'],['incoming','Use incoming']]],
      recovering:['Recovering…','Keep this pane open while the recovery copy is saved.',[]],
      viewer:['Viewing this map.','It is being edited in another pane.',[['take','Edit here']]],
      readonly:['Read-only note.','Selection, copying and zoom are available. Collapse changes the document and is disabled.',[]],
      invalid:['This map could not be opened.','Inspect the original source or reload the saved map.',[['source','View original source'],['reload','Reload saved map']]]
    }[mode];
    $('#notice-slot').innerHTML=notice?`<div class="notice ${['readonly','viewer'].includes(mode)?'info':''}" role="${['error','conflict','invalid'].includes(mode)?'alert':'status'}"><div class="notice-copy"><strong>${notice[0]}</strong> ${notice[1]}</div>${notice[2].map(([id,text])=>`<button data-recovery="${id}">${text}</button>`).join('')}</div>`:'';
    canvas.setAttribute('aria-readonly',String(blocked()));
  }
  // Layout is only a design fixture; line-based branches and ellipse root mirror the existing renderer.
  function positions() {
    const result=[];
    const measure=document.createElement('canvas').getContext('2d'); measure.font='12px Arial';
    const width=n=>Math.ceil(measure.measureText(n.text).width)+12+(n.checked!==undefined?17:0);
    const height=n=>n.collapsed||!children(n.id).length?35:Math.max(35,children(n.id).reduce((s,k)=>s+height(k),0));
    result.push({...nodes.find(n=>n.id==='root'),x:385,y:178,w:130,h:44});
    function place(n,edge,cy,side){
      const w=width(n), x=side==='right'?edge:edge-w;
      const pos={...n,x,y:cy-12,w,h:24,side};result.push(pos);
      if(n.collapsed)return;
      const list=children(n.id); let top=cy-list.reduce((s,k)=>s+height(k),0)/2;
      for(const child of list){const h=height(child);place(child,side==='right'?x+w+35:x-35,top+h/2,side);top+=h;}
    }
    for(const side of ['left','right']){
      const list=children('root').filter(n=>n.side===side);let top=200-list.reduce((s,n)=>s+height(n)+15,0)/2;
      for(const n of list){const h=height(n);place(n,side==='right'?565:335,top+h/2,side);top+=h+15;}
    }
    return result;
  }
  function renderMap(){
    if(missing()){
      canvas.innerHTML=`<div class="empty-state">${icon(mode==='loading'?'clock':'note')}<strong>${mode==='loading'?'Loading Field guide…':'Original document retained'}</strong><span>${mode==='loading'?'The map will appear when its document is ready.':'Choose an action above to inspect or reload it.'}</span>${sourceShown?'<textarea readonly class="source-preview" aria-label="Original source (simulated)">{ "version": 1, "root": "invalid fixture — original bytes retained" }</textarea>':''}</div>`;return;
    }
    const ps=positions();
    const lines=ps.filter(n=>n.parent).map(n=>{
      const p=ps.find(a=>a.id===n.parent);if(!p)return '';
      const right=n.side==='right'; const sx=p.id==='root'?(right?p.x+p.w:p.x):(right?p.x+p.w:p.x);
      const sy=p.id==='root'?p.y+22:p.y+24, ex=right?n.x:n.x+n.w, ey=n.y+24;
      return `<path d="M${sx} ${sy}C${(sx+ex)/2} ${sy} ${(sx+ex)/2} ${ey} ${ex} ${ey}H${right?n.x+n.w:n.x}"/>`;
    }).join('');
    canvas.innerHTML=`<div class="scene" style="transform:translate(-50%,-50%) scale(${zoom})"><svg class="branches" aria-hidden="true">${lines}</svg>${ps.map(n=>`<button class="map-node ${n.id==='root'?'root':''} ${selected.includes(n.id)?'selected':''} ${/^https?:/.test(n.text)?'link':''}" data-node="${n.id}" role="treeitem" tabindex="-1" aria-selected="${selected.includes(n.id)}" ${children(n.id).length?`aria-expanded="${!n.collapsed}"`:''} style="left:${n.x}px;top:${n.y}px;width:${n.w}px" title="${esc(n.text)}">${n.checked!==undefined?`<span class="node-check ${n.checked?'checked':''}" aria-hidden="true">${n.checked?'✓':''}</span>`:''}${esc(n.text)}</button>${n.collapsed?`<button class="marker" data-expand="${n.id}" aria-label="Expand ${esc(n.text)}" ${blocked()?'disabled':''} style="left:${n.side==='right'?n.x+n.w+2:n.x-8}px;top:${n.y+20}px"></button>`:''}`).join('')}</div><div class="canvas-hint">${blocked()?'View controls stay available.':'Right-click a node for all actions'}</div>`;
    if(editId){
      const p=ps.find(n=>n.id===editId);
      if(p){
        const input=document.createElement('textarea');input.className='edit-label';input.setAttribute('aria-label','Edit node label');input.value=nodes.find(n=>n.id===editId).text;
        Object.assign(input.style,{left:p.x+'px',top:p.y+'px',width:Math.max(135,p.w)+'px'});$('.scene').append(input);
        input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();finishEdit(true);}if(e.key==='Escape'){e.preventDefault();finishEdit(false);}});
        input.addEventListener('blur',()=>{if(editId)finishEdit(true);});input.focus();input.select();
      }
    }
  }
  function render(){
    $('.toast')?.remove();
    const presets={single:['outline'],multiple:['outline','examples'],branch:['structure'],root:['root'],link:['link'],none:[]};
    const preset=Object.keys(presets).find(key=>JSON.stringify(presets[key])===JSON.stringify(selected));
    if(preset)$('#selection').value=preset;
    closeMenu(false);renderState();renderToolbar();renderMap();renderStatus();}
  function toast(message){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;area.append(el);$('#announcement').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),2600);}
  function dirty(){mode='saving';renderState();clearTimeout(timer);timer=setTimeout(()=>{if(mode==='saving'){mode='saved';renderState();}},1000);}
  function commitSnapshot(before){undoStack.push(before);redoStack=[];dirty();}
  function finishEdit(commit){
    if(!editId)return;
    const n=nodes.find(n=>n.id===editId),value=$('.edit-label')?.value??n.text,before=provisionalSnapshot||snap();
    const isNew=!!provisionalSnapshot;editId=undefined;provisionalSnapshot=undefined;
    if(commit){if(value!==n.text||isNew){n.text=value;commitSnapshot(before);}else mode='saved';}
    else {if(isNew)restore(before);mode='saved';}
    render();canvas.focus();
  }
  function fit(){
    const ps=positions();const left=Math.min(...ps.map(n=>n.x)),right=Math.max(...ps.map(n=>n.x+n.w));
    const top=Math.min(...ps.map(n=>n.y)),bottom=Math.max(...ps.map(n=>n.y+n.h));
    // The fixture centers on the root, so use symmetric bounds around it.
    zoom=Math.max(.25,Math.min(1,(canvas.clientWidth-56)/(2*Math.max(450-left,right-450)),(canvas.clientHeight-110)/(2*Math.max(200-top,bottom-200))));
  }
  function perform(cmd, fromBar=false){
    if(!can(cmd))return;
    if(cmd==='documentation'){hideTooltip();closeMenu(false);toast('Documentation would open the Willow guide (simulated).');return;}
    if(cmd==='hideUI'||cmd==='toggleUI'){setUIHidden(cmd==='hideUI'||!uiHidden);return;}
    if(editId)finishEdit(true);
    if(cmd==='actions'){if($('[data-command="actions"]').getAttribute('aria-expanded')==='true'){closeMenu(true);return;}openMenu(overflowItems(),$('[data-command="actions"]'));return;}
    if(cmd==='help'){openShortcuts();return;}
    if(['zoomIn','zoomOut','resetZoom','fit'].includes(cmd)){
      if(cmd==='fit')fit();
      else if(cmd==='resetZoom')zoom=1;
      else {
        const next=fromBar
          ? Math.round((zoom+(cmd==='zoomIn'?.1:-.1))*1e10)/1e10
          : zoom*(cmd==='zoomIn'?1.2:1/1.2);
        zoom=Math.max(.25,Math.min(4,next));
      }
      renderMap();renderStatus();closeMenu(false);return;
    }
    if(cmd==='undo'||cmd==='redo'){
      const from=cmd==='undo'?undoStack:redoStack,to=cmd==='undo'?redoStack:undoStack;if(!from.length)return;
      to.push(snap());restore(from.pop());dirty();render();return;
    }
    if(cmd==='edit'){editId=active().id;mode='editing';render();return;}
    if(cmd==='copy'){clip=selected.map(id=>nodes.find(n=>n.id===id).text);toast('Copied to the demo clipboard');return;}
    if(cmd==='openLink'){toast('Simulated link opening · '+active().text);return;}
    const before=snap(), n=active();
    if(cmd.startsWith('insert')){
      const id='demo-'+Date.now();let parent=cmd==='insertChild'?n.id:n.parent||'root';
      const item={id,text:'New idea',parent,...(parent==='root'?{side:cmd==='insertParent'&&n.id==='root'?'left':n.side||'right'}:{})};
      if(cmd==='insertParent'&&n.id!=='root'){n.parent=id;item.side=n.side;}
      if(cmd==='insertChild')n.collapsed=false;
      if(cmd==='insertBefore')nodes.splice(nodes.indexOf(n),0,item);else if(cmd==='insertAfter')nodes.splice(nodes.indexOf(n)+1,0,item);else nodes.push(item);
      selected=[id];provisionalSnapshot=before;editId=id;mode='editing';render();return;
    }
    if(cmd==='delete'||cmd==='cut'){
      if(cmd==='cut')clip=selected.map(id=>nodes.find(n=>n.id===id).text);
      const removed=new Set(selected);let count;do{count=removed.size;nodes.forEach(a=>{if(removed.has(a.parent))removed.add(a.id);});}while(count!==removed.size);
      const fallback=n.parent;nodes=nodes.filter(a=>!removed.has(a.id));selected=[nodes.some(a=>a.id===fallback)?fallback:'root'];
    }
    if(cmd==='paste'){
      const pasted=(clip.length?clip:['Pasted idea']).map((text,i)=>({id:'paste-'+Date.now()+'-'+i,text,parent:n.id,...(n.id==='root'?{side:'right'}:{})}));nodes.push(...pasted);n.collapsed=false;selected=pasted.map(a=>a.id);
    }
    if(cmd==='toggleCollapse'){n.collapsed=!n.collapsed;selected=selected.filter(id=>visibleNodes().some(a=>a.id===id));}
    const checkedValue=nodes.some(a=>selected.includes(a.id)&&a.checked===false);
    if(['addCheckbox','removeCheckbox','toggleChecked'].includes(cmd))for(const a of nodes.filter(a=>selected.includes(a.id))){if(cmd==='addCheckbox'&&a.checked===undefined)a.checked=false;if(cmd==='removeCheckbox')delete a.checked;if(cmd==='toggleChecked'&&a.checked!==undefined)a.checked=checkedValue;}
    commitSnapshot(before);render();canvas.focus();
  }
  function setUIHidden(hidden) {
    uiHidden=hidden;hideTooltip();closeMenu(false);
    $('.toolbar').hidden=hidden;$('.statusbar').hidden=hidden;
    $('#announcement').textContent=hidden?'Toolbar and status bar hidden. Use the context menu to show UI.':'Toolbar and status bar shown.';
    ($('.edit-label')||canvas).focus({preventScroll:true});
  }
  function overflowItems() {
    const shown = new Set($$('.toolbar [data-command]').filter(b=>b.getClientRects().length).map(b=>b.dataset.command));
    let newGroup=false;
    const items=[];
    for(const item of menuItems()) {
      if(item[3])newGroup=true;
      if(shown.has(item[0]))continue;
      items.push([item[0],item[1],item[2],items.length>0&&newGroup]);newGroup=false;
    }
    if(!shown.has('undo'))items.push(['undo','Undo','Primary+Z',true],['redo','Redo','Primary+Shift+Z']);
    items.push(['hideUI','Hide UI','',true]);
    if(!shown.has('help'))items.push(['help','Keyboard shortcuts','',true]);
    if(!shown.has('documentation'))items.push(['documentation','Documentation','']);
    return items;
  }
  function openShortcuts() {
    hideTooltip();closeMenu(false);
    const invoker=$('[data-command="help"]')?.getClientRects().length?$('[data-command="help"]'):$('[data-command="actions"]');
    const sections=[
      ['Create & edit', [['Edit label','F2'],['Add child','Tab'],['Add sibling after','Enter'],['Add sibling before','Shift+Enter'],['Insert parent','Shift+Tab'],['Delete','Delete']]],
      ['While editing a label', [['Finish editing','Enter'],['Add a line','Shift+Enter'],['Cancel editing','Esc']]],
      ['Selection & structure', [['Navigate','Arrow keys'],['Extend selection','Shift+Arrow'],['Move selection','Primary+Arrow'],['Select all','Primary+A'],['Clear selection','Esc'],['Expand / collapse','Space']]],
      ['Tasks & history', [['Add / remove checkbox','Primary+1'],['Toggle checked state','Ctrl+Space'],['Undo','Primary+Z'],['Redo','Primary+Shift+Z'],['Cut / Copy / Paste','Primary+X / C / V']]],
      ['View & navigation', [['Zoom in / out','Primary++ / −'],['Reset zoom','Primary+0'],['Fit map','Primary+Shift+0'],['Open node menu','Shift+F10'],['Open link','Primary+click']]]
    ];
    const dialog=document.createElement('dialog');dialog.className='shortcuts-dialog';dialog.setAttribute('aria-labelledby','shortcuts-title');
    dialog.innerHTML=`<header class="dialog-header"><div><h2 id="shortcuts-title">Keyboard shortcuts</h2></div><button class="dialog-close" aria-label="Close keyboard shortcuts" autofocus>×</button></header><div class="shortcut-sections">${sections.map(([heading,rows])=>`<section><h3>${heading}</h3><dl>${rows.map(([label,key])=>`<div><dt>${label}</dt><dd><kbd>${esc(short(key))}</kbd></dd></div>`).join('')}</dl></section>`).join('')}</div><footer class="dialog-footer"><button class="dialog-done">Done</button></footer>`;
    document.body.append(dialog);dialog.showModal();
    dialog.addEventListener('close',()=>{dialog.remove();invoker?.focus();});
    $('.dialog-close',dialog).addEventListener('click',()=>dialog.close());$('.dialog-done',dialog).addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  }
  let tooltipTimer, tooltipAnchor;
  function hideTooltip(){
    clearTimeout(tooltipTimer);$('.bar-tooltip')?.remove();tooltipAnchor?.removeAttribute('aria-describedby');tooltipAnchor=undefined;
  }
  function showTooltip(button,delay=200){
    hideTooltip();if(!button?.dataset.tooltip||$('.menu')||$('dialog[open]'))return;
    tooltipAnchor=button;
    tooltipTimer=setTimeout(()=>{
      if(!button.isConnected||!button.getClientRects().length)return;
      const tip=document.createElement('div');tip.className='bar-tooltip';tip.id='willow-bar-tooltip';tip.setAttribute('role','tooltip');tip.textContent=button.dataset.tooltip;
      document.body.append(tip);button.setAttribute('aria-describedby',tip.id);
      const r=button.getBoundingClientRect(),t=tip.getBoundingClientRect();
      const above=button.closest('.statusbar');
      tip.style.left=Math.max(8,Math.min(r.left+r.width/2-t.width/2,innerWidth-t.width-8))+'px';
      tip.style.top=Math.max(8,Math.min(above?r.top-t.height-6:r.bottom+6,innerHeight-t.height-8))+'px';
    },delay);
  }
  area.addEventListener('pointerover',e=>{const button=e.target.closest('[data-tooltip]');if(button&&!button.contains(e.relatedTarget))showTooltip(button);});
  area.addEventListener('pointerout',e=>{const button=e.target.closest('[data-tooltip]');if(button&&!button.contains(e.relatedTarget))hideTooltip();});
  area.addEventListener('focusin',e=>{const button=e.target.closest('[data-tooltip]');if(button?.matches(':focus-visible'))showTooltip(button,0);});
  area.addEventListener('focusout',hideTooltip);
  document.addEventListener('pointerdown',hideTooltip,true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();});
  window.addEventListener('resize',hideTooltip);window.addEventListener('scroll',hideTooltip,true);
  function closeMenu(focus=false){$('[data-command="actions"]')?.setAttribute('aria-expanded','false');const existed=$('.menu');existed?.remove();if(focus&&existed){(menuTrigger?.isConnected?menuTrigger:canvas).focus();}}
  function openMenu(items,trigger,x,y){
    hideTooltip();closeMenu(false);menuTrigger=trigger;
    if(trigger?.dataset.command==='actions')trigger.setAttribute('aria-expanded','true');const menu=document.createElement('div');menu.className='menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',trigger?.dataset.command==='actions'?'More commands':'Node commands');
    menu.innerHTML=items.map(([cmd,label,key,sep])=>`${sep?'<div class="menu-separator" role="separator"></div>':''}<button role="menuitem" tabindex="-1" data-menu-command="${cmd}" aria-disabled="${cmd==='noop'?'true':!can(cmd)}" ${key?`aria-keyshortcuts="${key.replace('Primary',platform==='mac'?'Meta':'Control').replace('Ctrl','Control')}"`:''}><span>${label}</span><span class="shortcut" aria-hidden="true">${short(key||'')}</span></button>`).join('');
    area.append(menu);const r=area.getBoundingClientRect(),tr=trigger?.getBoundingClientRect();
    menu.style.left=Math.max(4,Math.min(x??tr.left-r.left,area.clientWidth-menu.offsetWidth-4))+'px';
    menu.style.top=Math.max(4,Math.min(y??tr.bottom-r.top+4,area.clientHeight-menu.offsetHeight-4))+'px';
    const buttons=$$('button',menu);buttons[0].focus({preventScroll:true});
    menu.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.getAttribute('aria-disabled')!=='true'){closeMenu(false);perform(b.dataset.menuCommand);if(!editId&&!$('dialog[open]'))canvas.focus();}});
    menu.addEventListener('keydown',e=>{e.stopPropagation();const i=buttons.indexOf(document.activeElement);let next;
      if(e.key==='ArrowDown')next=(i+1)%buttons.length;if(e.key==='ArrowUp')next=(i+buttons.length-1)%buttons.length;if(e.key==='Home')next=0;if(e.key==='End')next=buttons.length-1;
      if(next!==undefined){e.preventDefault();menu.classList.add('navigated');buttons[next].focus();buttons[next].scrollIntoView({block:'nearest'});}
      if(['Escape','Tab'].includes(e.key)){e.preventDefault();closeMenu(true);}
    });
  }
  area.addEventListener('pointerdown',e=>{if(editId && e.target.closest('[data-command]'))e.preventDefault();});
  area.addEventListener('click',e=>{
    const b=e.target.closest('[data-command]');if(b){perform(b.dataset.command,true);return;}
    const marker=e.target.closest('[data-expand]');if(marker&&!blocked()){
      const before=snap();nodes.find(n=>n.id===marker.dataset.expand).collapsed=false;commitSnapshot(before);render();return;
    }
    const n=e.target.closest('[data-node]');if(n){
      if(mode==='recovering')return;
      const id=n.dataset.node;
      if(e.ctrlKey||e.metaKey){selected=selected.includes(id)?selected.filter(a=>a!==id):[...selected,id];}else selected=[id];
      renderToolbar();renderMap();renderStatus();canvas.focus();
    }
    const action=e.target.closest('[data-recovery]')?.dataset.recovery;if(action)recover(action);
  });
  canvas.addEventListener('dblclick',e=>{if(e.target.closest('[data-node]'))perform('edit');});
  canvas.addEventListener('contextmenu',e=>{
    if(e.target.closest('textarea'))return;e.preventDefault();
    const n=e.target.closest('[data-node]');if(n&&!missing()&&mode!=='recovering'&&!selected.includes(n.dataset.node)){selected=[n.dataset.node];renderToolbar();renderMap();renderStatus();}
    const r=area.getBoundingClientRect();openMenu(contextMenuItems(),canvas,e.clientX-r.left,e.clientY-r.top);
  });
  canvas.addEventListener('keydown',e=>{
    if(e.target.closest('textarea'))return;
    if(e.key==='F10'&&e.shiftKey||e.key==='ContextMenu'){e.preventDefault();openMenu(contextMenuItems(),canvas,30,80);return;}
    const p=platform==='mac'?e.metaKey:e.ctrlKey;let cmd;
    if(e.key==='F2')cmd='edit';if(e.key==='Tab')cmd=e.shiftKey?'insertParent':'insertChild';if(e.key==='Enter')cmd=e.shiftKey?'insertBefore':'insertAfter';if(e.key==='Delete')cmd='delete';
    if(e.key===' ')cmd=e.ctrlKey&&!e.metaKey?'toggleChecked':!e.metaKey?'toggleCollapse':undefined;
    if(p){const k=e.key.toLowerCase();cmd=({z:e.shiftKey?'redo':'undo',y:'redo',c:'copy',x:'cut',v:'paste','1':active()?.checked!==undefined?'removeCheckbox':'addCheckbox','+':'zoomIn','=':'zoomIn','-':'zoomOut','0':e.shiftKey?'fit':'resetZoom'})[k];if(e.shiftKey&&e.code==='Digit0')cmd='fit';}
    if(cmd){e.preventDefault();perform(cmd);}
    if(e.key==='Escape'){selected=[];render();}
  });
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menu')&&!e.target.closest('[data-command="actions"]'))closeMenu(false);});
  document.addEventListener('focusin',e=>{if($('.menu')&&!e.target.closest('.menu'))closeMenu(false);});
  function recover(action){
    if(action==='source'){sourceShown=!sourceShown;renderMap();return;}
    if(action==='incoming'&&!confirm('Simulation: discard your local changes and load the saved original?'))return;
    clearTimeout(timer);
    if(action==='take'){mode='saved';render();toast('Editing transferred to this pane (simulated)');return;}
    if(action==='retry'){mode='saving';render();timer=setTimeout(()=>{mode='saved';render();toast('Save completed (simulated)');},1100);return;}
    mode='recovering';render();timer=setTimeout(()=>{seed();mode='saved';sourceShown=false;render();toast(action==='keep'?'Local work saved as a sibling recovery map (simulated)':'Saved map loaded (simulated)');},1100);
  }
  $('#theme').addEventListener('change',e=>{theme=e.target.value;document.documentElement.dataset.theme=theme;});
  $('#layout').addEventListener('change',e=>{if(editId)finishEdit(true);layout=e.target.value;$('.shell').classList.toggle('split',layout==='split');fit();render();});
  $('#platform').addEventListener('change',e=>{platform=e.target.value;renderToolbar();renderStatus();closeMenu(false);});
  $('#state').addEventListener('change',e=>{if(editId)finishEdit(false);clearTimeout(timer);mode=e.target.value;sourceShown=false;if(mode==='editing'){selected=['outline'];editId='outline';}render();});
  $('#selection').addEventListener('change',e=>{if(editId)finishEdit(true);selected=({single:['outline'],multiple:['outline','examples'],branch:['structure'],root:['root'],link:['link'],none:[]})[e.target.value];render();});
  $('#reset').addEventListener('click',()=>{setUIHidden(false);clearTimeout(timer);seed();mode='saved';sourceShown=false;$('#selection').value='single';zoom=1;fit();render();});
  $('.toolbar').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const buttons=$$('button:not(:disabled)',$('.toolbar')).filter(b=>b.getClientRects().length);const i=buttons.indexOf(document.activeElement);
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length;e.preventDefault();buttons[next]?.focus();
  });
  if(mode==='editing')editId='outline';
  render();fit();renderMap();renderStatus();
  new ResizeObserver(()=>{hideTooltip();closeMenu(false);}).observe(pane);
})();
