#!/usr/bin/env python3
"""Conservative PlusLiga roster importer.

The official site is dynamic and may block automated clients. This script checks robots.txt,
does not bypass bot protection, and aborts instead of producing an unverified dataset. Keep the
committed JSON when access is unavailable; never silently relabel an older season as current.
"""
from __future__ import annotations
import argparse, json, re, sys
from datetime import date
from pathlib import Path
from urllib import robotparser
from urllib.request import Request, urlopen

BASE = "https://www.plusliga.pl"
LIST_URL = f"{BASE}/players/tour/53.html"
AGENT = "PlusLigaDreamTeamImporter/0.0.1 (offline dataset maintainer)"
POSITIONS = {"Rozgrywający":"S","Atakujący":"OPP","Przyjmujący":"OH","Środkowy":"MB","Libero":"L"}

def fetch(url: str) -> str:
    req=Request(url,headers={"User-Agent":AGENT})
    with urlopen(req,timeout=25) as response:
        return response.read().decode("utf-8","replace")

def allowed(url: str) -> bool:
    robots=robotparser.RobotFileParser(f"{BASE}/robots.txt")
    robots.read()
    return robots.can_fetch(AGENT,url)

def main() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="public/data/plusliga-2026-27.generated.json")
    args=parser.parse_args()
    try:
        if not allowed(LIST_URL):
            raise RuntimeError("robots.txt does not permit importing the season list")
        html=fetch(LIST_URL)
    except Exception as exc:
        print(f"IMPORT ABORTED: {exc}",file=sys.stderr)
        print("No output written. Use a browser-reviewed official export or retry later.",file=sys.stderr)
        return 2
    links=sorted(set(re.findall(r'href=["\']([^"\']*/players/tour/53/id/\d+\.html)',html)))
    if not links:
        print("IMPORT ABORTED: no player profile links found; site markup may have changed",file=sys.stderr)
        return 2
    # Profile parsing is deliberately strict: incomplete/changed markup must be reviewed.
    print(f"Found {len(links)} profile links. Automated profile parsing requires a reviewed selector update.")
    report={"checkedAt":date.today().isoformat(),"season":"2026/2027","profileLinks":len(links),"status":"review-required"}
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    return 1

if __name__ == "__main__": raise SystemExit(main())
