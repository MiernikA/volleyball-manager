/* eslint-disable no-irregular-whitespace */
import {useEffect,useMemo,useState} from 'react';
import {ArrowRightLeft,Pause,Shield,TrendingUp,UserPlus} from 'lucide-react';
import fieldBackground from './field.png';

type TeamId='A'|'B';
type RotationPosition=1|2|3|4|5|6;
type PlayerPosition='S'|'OPP'|'OH'|'MB'|'L';
type TeamSnapshot={id:TeamId;name:string;playerIdsByRotation:Record<RotationPosition,string|null>;liberoId:string|null};
type Player={id:string;firstName:string;lastName:string;displayName:string;position:PlayerPosition;photoUrl:string|null;heightCm:number|null;birthDate:string|null};
type PlayerDataset={players:Player[]};

const positions:RotationPosition[]=[1,2,3,4,5,6];
const backRowPositions:RotationPosition[]=[5,6,1];
const courtOrder:Record<TeamId,RotationPosition[]>={A:[4,3,2,5,6,1],B:[2,3,4,1,6,5]};
const roleClass:Record<PlayerPosition,string>={S:'r-s',OPP:'r-opp',OH:'r-oh',MB:'r-mb',L:'r-l'};
const events=[['01:11','Rozegranie akcji…'],['01:10','Atak!'],['01:10','Blok!'],['01:09','Obrona!'],['01:09','Punkt dla Drużyny A! (18:15)']];

const ageOf=(date:string|null)=>{if(!date)return null;const birth=new Date(date),today=new Date();let age=today.getFullYear()-birth.getFullYear();if(today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate()))age--;return age};
const initials=(player:Player)=>`${player.firstName[0]??''}${player.lastName[0]??''}`;

function getCourtLineup(team:TeamSnapshot,players:Map<string,Player>){
  const libero=team.liberoId?players.get(team.liberoId):undefined;
  const liberoPosition=libero?backRowPositions.find(position=>{const id=team.playerIdsByRotation[position];return id&&players.get(id)?.position==='MB'}):undefined;
  return positions.flatMap(position=>{
    const id=team.playerIdsByRotation[position],assignedPlayer=id?players.get(id):undefined;
    if(!assignedPlayer)return [];
    const replacedPlayer=position===liberoPosition?assignedPlayer:undefined;
    return [{player:replacedPlayer&&libero?libero:assignedPlayer,position,replacedPlayer}];
  });
}

function validateTeam(team:TeamSnapshot,players:Map<string,Player>){
  const ids=positions.map(position=>team.playerIdsByRotation[position]);
  const selected=ids.filter((id):id is string=>Boolean(id));
  const all=[...selected,...(team.liberoId?[team.liberoId]:[])];
  const counts:Record<Exclude<PlayerPosition,'L'>,number>={S:0,OPP:0,OH:0,MB:0};
  selected.forEach(id=>{const position=players.get(id)?.position;if(position&&position!=='L')counts[position]++});
  const missing=6-selected.length;
  const reasons:string[]=[];
  if(missing)reasons.push(`${missing} ${missing===1?'wolne miejsce':'wolne miejsca'} w rotacji`);
  if(!team.liberoId)reasons.push('brak libero');
  if(new Set(all).size!==all.length)reasons.push('zawodnik występuje więcej niż raz');
  if(all.some(id=>!players.has(id)))reasons.push('niedostępny zawodnik');
  if(selected.some(id=>players.get(id)?.position==='L')||(team.liberoId&&players.get(team.liberoId)?.position!=='L'))reasons.push('libero na nieprawidłowej pozycji');
  if(selected.length===6&&(counts.S!==1||counts.OPP!==1||counts.OH!==2||counts.MB!==2))reasons.push('wymagany skład: 1 S, 1 OPP, 2 OH i 2 MB');
  return reasons;
}

function CourtPlayer({player,position,replacedPlayer}:{player:Player;position:RotationPosition;replacedPlayer?:Player}){
  const substitution=replacedPlayer?` · za ${replacedPlayer.displayName}`:'';
  return <div className={`court-player rotation-${position} ${replacedPlayer?'libero-substitution':''}`} title={`${player.displayName} · ${player.position} · strefa ${position}${substitution}`}>
    <i>{player.photoUrl?<img src={player.photoUrl} alt=""/>:initials(player)}</i>
    <span><b className={roleClass[player.position]}>{player.position}</b>{player.lastName}</span>
  </div>;
}

function MatchArena({teams,players,loading,error}:{teams:Record<TeamId,TeamSnapshot>;players:Map<string,Player>;loading:boolean;error:string|null}){
  const issues={A:validateTeam(teams.A,players),B:validateTeam(teams.B,players)};
  const incomplete=loading||Boolean(error)||issues.A.length>0||issues.B.length>0;
  return <div className={`arena panel ${incomplete?'arena-incomplete':''}`} aria-label="Boisko podczas symulacji meczu" style={{backgroundImage:`url(${fieldBackground})`}}>
    {!loading&&(['A','B'] as TeamId[]).map(team=>{
      const lineup=getCourtLineup(teams[team],players).sort((a,b)=>a.player.id.localeCompare(b.player.id));
      return <div className={`court-team ${team==='A'?'blue-team':'red-team'}`} key={team}>{lineup.map(({player,position,replacedPlayer})=><CourtPlayer player={player} position={position} replacedPlayer={replacedPlayer} key={`${team}-${player.id}`}/>)}</div>;
    })}
    {incomplete&&<div className="arena-message" role="status"><Shield/><strong>{loading?'Wczytywanie składów…':error??'Nie można rozpocząć symulacji'}</strong>{!loading&&!error&&<>{issues.A.length>0&&<p><b>{teams.A.name}:</b> {issues.A.join(', ')}</p>}{issues.B.length>0&&<p><b>{teams.B.name}:</b> {issues.B.join(', ')}</p>}<a href="#squad">Uzupełnij składy w „Przygotowaniu meczu”</a></>}</div>}
  </div>;
}

function TeamLineup({team,players}:{team:TeamSnapshot;players:Map<string,Player>}){
  const libero=team.liberoId?players.get(team.liberoId):undefined;
  return <aside className="match-left panel"><h2>{team.name}</h2><div className="lineup-court">{courtOrder.A.map((position,index)=>{const id=team.playerIdsByRotation[position],player=id?players.get(id):undefined;return <div className={`lineup-player lp${index+1}`} key={position}><b>{position}</b><span>{player?`${player.lastName} · ${player.position}`:'Wolne miejsce'}</span></div>})}</div><h3>Libero</h3><div className="libero-card"><span>{libero?.displayName??'Nie wybrano'}</span><small>{libero?`Wzrost: ${libero.heightCm??'—'} cm　|　Wiek: ${ageOf(libero.birthDate)??'—'} lat`:'Uzupełnij skład przed symulacją'}</small></div><h3>Taktyka meczowa <small className="mock-label">MOCK</small></h3><label className="mock-control">Ustawienie <select disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><option>Standardowe (6-2)</option></select></label><label className="mock-control">Styl gry <select disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><option>Zrównoważony</option></select></label><div className="risk mock-control"><span>Poziom ryzyka</span><button disabled>Niski</button><button disabled className="on">Średni</button><button disabled>Wysoki</button></div></aside>;
}

export function MatchSimulationPage({teams,onRotateTeam}:{teams:Record<TeamId,TeamSnapshot>;onRotateTeam:(team:TeamId)=>void}){
  const[data,setData]=useState<Player[]>([]),[error,setError]=useState<string|null>(null);
  useEffect(()=>{let active=true;fetch(`${import.meta.env.BASE_URL}data/plusliga-2026-27.json`).then(response=>{if(!response.ok)throw new Error('Nie udało się wczytać zawodników');return response.json()}).then((dataset:PlayerDataset)=>{if(active)setData(dataset.players.map(player=>({...player,photoUrl:player.photoUrl?.startsWith('/')?`${import.meta.env.BASE_URL}${player.photoUrl.slice(1)}`:player.photoUrl})))}).catch(()=>{if(active)setError('Nie udało się wczytać danych zawodników')});return()=>{active=false}},[]);
  const players=useMemo(()=>new Map(data.map(player=>[player.id,player])),[data]);
  const server=getCourtLineup(teams.A,players).find(slot=>slot.position===1)?.player;
  return <div className="match-page">
    <section className="scoreboard"><div className="score-team blue"><Shield/><span><b>{teams.A.name}</b><small>DRUŻYNA A</small></span></div><div className="score"><small>SETY <b>0</b></small><strong>0</strong><span>PRZED MECZEM<em>00:00:00</em></span><strong>0</strong><small>SETY <b>0</b></small></div><div className="score-team red"><Shield/><span><b>{teams.B.name}</b><small>DRUŻYNA B</small></span></div></section>
    <div className="match-grid">
      <TeamLineup team={teams.A} players={players}/>
      <section className="match-center"><MatchArena teams={teams} players={players} loading={!data.length&&!error} error={error}/><div className="serve-bar"><button className="debug-rotation" onClick={()=>onRotateTeam('A')} title={`Wykonaj przejście: ${teams.A.name}`}><ArrowRightLeft/>Przejście A <small>DEBUG</small></button><span>Zagrywka: <b>{server?'1':'—'}</b> {server?.lastName??'oczekuje'}</span><button className="debug-rotation" onClick={()=>onRotateTeam('B')} title={`Wykonaj przejście: ${teams.B.name}`}><ArrowRightLeft/>Przejście B <small>DEBUG</small></button></div><div className="match-bottom"><article className="panel"><h3>Ostatnie akcje</h3>{events.map(event=><p key={event.join()}><time>{event[0]}</time>{event[1]}</p>)}</article><article className="panel stats-bars"><h3>Statystyki meczu</h3>{[['Atak','0%','0%'],['Blok','0','0'],['Zagrywka (asy)','0','0'],['Błędy własne','0','0'],['Przyjęcie pozytywne','0%','0%']].map(stat=><div key={stat[0]}><span>{stat[1]}</span><label>{stat[0]}<i><b/><em/></i></label><span>{stat[2]}</span></div>)}</article><article className="panel momentum"><h3>Momentum meczu</h3><TrendingUp/><div className="chart-line"/></article></div></section>
      <aside className="match-right"><article className="panel live"><h2>Komentarz na żywo <b>● GOTOWOŚĆ</b></h2><p><time>—</time><span>Uzupełnij oba składy, aby rozpocząć symulację.</span></p></article><p className="mock-notice">Pozostałe elementy sterujące są makietą i pozostają chwilowo nieaktywne.</p><article className="panel quick mock-panel"><h3>Szybkie akcje <small className="mock-label">MOCK</small></h3><div><button disabled className="primary" title="Makieta — ta funkcja nie jest jeszcze dostępna"><Pause/>Przerwa</button><button disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><ArrowRightLeft/>Zmiana</button><button disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><Shield/>Zmiana taktyki</button></div></article><article className="panel bench mock-panel"><h3>Zmiany ({teams.A.name}) <small className="mock-label">MOCK</small></h3><p><b>—</b><span>Ławka rezerwowych nie jest jeszcze skonfigurowana</span><button disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><UserPlus/></button></p></article></aside>
    </div>
  </div>;
}
