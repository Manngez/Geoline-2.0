'use strict';

const CLASSROOM_PREFIX = 'geoline-class-';
const CLASSROOM_MAX_TEAMS = 8;

function resetClassroomControls() {
  game.classroomSettings={locked:false,approvalRequired:false,inputOpen:true,showLabels:false,scoringEnabled:true,allowedStates:[]};
  game.classroomScores=[];game.classroomPendingMove=null;game.classroomRoundEnded=null;game.classroomTimerRemaining=0;game.classroomTimerPreset=0;
  if(game.classroomTimerId)clearInterval(game.classroomTimerId);game.classroomTimerId=null;
}
function classroomState(){return {...publicState(),classroomSettings:{...game.classroomSettings},classroomScores:[...game.classroomScores],classroomRoundEnded:game.classroomRoundEnded,classroomTimerRemaining:game.classroomTimerRemaining,roomCode:game.roomCode};}
function sendClassroom(conn,payload){if(conn?.open){try{conn.send(payload);}catch{}}}
function broadcastClassroom(payload){(game.classConnections||[]).forEach(item=>sendClassroom(item.conn,payload));}
function broadcastClassroomState(type='sync'){broadcastClassroom({type,state:classroomState()});updateGameUI();refreshTeacherControls();}
function recordForIndex(index){return (game.classConnections||[]).find(r=>r.index===index);}
function nextConnectedIndex(from=game.currentIndex){if(!game.players.length)return 0;for(let step=1;step<=game.players.length;step++){const i=(from+step)%game.players.length,r=recordForIndex(i);if(!r||r.connected!==false)return i;}return from;}

function classroomTeamRows(){
  if(!game.players.length)return '<div class="classroom-note">Teams appear here as students join.</div>';
  return `<div class="class-team-list">${game.players.map((team,i)=>{const r=recordForIndex(i);return `<div class="class-team"><strong>${i+1}. ${escapeHtml(team.name)}</strong><span class="${r?.connected===false?'offline':''}">${r?.connected===false?'Disconnected':'Connected'}</span></div>`;}).join('')}</div>`;
}
function renderClassroomHostForm(){els.onlineEyebrow.textContent='Classroom mode';els.onlineTitle.textContent='Teacher setup';els.onlinePanel.innerHTML=`<button id="createClassButton" class="primary-button wide" type="button">Create classroom →</button><div class="classroom-note">Up to eight teams can join with team names only. No accounts are required.</div>`;$('createClassButton').addEventListener('click',createClassroomRoom);}
function renderClassroomLobby(){
  const ready=game.players.length>=2;els.onlineEyebrow.textContent='Teacher lobby';els.onlineTitle.textContent='Teams join with this code';
  els.onlinePanel.innerHTML=`<div class="room-code-display"><div><div class="eyebrow">Class code</div><strong>${escapeHtml(game.roomCode||'------')}</strong></div><button id="copyClassCode" class="secondary-button" type="button">Copy code</button></div>${classroomTeamRows()}<button id="startClassButton" class="primary-button wide" type="button" ${ready?'':'disabled'}>Start class game (${game.players.length}/8) →</button><p class="form-hint">At least two teams are required. The room locks automatically when play begins.</p>`;
  $('copyClassCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(game.roomCode);$('copyClassCode').textContent='Copied!';}catch{showToast(`Class code: ${game.roomCode}`);}});$('startClassButton').addEventListener('click',startClassroomGame);
}
function createClassroomRoom(){
  if(!window.Peer)return showToast('Online library failed to load. Check your connection.','error');
  destroyOnline();resetClassroomControls();game.mode='classroom';game.onlineRole='teacher';game.myPlayerIndex=null;game.players=[];game.classConnections=[];game.roomCode=randomCode();renderClassroomLobby();
  const peer=new Peer(CLASSROOM_PREFIX+game.roomCode.toLowerCase());game.peer=peer;peer.on('connection',wireClassroomTeacherConnection);peer.on('error',err=>{console.error(err);showToast(err.type==='unavailable-id'?'Room code collision. Create a new classroom.':'Could not create classroom.','error',5000);});
}
function wireClassroomTeacherConnection(conn){
  let record=null;conn.on('data',data=>{
    if(!data||typeof data!=='object')return;
    if(data.type==='classHello'){
      if(game.classroomSettings.locked)return sendClassroom(conn,{type:'classRejected',reason:'The teacher locked this classroom.'});
      if(game.players.length>=CLASSROOM_MAX_TEAMS)return sendClassroom(conn,{type:'classRejected',reason:'This classroom is full.'});
      const index=game.players.length,name=String(data.name||`Team ${index+1}`).trim().slice(0,24)||`Team ${index+1}`;game.players.push({name});game.classroomScores[index]=0;record={conn,index,name,connected:true};game.classConnections.push(record);game.connected=true;
      sendClassroom(conn,{type:'classWelcome',playerIndex:index,state:classroomState()});broadcastClassroom({type:'classLobby',state:classroomState()});if($('onlineScreen').classList.contains('active'))renderClassroomLobby();
    }else if(data.type==='classMove'&&record)handleClassroomMoveRequest(record,data);
  });
  conn.on('close',()=>{if(record&&!record.kicked){record.connected=false;if(game.currentIndex===record.index&&!game.finished)game.currentIndex=nextConnectedIndex(record.index);broadcastClassroomState();showToast(`${record.name} disconnected.`,'error');}});
}
function validateClassroomPlace(place){
  if(game.classroomPaused)return 'The teacher paused the game.';if(game.classroomSettings.inputOpen===false)return 'The teacher locked answers.';
  const allowed=game.classroomSettings.allowedStates||[];if(allowed.length&&!allowed.includes(String(place.stateCode||'').toUpperCase()))return `Only these states are allowed: ${allowed.join(', ')}.`;return null;
}
function handleClassroomMoveRequest(record,data){
  if(data.playerIndex!==record.index)return;const invalid=validateClassroomPlace(data.place);if(invalid)return sendClassroom(record.conn,{type:'moveRejected',reason:invalid});
  if(game.classroomSettings.approvalRequired){if(game.classroomPendingMove)return sendClassroom(record.conn,{type:'moveRejected',reason:'The teacher is reviewing another answer.'});game.classroomPendingMove={record,place:data.place};sendClassroom(record.conn,{type:'movePending'});refreshTeacherControls();return;}
  acceptClassroomMove(record,data.place);
}
function acceptClassroomMove(record,place){
  const result=applyMove(place,record.index);if(!result.ok)return sendClassroom(record.conn,{type:'moveRejected',reason:result.reason});if(game.classroomSettings.scoringEnabled)game.classroomScores[record.index]=(game.classroomScores[record.index]||0)+1;
  game.classroomPendingMove=null;stopClassroomTimer(false);if(game.classroomTimerPreset>0&&!game.finished)startClassroomTimer(game.classroomTimerPreset);broadcastClassroomState();
}
function approvePendingMove(){const p=game.classroomPendingMove;if(p)acceptClassroomMove(p.record,p.place);}
function rejectPendingMove(){const p=game.classroomPendingMove;if(!p)return;sendClassroom(p.record.conn,{type:'moveRejected',reason:'The teacher rejected that place.'});game.classroomPendingMove=null;refreshTeacherControls();}
function startClassroomGame(){if(game.players.length<2)return showToast('At least two teams must join.','error');game.classroomSettings.locked=true;startGame('classroom',game.players);game.onlineRole='teacher';game.myPlayerIndex=null;game.connected=true;game.classroomPaused=false;installTeacherControls();broadcastClassroom({type:'classStart',state:classroomState()});updateGameUI();}

function renderClassroomJoinForm(){els.onlineEyebrow.textContent='Join a class';els.onlineTitle.textContent='Enter the teacher’s code';els.onlinePanel.innerHTML=`<div class="online-field"><label for="classTeamName">Team name</label><input id="classTeamName" maxlength="24" value="Team" /></div><div class="online-field"><label for="classCodeInput">Six-character class code</label><input id="classCodeInput" maxlength="6" autocomplete="off" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:.16em;font-weight:900" /></div><button id="joinClassButton" class="primary-button wide" type="button">Join classroom →</button><div id="classJoinStatus" class="connection-pill hidden">Connecting…</div>`;$('joinClassButton').addEventListener('click',joinClassroomRoom);}
function joinClassroomRoom(){
  const code=String($('classCodeInput').value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!==6)return showToast('Enter the six-character class code.','error');if(!window.Peer)return showToast('Online library failed to load.','error');
  const name=String($('classTeamName').value||'Team').trim().slice(0,24)||'Team';destroyOnline();resetClassroomControls();game.mode='classroom';game.onlineRole='team';game.myPlayerIndex=null;game.roomCode=code;game.players=[{name}];$('joinClassButton').disabled=true;$('classJoinStatus').classList.remove('hidden');
  const peer=new Peer();game.peer=peer;peer.on('open',()=>{const conn=peer.connect(CLASSROOM_PREFIX+code.toLowerCase(),{reliable:true});game.conn=conn;wireClassroomTeamConnection(conn,name);});peer.on('error',err=>{console.error(err);$('classJoinStatus').textContent='Could not connect';showToast('Could not join that classroom. Check the code.','error',5000);});
}
function wireClassroomTeamConnection(conn,name){
  conn.on('open',()=>{game.connected=true;sendClassroom(conn,{type:'classHello',name});$('classJoinStatus').textContent='Connected — waiting for teacher';$('classJoinStatus').classList.add('connected');});conn.on('close',()=>{game.connected=false;updateGameUI();showToast('Classroom connection closed.','error',5000);});
  conn.on('data',data=>{if(!data||typeof data!=='object')return;if(data.type==='classWelcome'){game.myPlayerIndex=data.playerIndex;consumeState(data.state);}else if(data.type==='classLobby')consumeState(data.state);else if(data.type==='classStart'){consumeState(data.state);showScreen('game');initMap();updateGameUI();}else if(data.type==='sync'||data.type==='classReset'||data.type==='timer')consumeState(data.state);else if(data.type==='movePending')showToast('Your answer is waiting for teacher approval.');else if(data.type==='moveRejected'){showToast(data.reason||'Move rejected by teacher.','error');updateGameUI();}else if(data.type==='classRejected')showToast(data.reason,'error',5000);else if(data.type==='kicked'){showToast('The teacher removed this team.','error',6000);destroyOnline();showScreen('home');}});
}

function startClassroomTimer(seconds){
  stopClassroomTimer(false);game.classroomTimerPreset=seconds;game.classroomTimerRemaining=seconds;game.classroomSettings.inputOpen=true;broadcastClassroomState('timer');
  game.classroomTimerId=setInterval(()=>{game.classroomTimerRemaining=Math.max(0,game.classroomTimerRemaining-1);if(game.classroomTimerRemaining===0){stopClassroomTimer(false);game.classroomSettings.inputOpen=false;showToast('Time is up — answers locked.','error');}broadcastClassroomState('timer');},1000);
}
function stopClassroomTimer(clearPreset=true){if(game.classroomTimerId)clearInterval(game.classroomTimerId);game.classroomTimerId=null;game.classroomTimerRemaining=0;if(clearPreset)game.classroomTimerPreset=0;}
function addClassroomTime(seconds=30){startClassroomTimer((game.classroomTimerRemaining||0)+seconds);}
function buildClassroomSummary(reason='Round ended by teacher'){
  const states=[...new Set(game.route.map(p=>p.stateCode).filter(Boolean))];let longest=null;for(let i=1;i<game.route.length;i++){const a=game.route[i-1],b=game.route[i],d=Math.hypot((b.lat-a.lat)*69,(b.lon-a.lon)*54);if(!longest||d>longest.distance)longest={from:a.name,to:b.name,distance:d};}
  const max=Math.max(0,...game.classroomScores),winners=game.players.filter((_,i)=>(game.classroomScores[i]||0)===max).map(p=>p.name);return {reason,places:game.route.length,states,winners,maxScore:max,longest};
}
function endClassroomRound(){game.finished=true;game.classroomPaused=true;game.classroomSettings.inputOpen=false;stopClassroomTimer();game.classroomRoundEnded=buildClassroomSummary();broadcastClassroomState();showClassroomRoundSummary(game.classroomRoundEnded);}
function showClassroomRoundSummary(summary){
  els.resultIcon.textContent='🏫';els.resultTitle.textContent=summary.winners?.length?`${summary.winners.join(' & ')} lead the class`:'Class round complete';els.resultText.textContent=`${summary.reason}. ${summary.places} places across ${summary.states?.length||0} states.${game.classroomSettings.scoringEnabled?` Top score: ${summary.maxScore}.`:''}`;
  const longest=summary.longest?` Longest connection: ${summary.longest.from} → ${summary.longest.to} (~${Math.round(summary.longest.distance)} miles).`:'';els.resultRoute.textContent=`States: ${summary.states?.join(', ')||'None'}.${longest}`;els.resultModal.classList.remove('hidden');
}
function startNewClassroomRound(){stopClassroomTimer();game.route=[];game.currentIndex=0;game.finished=false;game.classroomPaused=false;game.classroomSettings.inputOpen=true;game.classroomPendingMove=null;game.classroomRoundEnded=null;resultPayload=null;els.resultModal.classList.add('hidden');renderMapState();broadcastClassroomState('classReset');}
function chooseClassroomTeam(index){if(index<0||index>=game.players.length)return;game.currentIndex=index;game.classroomPendingMove=null;broadcastClassroomState();}
function adjustClassroomScore(index,amount){game.classroomScores[index]=Math.max(0,(game.classroomScores[index]||0)+amount);broadcastClassroomState();}
function renameClassroomTeam(index){const current=game.players[index]?.name;if(!current)return;const name=prompt('New team name',current);if(!name)return;game.players[index].name=String(name).trim().slice(0,24)||current;const r=recordForIndex(index);if(r)r.name=game.players[index].name;broadcastClassroomState();}
function disconnectClassroomTeam(index){const r=recordForIndex(index);if(!r)return;r.kicked=true;sendClassroom(r.conn,{type:'kicked'});r.connected=false;try{r.conn.close();}catch{}if(game.currentIndex===index)game.currentIndex=nextConnectedIndex(index);broadcastClassroomState();}
function applyStateFilter(){const raw=$('classStateFilter')?.value||'';game.classroomSettings.allowedStates=[...new Set(raw.toUpperCase().split(/[^A-Z]+/).filter(x=>x.length===2))];broadcastClassroomState();showToast(game.classroomSettings.allowedStates.length?`Allowed states: ${game.classroomSettings.allowedStates.join(', ')}`:'All U.S. states allowed.');}

function installTeacherControls(){if(game.onlineRole!=='teacher')return;let panel=$('teacherControls');if(!panel){panel=document.createElement('div');panel.id='teacherControls';panel.className='teacher-controls';els.cityForm.insertAdjacentElement('afterend',panel);}refreshTeacherControls();}
function refreshTeacherControls(){
  const panel=$('teacherControls');if(!panel||game.onlineRole!=='teacher')return;const pending=game.classroomPendingMove,current=game.players[game.currentIndex]?.name||'—';
  panel.innerHTML=`<div class="teacher-controls-head"><div><strong>Teacher controls</strong><small>${escapeHtml(game.roomCode||'')}</small></div><button id="teacherPanelToggle" class="teacher-mini-button" type="button">${game.teacherPanelCollapsed?'Open':'Hide'}</button></div>${game.teacherPanelCollapsed?'':`<div class="teacher-live"><span>Current: <strong>${escapeHtml(current)}</strong></span><span>${game.classroomTimerRemaining>0?`${game.classroomTimerRemaining}s`:'No timer'}</span></div>${pending?`<div class="teacher-pending"><small>Awaiting approval</small><strong>${escapeHtml(pending.place.name)}${pending.place.stateCode?`, ${escapeHtml(pending.place.stateCode)}`:''}</strong><div><button id="classApprove" class="primary-button" type="button">Approve</button><button id="classReject" class="secondary-button" type="button">Reject</button></div></div>`:''}<div class="teacher-control-grid"><button id="classPause" class="secondary-button" type="button">${game.classroomPaused?'Resume':'Pause'}</button><button id="classUndo" class="secondary-button" type="button">Undo</button><button id="classSkip" class="secondary-button" type="button">Next team</button><button id="classEnd" class="secondary-button danger-text" type="button">End round</button></div><div class="teacher-toggles"><label><input id="classApproval" type="checkbox" ${game.classroomSettings.approvalRequired?'checked':''}> Approve places</label><label><input id="classInputOpen" type="checkbox" ${game.classroomSettings.inputOpen?'checked':''}> Answers open</label><label><input id="classLabels" type="checkbox" ${game.classroomSettings.showLabels?'checked':''}> Map labels</label><label><input id="classLocked" type="checkbox" ${game.classroomSettings.locked?'checked':''}> Room locked</label><label><input id="classScoring" type="checkbox" ${game.classroomSettings.scoringEnabled?'checked':''}> Auto scoring</label></div><div class="teacher-timer"><button data-timer="30" type="button">30s</button><button data-timer="60" type="button">60s</button><button id="classAddTime" type="button">+30s</button><button id="classStopTimer" type="button">Stop</button></div><div class="teacher-scope"><input id="classStateFilter" value="${escapeHtml((game.classroomSettings.allowedStates||[]).join(', '))}" placeholder="States: CA, TX (blank = all)"><button id="classApplyStates" type="button">Apply</button></div><div class="teacher-team-manager">${game.players.map((team,i)=>`<div class="teacher-team-row ${i===game.currentIndex?'active':''}"><button class="team-select" data-team="${i}" type="button"><span>${escapeHtml(team.name)}</span><small>${recordForIndex(i)?.connected===false?'Offline':'Choose turn'}</small></button><strong>${game.classroomScores[i]||0}</strong><button data-score="${i}:1" type="button">+</button><button data-score="${i}:-1" type="button">−</button><button data-rename="${i}" type="button">✎</button><button data-kick="${i}" type="button">×</button></div>`).join('')}</div><div class="teacher-footer-actions"><button id="classNewRound" type="button">New round</button><button id="classResetScores" type="button">Reset scores</button></div>`}`;
  $('teacherPanelToggle').addEventListener('click',()=>{game.teacherPanelCollapsed=!game.teacherPanelCollapsed;refreshTeacherControls();});if(game.teacherPanelCollapsed)return;
  $('classApprove')?.addEventListener('click',approvePendingMove);$('classReject')?.addEventListener('click',rejectPendingMove);$('classPause').addEventListener('click',()=>{game.classroomPaused=!game.classroomPaused;broadcastClassroomState();});
  $('classUndo').addEventListener('click',()=>{const removed=game.route.pop();if(!removed)return showToast('There is no move to undo.','error');if(game.classroomSettings.scoringEnabled)game.classroomScores[removed.playerIndex]=Math.max(0,(game.classroomScores[removed.playerIndex]||0)-1);game.finished=false;game.classroomRoundEnded=null;resultPayload=null;game.currentIndex=removed.playerIndex;els.resultModal.classList.add('hidden');renderMapState();broadcastClassroomState();});
  $('classSkip').addEventListener('click',()=>{game.currentIndex=nextConnectedIndex();game.classroomPendingMove=null;if(game.classroomTimerPreset>0)startClassroomTimer(game.classroomTimerPreset);else broadcastClassroomState();});$('classEnd').addEventListener('click',endClassroomRound);
  [['classApproval','approvalRequired'],['classInputOpen','inputOpen'],['classLabels','showLabels'],['classLocked','locked'],['classScoring','scoringEnabled']].forEach(([id,key])=>$(id).addEventListener('change',e=>{game.classroomSettings[key]=e.target.checked;if(key==='showLabels')renderMapState();broadcastClassroomState();}));
  panel.querySelectorAll('[data-timer]').forEach(b=>b.addEventListener('click',()=>startClassroomTimer(Number(b.dataset.timer))));$('classAddTime').addEventListener('click',()=>addClassroomTime(30));$('classStopTimer').addEventListener('click',()=>{stopClassroomTimer();broadcastClassroomState();});$('classApplyStates').addEventListener('click',applyStateFilter);
  panel.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>chooseClassroomTeam(Number(b.dataset.team))));panel.querySelectorAll('[data-score]').forEach(b=>b.addEventListener('click',()=>{const[i,n]=b.dataset.score.split(':').map(Number);adjustClassroomScore(i,n);}));panel.querySelectorAll('[data-rename]').forEach(b=>b.addEventListener('click',()=>renameClassroomTeam(Number(b.dataset.rename))));panel.querySelectorAll('[data-kick]').forEach(b=>b.addEventListener('click',()=>disconnectClassroomTeam(Number(b.dataset.kick))));
  $('classNewRound').addEventListener('click',startNewClassroomRound);$('classResetScores').addEventListener('click',()=>{game.classroomScores=game.players.map(()=>0);broadcastClassroomState();});
}
