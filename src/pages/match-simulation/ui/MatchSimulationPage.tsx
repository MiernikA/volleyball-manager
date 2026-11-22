/* eslint-disable no-irregular-whitespace */
import {useEffect,useMemo,useState} from 'react';
import {ArrowRightLeft,Dices,Pause,Play,Shield,TrendingUp,UserPlus} from 'lucide-react';
import fieldBackground from './field.png';
import {createSeededRng,simulateMatch,summarizeMatch,type MatchInput,type MatchResult,type RallyEndReason} from '../model';

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

const reasonLabels:Record<RallyEndReason,string>={ace:'As serwisowy',service_error:'Błąd zagrywki',attack_kill:'Skończony atak',block_point:'Punktowy blok',attack_error:'Błąd w ataku',unforced_error:'Błąd własny'};
type Simulation={teams:Record<TeamId,TeamSnapshot>;seed:string;result:MatchResult};

/** Zamienia składy z ekranu przygotowania na wejście silnika. Wywoływać tylko dla poprawnych składów. */
function toMatchInput(teams:Record<TeamId,TeamSnapshot>,players:Map<string,Player>):MatchInput{
  const team=(snapshot:TeamSnapshot)=>{
    const ids=[...positions.map(position=>snapshot.playerIdsByRotation[position]!),...(snapshot.liberoId?[snapshot.liberoId]:[])];
    return {
      name:snapshot.name,
      rotation:{1:snapshot.playerIdsByRotation[1]!,2:snapshot.playerIdsByRotation[2]!,3:snapshot.playerIdsByRotation[3]!,4:snapshot.playerIdsByRotation[4]!,5:snapshot.playerIdsByRotation[5]!,6:snapshot.playerIdsByRotation[6]!},
      liberoId:snapshot.liberoId,
      players:ids.map(id=>{const player=players.get(id)!;return {id,name:player.displayName,role:player.position}}),
    };
  };
  return {teams:{A:team(teams.A),B:team(teams.B)}};
}

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

function MatchArena({teams,players,loading,error,onRandomize}:{teams:Record<TeamId,TeamSnapshot>;players:Map<string,Player>;loading:boolean;error:string|null;onRandomize:()=>void}){
  const issues={A:validateTeam(teams.A,players),B:validateTeam(teams.B,players)};
  const incomplete=loading||Boolean(error)||issues.A.length>0||issues.B.length>0;
  return <div className={`arena panel ${incomplete?'arena-incomplete':''}`} aria-label="Boisko podczas symulacji meczu" style={{backgroundImage:`url(${fieldBackground})`}}>
    {!loading&&(['A','B'] as TeamId[]).map(team=>{
      const lineup=getCourtLineup(teams[team],players).sort((a,b)=>a.player.id.localeCompare(b.player.id));
      return <div className={`court-team ${team==='A'?'blue-team':'red-team'}`} key={team}>{lineup.map(({player,position,replacedPlayer})=><CourtPlayer player={player} position={position} replacedPlayer={replacedPlayer} key={`${team}-${player.id}`}/>)}</div>;
    })}
    {incomplete&&<div className="arena-message" role="status"><Shield/><strong>{loading?'Wczytywanie składów…':error??'Nie można rozpocząć symulacji'}</strong>{!loading&&!error&&<>{issues.A.length>0&&<p><b>{teams.A.name}:</b> {issues.A.join(', ')}</p>}{issues.B.length>0&&<p><b>{teams.B.name}:</b> {issues.B.join(', ')}</p>}<a href="#squad">Uzupełnij składy w „Przygotowaniu meczu”</a><button className="debug-randomize" onClick={onRandomize}><Dices/>albo wylosuj składy <small>DEBUG</small></button></>}</div>}
  </div>;
}

function TeamLineup({team,players}:{team:TeamSnapshot;players:Map<string,Player>}){
  const libero=team.liberoId?players.get(team.liberoId):undefined;
  return <aside className="match-left panel"><h2>{team.name}</h2><div className="lineup-court">{courtOrder.A.map((position,index)=>{const id=team.playerIdsByRotation[position],player=id?players.get(id):undefined;return <div className={`lineup-player lp${index+1}`} key={position}><b>{position}</b><span>{player?`${player.lastName} · ${player.position}`:'Wolne miejsce'}</span></div>})}</div><h3>Libero</h3><div className="libero-card"><span>{libero?.displayName??'Nie wybrano'}</span><small>{libero?`Wzrost: ${libero.heightCm??'—'} cm　|　Wiek: ${ageOf(libero.birthDate)??'—'} lat`:'Uzupełnij skład przed symulacją'}</small></div><h3>Taktyka meczowa <small className="mock-label">MOCK</small></h3><label className="mock-control">Ustawienie <select disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><option>Standardowe (6-2)</option></select></label><label className="mock-control">Styl gry <select disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><option>Zrównoważony</option></select></label><div className="risk mock-control"><span>Poziom ryzyka</span><button disabled>Niski</button><button disabled className="on">Średni</button><button disabled>Wysoki</button></div></aside>;
}

function StatBar({label,a,b,format=String}:{label:string;a:number;b:number;format?:(value:number)=>string}){
  const total=a+b,share=total?a/total:0.5;
  return <div><span>{format(a)}</span><label>{label}<i><b style={{width:`${share*96}%`}}/><em style={{width:`${(1-share)*96}%`}}/></i></label><span>{format(b)}</span></div>;
}

export function MatchSimulationPage({teams,onRotateTeam,onRandomizeTeams}:{teams:Record<TeamId,TeamSnapshot>;onRotateTeam:(team:TeamId)=>void;onRandomizeTeams:(players:Player[])=>boolean}){
  const[data,setData]=useState<Player[]>([]),[error,setError]=useState<string|null>(null);
  useEffect(()=>{let active=true;fetch(`${import.meta.env.BASE_URL}data/plusliga-2026-27.json`).then(response=>{if(!response.ok)throw new Error('Nie udało się wczytać zawodników');return response.json()}).then((dataset:PlayerDataset)=>{if(active)setData(dataset.players.map(player=>({...player,photoUrl:player.photoUrl?.startsWith('/')?`${import.meta.env.BASE_URL}${player.photoUrl.slice(1)}`:player.photoUrl})))}).catch(()=>{if(active)setError('Nie udało się wczytać danych zawodników')});return()=>{active=false}},[]);
  const players=useMemo(()=>new Map(data.map(player=>[player.id,player])),[data]);
  const server=getCourtLineup(teams.A,players).find(slot=>slot.position===1)?.player;
  const[simulation,setSimulation]=useState<Simulation|null>(null);
  // Wynik dotyczy konkretnych składów — każda zmiana drużyn (np. przejście, losowanie) go unieważnia.
  const result=simulation?.teams===teams?simulation.result:null;
  const ready=data.length>0&&validateTeam(teams.A,players).length===0&&validateTeam(teams.B,players).length===0;
  const stats=useMemo(()=>result?summarizeMatch(result.events):null,[result]);
  const lastSet=result?.sets.at(-1);
  const nameOf=(id:string)=>players.get(id)?.lastName??id;
  const recentRallies=result?result.events.filter(event=>event.type==='rally_ended').slice(-7).reverse():[];
  const randomize=()=>{if(!onRandomizeTeams(data))setError('Za mało zawodników w bazie, aby wylosować dwa składy')};
  const simulate=()=>{const seed=Math.random().toString(36).slice(2,8);setSimulation({teams,seed,result:simulateMatch(toMatchInput(teams,players),createSeededRng(seed))})};
  const percent=(value:number,of:number)=>of?Math.round(value/of*100):0;
  return <div className="match-page">
    <section className="scoreboard"><div className="score-team blue"><Shield/><span><b>{teams.A.name}</b><small>DRUŻYNA A</small></span></div><div className="score"><small>SETY <b>{result?.setsWon.A??0}</b></small><strong>{lastSet?.points.A??0}</strong><span>{result?<>KONIEC MECZU<em>{result.sets.map(set=>`${set.points.A}:${set.points.B}`).join(' · ')}</em><em className="seed">seed: {simulation!.seed}</em></>:<>PRZED MECZEM<em>00:00:00</em></>}</span><strong>{lastSet?.points.B??0}</strong><small>SETY <b>{result?.setsWon.B??0}</b></small></div><div className="score-team red"><Shield/><span><b>{teams.B.name}</b><small>DRUŻYNA B</small></span></div></section>
    <div className="match-grid">
      <TeamLineup team={teams.A} players={players}/>
      <section className="match-center"><MatchArena teams={teams} players={players} loading={!data.length&&!error} error={error} onRandomize={randomize}/><div className="serve-bar"><button className="debug-rotation" onClick={()=>onRotateTeam('A')} title={`Wykonaj przejście: ${teams.A.name}`}><ArrowRightLeft/>Przejście A <small>DEBUG</small></button><span>Zagrywka: <b>{server?'1':'—'}</b> {server?.lastName??'oczekuje'}</span><div className="debug-sim"><button onClick={randomize} disabled={!data.length} title="Wylosuj dwa rozłączne składy zgodne z pozycjami (1 S, 1 OPP, 2 OH, 2 MB + libero)"><Dices/>Losowe składy <small>DEBUG</small></button><button onClick={simulate} disabled={!ready} title={ready?'Rozegraj cały mecz silnikiem SIM-01 z losowym seedem':'Uzupełnij oba składy, aby uruchomić symulację'}><Play/>Symuluj mecz <small>DEBUG</small></button></div><button className="debug-rotation" onClick={()=>onRotateTeam('B')} title={`Wykonaj przejście: ${teams.B.name}`}><ArrowRightLeft/>Przejście B <small>DEBUG</small></button></div><div className="match-bottom"><article className="panel"><h3>Ostatnie akcje</h3>{result?recentRallies.map(event=><p key={event.seq}><time>S{event.set} {event.score.A}:{event.score.B}</time>{reasonLabels[event.reason]}: {nameOf(event.playerId)} → punkt {teams[event.winner].name}</p>):events.map(event=><p key={event.join()}><time>{event[0]}</time>{event[1]}</p>)}</article><article className="panel stats-bars"><h3>Statystyki meczu</h3>{stats?<><StatBar label="Skończone ataki" a={stats.A.attackKills} b={stats.B.attackKills}/><StatBar label="Blok" a={stats.A.blockPoints} b={stats.B.blockPoints}/><StatBar label="Zagrywka (asy)" a={stats.A.aces} b={stats.B.aces}/><StatBar label="Błędy własne" a={stats.A.errors} b={stats.B.errors}/><StatBar label="Wygrane przyjęcia" a={percent(stats.A.sideOuts,stats.A.receptions)} b={percent(stats.B.sideOuts,stats.B.receptions)} format={value=>`${value}%`}/></>:[['Atak','0%','0%'],['Blok','0','0'],['Zagrywka (asy)','0','0'],['Błędy własne','0','0'],['Przyjęcie pozytywne','0%','0%']].map(stat=><div key={stat[0]}><span>{stat[1]}</span><label>{stat[0]}<i><b/><em/></i></label><span>{stat[2]}</span></div>)}</article><article className="panel momentum"><h3>Momentum meczu</h3><TrendingUp/><div className="chart-line"/></article></div></section>
      <aside className="match-right"><article className="panel live"><h2>Komentarz na żywo <b>● {result?'KONIEC':ready?'GOTOWI':'GOTOWOŚĆ'}</b></h2>{result?<>{result.sets.map(set=><p key={set.number}><time>Set {set.number}</time><span>{set.points.A}:{set.points.B} — wygrywa {teams[set.winner].name}</span></p>)}<p className="hot"><time>Mecz</time><span>{teams[result.winner].name} wygrywa {result.setsWon[result.winner]}:{result.setsWon[result.winner==='A'?'B':'A']} po {result.totalRallies} wymianach.</span></p></>:<p><time>—</time><span>{ready?'Składy gotowe — kliknij „Symuluj mecz”.':'Uzupełnij oba składy, aby rozpocząć symulację.'}</span></p>}</article><p className="mock-notice">Pozostałe elementy sterujące są makietą i pozostają chwilowo nieaktywne.</p><article className="panel quick mock-panel"><h3>Szybkie akcje <small className="mock-label">MOCK</small></h3><div><button disabled className="primary" title="Makieta — ta funkcja nie jest jeszcze dostępna"><Pause/>Przerwa</button><button disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><ArrowRightLeft/>Zmiana</button><button disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><Shield/>Zmiana taktyki</button></div></article><article className="panel bench mock-panel"><h3>Zmiany ({teams.A.name}) <small className="mock-label">MOCK</small></h3><p><b>—</b><span>Ławka rezerwowych nie jest jeszcze skonfigurowana</span><button disabled title="Makieta — ta funkcja nie jest jeszcze dostępna"><UserPlus/></button></p></article></aside>
    </div>
  </div>;
}
