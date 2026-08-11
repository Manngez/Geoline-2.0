'use strict';

const CLASSROOM_PREFIX = 'geoline-class-';
const CLASSROOM_MAX_TEAMS = 8;

function classroomState() {
  return {...publicState(), classroomPaused:game.classroomPaused, roomCode:game.roomCode};
}

function sendClassroom(conn, payload) {
  if (conn?.open) { try { conn.send(payload); } catch {} }
}

function broadcastClassroom(payload) {
  (game.classConnections || []).forEach(item => sendClassroom(item.conn, payload));
}

function classroomTeamRows() {
  if (!game.players.length) return '<div class="classroom-note">Teams appear here as students join.</div>';
  return `<div class="class-team-list">${game.players.map((team,i)=>`<div class="class-team"><strong>${i+1}. ${escapeHtml(team.name)}</strong><span>Connected</span></div>`).join('')}</div>`;
}

function renderClassroomHostForm() {
  els.onlineEyebrow.textContent='Classroom mode'; els.onlineTitle.textContent='Teacher setup';
  els.onlinePanel.innerHTML=`<div class="online-field"><label for="teacherName">Teacher name</label><input id="teacherName" maxlength="24" value="Teacher" /></div><button id="createClassButton" class="primary-button wide" type="button">Create classroom →</button><div class="classroom-note">Up to eight teams can join. No student accounts or full names are needed.</div>`;
  $('createClassButton').addEventListener('click', createClassroomRoom);
}

function renderClassroomLobby() {
  const ready=game.players.length>=2;
  els.onlineEyebrow.textContent='Teacher lobby'; els.onlineTitle.textContent='Teams join with this code';
  els.onlinePanel.innerHTML=`<div class="room-code-display"><div><div class="eyebrow">Class code</div><strong>${escapeHtml(game.roomCode||'------')}</strong></div><button id="copyClassCode" class="secondary-button" type="button">Copy code</button></div>${classroomTeamRows()}<button id="startClassButton" class="primary-button wide" type="button" ${ready?'':'disabled'}>Start class game (${game.players.length}/8) →</button><p class="form-hint">Keep this tab open and show the map on the classroom display. At least two teams are required.</p>`;
  $('copyClassCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(game.roomCode);$('copyClassCode').textContent='Copied!';}catch{showToast(`Class code: ${game.roomCode}`);}});
  $('startClassButton').addEventListener('click',startClassroomGame);
}

function createClassroomRoom() {
  if(!window.Peer) return showToast('Online library failed to load. Check your connection.','error');
  destroyOnline(); game.mode='classroom'; game.onlineRole='teacher'; game.myPlayerIndex=null; game.players=[]; game.classConnections=[]; game.classroomPaused=false; game.roomCode=randomCode();
  renderClassroomLobby();
  const peer=new Peer(CLASSROOM_PREFIX+game.roomCode.toLowerCase()); game.peer=peer;
  peer.on('connection',conn=>wireClassroomTeacherConnection(conn));
  peer.on('error',err=>{console.error(err);showToast(err.type==='unavailable-id'?'Room code collision. Create a new classroom.':'Could not create classroom.','error',5000);});
}

function wireClassroomTeacherConnection(conn) {
  let record=null;
  conn.on('data',data=>{
    if(!data||typeof data!=='object') return;
    if(data.type==='classHello') {
      if(game.players.length>=CLASSROOM_MAX_TEAMS){sendClassroom(conn,{type:'classRejected',reason:'This classroom is full.'});conn.close();return;}
      const index=game.players.length;
      const name=String(data.name||`Team ${index+1}`).trim().slice(0,24)||`Team ${index+1}`;
      game.players.push({name}); record={conn,index,name,connected:true}; game.classConnections.push(record); game.connected=true;
      sendClassroom(conn,{type:'classWelcome',playerIndex:index,state:classroomState()});
      broadcastClassroom({type:'classLobby',state:classroomState()});
      if($('onlineScreen').classList.contains('active')) renderClassroomLobby();
    } else if(data.type==='classMove' && record) {
      if(game.classroomPaused) return sendClassroom(conn,{type:'moveRejected',reason:'The teacher paused the game.'});
      if(data.playerIndex!==record.index) return;
      const result=applyMove(data.place,record.index);
      if(!result.ok) sendClassroom(conn,{type:'moveRejected',reason:result.reason});
    }
  });
  conn.on('close',()=>{if(record){record.connected=false;if($('gameScreen').classList.contains('active'))showToast(`${record.name} disconnected.`,'error');}});
}

function startClassroomGame() {
  if(game.players.length<2) return showToast('At least two teams must join.','error');
  startGame('classroom',game.players); game.onlineRole='teacher';game.myPlayerIndex=null;game.connected=true;game.classroomPaused=false;
  installTeacherControls(); broadcastClassroom({type:'classStart',state:classroomState()}); updateGameUI();
}

function renderClassroomJoinForm() {
  els.onlineEyebrow.textContent='Join a class'; els.onlineTitle.textContent='Enter the teacher’s code';
  els.onlinePanel.innerHTML=`<div class="online-field"><label for="classTeamName">Team name</label><input id="classTeamName" maxlength="24" value="Team" /></div><div class="online-field"><label for="classCodeInput">Six-character class code</label><input id="classCodeInput" maxlength="6" autocomplete="off" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:.16em;font-weight:900" /></div><button id="joinClassButton" class="primary-button wide" type="button">Join classroom →</button><div id="classJoinStatus" class="connection-pill hidden">Connecting…</div>`;
  $('joinClassButton').addEventListener('click',joinClassroomRoom);
}

function joinClassroomRoom() {
  const code=String($('classCodeInput').value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==6) return showToast('Enter the six-character class code.','error');
  if(!window.Peer) return showToast('Online library failed to load.','error');
  const name=String($('classTeamName').value||'Team').trim().slice(0,24)||'Team';
  destroyOnline();game.mode='classroom';game.onlineRole='team';game.myPlayerIndex=null;game.roomCode=code;game.players=[{name}];
  $('joinClassButton').disabled=true;$('classJoinStatus').classList.remove('hidden');
  const peer=new Peer();game.peer=peer;
  peer.on('open',()=>{const conn=peer.connect(CLASSROOM_PREFIX+code.toLowerCase(),{reliable:true});game.conn=conn;wireClassroomTeamConnection(conn,name);});
  peer.on('error',err=>{console.error(err);$('classJoinStatus').textContent='Could not connect';showToast('Could not join that classroom. Check the code.','error',5000);});
}

function wireClassroomTeamConnection(conn,name) {
  conn.on('open',()=>{game.connected=true;sendClassroom(conn,{type:'classHello',name});$('classJoinStatus').textContent='Connected — waiting for teacher';$('classJoinStatus').classList.add('connected');});
  conn.on('close',()=>{game.connected=false;updateGameUI();showToast('Classroom connection closed.','error',5000);});
  conn.on('data',data=>{
    if(!data||typeof data!=='object')return;
    if(data.type==='classWelcome'){game.myPlayerIndex=data.playerIndex;consumeState(data.state);}
    else if(data.type==='classLobby')consumeState(data.state);
    else if(data.type==='classStart'){consumeState(data.state);showScreen('game');initMap();updateGameUI();}
    else if(data.type==='sync'||data.type==='classReset'){consumeState(data.state);}
    else if(data.type==='moveRejected'){showToast(data.reason||'Move rejected by teacher.','error');updateGameUI();}
    else if(data.type==='classRejected'){showToast(data.reason,'error',5000);}
  });
}

function installTeacherControls() {
  if(game.onlineRole!=='teacher'||$('teacherControls'))return;
  const panel=document.createElement('div');panel.id='teacherControls';panel.className='teacher-controls';
  panel.innerHTML=`<div class="teacher-controls-head"><strong>Teacher controls</strong><span>${escapeHtml(game.roomCode)}</span></div><div class="teacher-control-grid"><button id="classPause" class="secondary-button" type="button">Pause</button><button id="classUndo" class="secondary-button" type="button">Undo move</button><button id="classSkip" class="secondary-button" type="button">Skip team</button><button id="classReset" class="secondary-button" type="button">New round</button></div>`;
  els.cityForm.insertAdjacentElement('afterend',panel);
  $('classPause').addEventListener('click',()=>{game.classroomPaused=!game.classroomPaused;$('classPause').textContent=game.classroomPaused?'Resume':'Pause';broadcastClassroom({type:'sync',state:classroomState()});updateGameUI();});
  $('classUndo').addEventListener('click',()=>{const removed=game.route.pop();if(!removed)return showToast('There is no move to undo.','error');game.finished=false;resultPayload=null;game.currentIndex=removed.playerIndex;els.resultModal.classList.add('hidden');renderMapState();updateGameUI();broadcastClassroom({type:'sync',state:classroomState()});showToast('Last move undone.');});
  $('classSkip').addEventListener('click',()=>{if(!game.players.length)return;game.currentIndex=(game.currentIndex+1)%game.players.length;updateGameUI();broadcastClassroom({type:'sync',state:classroomState()});});
  $('classReset').addEventListener('click',()=>{resetGameState(true);game.classroomPaused=false;broadcastClassroom({type:'classReset',state:classroomState()});});
}
