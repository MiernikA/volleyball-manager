import {useEffect,useState} from 'react';
import {BarChart3,Settings,Shield,Star,Trophy,Users} from 'lucide-react';
import {DreamTeamPage} from '@/pages/dream-team';
import {MatchSimulationPage} from '@/pages/match-simulation';
import {PlayerDatabasePage} from '@/pages/player-database';

type Screen='squad'|'matches'|'players';
const screenFromHash=():Screen=>{const value=location.hash.slice(1);return value==='matches'||value==='players'?value:'squad'};

export function App(){const[screen,setScreen]=useState<Screen>(screenFromHash);useEffect(()=>{const onHash=()=>setScreen(screenFromHash());addEventListener('hashchange',onHash);return()=>removeEventListener('hashchange',onHash)},[]);const go=(next:Screen)=>{location.hash=next;setScreen(next)};return <main className="app-shell"><header className="app-header"><button className="brand" onClick={()=>go('squad')}><i><Shield/></i><span><strong>Volleyball Manager <sup>{__APP_VERSION__}</sup></strong><small>Dream Team Builder</small></span></button><div className="season-pill"><i/>Dream Team <b>Sezon 26/27</b></div><nav className="app-nav"><button className={screen==='squad'?'active':''} onClick={()=>go('squad')}><Users/>Skład</button><button className={screen==='matches'?'active':''} onClick={()=>go('matches')}><Trophy/>Mecze</button><button className={screen==='players'?'active':''} onClick={()=>go('players')}><Users/>Baza zawodników</button><button disabled><BarChart3/>Statystyki</button><button disabled><Star/>Rankingi</button><button disabled><Settings/>Ustawienia</button></nav><strong className="app-league"><span>powered by</span>plusliga</strong></header>{screen==='matches'?<MatchSimulationPage/>:screen==='players'?<PlayerDatabasePage/>:<DreamTeamPage/>}</main>}
