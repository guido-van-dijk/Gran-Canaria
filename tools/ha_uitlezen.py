#!/usr/bin/env python3
"""Lees een Home Assistant instantie uit via de REST API.

Alleen standaardbibliotheek: geen pip install nodig.

Configuratie via omgevingsvariabelen, een .env-bestand of vlaggen:
    HA_URL    bv. http://homeassistant.local:8123
    HA_TOKEN  long-lived access token (Profiel -> Beveiliging -> Tokens)
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

TIMEOUT = 15


class HAError(Exception):
    """Fout bij het praten met Home Assistant."""


def laad_dotenv(pad: Path) -> None:
    """Zet KEY=VALUE regels uit een .env-bestand in os.environ (bestaande wint)."""
    if not pad.is_file():
        return
    for regel in pad.read_text(encoding="utf-8").splitlines():
        regel = regel.strip()
        if not regel or regel.startswith("#") or "=" not in regel:
            continue
        sleutel, _, waarde = regel.partition("=")
        os.environ.setdefault(sleutel.strip(), waarde.strip().strip("\"'"))


class HomeAssistant:
    def __init__(self, url: str, token: str, verify_tls: bool = True) -> None:
        self.url = url.rstrip("/")
        self.token = token
        self.ctx = None if verify_tls else ssl._create_unverified_context()

    def get(self, pad: str):
        verzoek = urllib.request.Request(
            f"{self.url}/api/{pad.lstrip('/')}",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(verzoek, timeout=TIMEOUT, context=self.ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                raise HAError("401: token ongeldig of verlopen. Maak een nieuw long-lived token aan.") from exc
            if exc.code == 403:
                raise HAError("403: token heeft geen toegang tot deze bron.") from exc
            if exc.code == 404:
                raise HAError(f"404: {pad} bestaat niet op deze instantie.") from exc
            raise HAError(f"HTTP {exc.code} op /api/{pad}: {exc.reason}") from exc
        except urllib.error.URLError as exc:
            raise HAError(
                f"Geen verbinding met {self.url}: {exc.reason}. "
                "Staat Home Assistant aan en is de URL bereikbaar vanaf deze machine?"
            ) from exc

    def ping(self) -> str:
        return self.get("").get("message", "onbekend antwoord")

    def config(self) -> dict:
        return self.get("config")

    def states(self) -> list[dict]:
        return self.get("states")

    def state(self, entity_id: str) -> dict:
        return self.get(f"states/{entity_id}")

    def services(self) -> list[dict]:
        return self.get("services")

    def historie(self, entity_id: str, start: datetime, eind: datetime, attributen: bool = False) -> list[dict]:
        vraag = {"filter_entity_id": entity_id, "end_time": eind.isoformat()}
        if not attributen:
            vraag["minimal_response"] = ""
            vraag["no_attributes"] = ""
        pad = f"history/period/{start.isoformat()}?{urllib.parse.urlencode(vraag)}"
        reeksen = self.get(pad)
        return reeksen[0] if reeksen else []

    def logboek(self, start: datetime, eind: datetime, entity_id: str | None = None) -> list[dict]:
        vraag = {"end_time": eind.isoformat()}
        if entity_id:
            vraag["entity"] = entity_id
        return self.get(f"logbook/period/{start.isoformat()}?{urllib.parse.urlencode(vraag)}")


def lees_tijd(waarde: str, naief_is_lokaal: bool = False) -> datetime:
    """Parse een ISO-tijd naar een tijdzone-bewuste datetime.

    Home Assistant levert altijd een zone mee. Een tijd zonder zone komt van de
    gebruiker (--vanaf/--tot) en bedoelt lokale tijd, niet UTC.
    """
    try:
        gelezen = datetime.fromisoformat(waarde.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HAError(f'Onleesbare tijd: "{waarde}". Gebruik bv. "2026-11-06 18:00".') from exc
    if gelezen.tzinfo:
        return gelezen
    return gelezen.astimezone() if naief_is_lokaal else gelezen.replace(tzinfo=timezone.utc)


def bepaal_periode(args) -> tuple[datetime, datetime]:
    """Leid begin en eind van de gevraagde periode af uit --vanaf/--tot/--uren."""
    nu = datetime.now(timezone.utc)
    eind = lees_tijd(args.tot.replace(" ", "T"), naief_is_lokaal=True) if args.tot else nu
    if args.vanaf:
        start = lees_tijd(args.vanaf.replace(" ", "T"), naief_is_lokaal=True)
    else:
        start = eind - timedelta(hours=args.uren)
    if start >= eind:
        raise HAError("De begintijd ligt niet voor de eindtijd.")
    return start, eind


def duur(seconden: float) -> str:
    """Toon een tijdsduur compact: 45s, 12m, 3u14m."""
    seconden = int(seconden)
    if seconden < 60:
        return f"{seconden}s"
    if seconden < 3600:
        return f"{seconden // 60}m"
    uren, rest = divmod(seconden, 3600)
    return f"{uren}u{rest // 60:02d}m"


def lokale_tijd(moment: datetime) -> str:
    return moment.astimezone().strftime("%d-%m %H:%M:%S")


def domein(entity_id: str) -> str:
    return entity_id.split(".", 1)[0]


def naam(entiteit: dict) -> str:
    return entiteit.get("attributes", {}).get("friendly_name") or entiteit["entity_id"]


def eenheid(entiteit: dict) -> str:
    return entiteit.get("attributes", {}).get("unit_of_measurement", "")


def filter_entiteiten(entiteiten, domeinen=None, zoek=None, alleen_problemen=False):
    resultaat = []
    for ent in entiteiten:
        if domeinen and domein(ent["entity_id"]) not in domeinen:
            continue
        if zoek and zoek.lower() not in f"{ent['entity_id']} {naam(ent)}".lower():
            continue
        if alleen_problemen and ent["state"] not in ("unavailable", "unknown"):
            continue
        resultaat.append(ent)
    return sorted(resultaat, key=lambda e: e["entity_id"])


def tabel(rijen: list[list[str]], koppen: list[str]) -> str:
    kolommen = list(zip(*([koppen] + rijen))) if rijen else [[k] for k in koppen]
    breedtes = [max(len(str(cel)) for cel in kolom) for kolom in kolommen]
    lijnen = [
        "  ".join(str(kop).ljust(b) for kop, b in zip(koppen, breedtes)).rstrip(),
        "  ".join("-" * b for b in breedtes),
    ]
    for rij in rijen:
        lijnen.append("  ".join(str(cel).ljust(b) for cel, b in zip(rij, breedtes)).rstrip())
    return "\n".join(lijnen)


def kort(waarde: str, maxlen: int = 40) -> str:
    waarde = str(waarde).replace("\n", " ")
    return waarde if len(waarde) <= maxlen else waarde[: maxlen - 1] + "…"


def toon_overzicht(ha: HomeAssistant) -> None:
    cfg = ha.config()
    entiteiten = ha.states()
    print(f"Home Assistant {cfg.get('version', '?')} — {cfg.get('location_name', 'naamloos')}")
    print(f"Tijdzone: {cfg.get('time_zone', '?')}   Status: {cfg.get('state', '?')}")
    print(f"Entiteiten: {len(entiteiten)}\n")

    per_domein: dict[str, int] = {}
    for ent in entiteiten:
        per_domein[domein(ent["entity_id"])] = per_domein.get(domein(ent["entity_id"]), 0) + 1
    rijen = [[d, str(n)] for d, n in sorted(per_domein.items(), key=lambda p: (-p[1], p[0]))]
    print(tabel(rijen, ["domein", "aantal"]))

    problemen = filter_entiteiten(entiteiten, alleen_problemen=True)
    print(f"\nNiet beschikbaar of onbekend: {len(problemen)}")
    for ent in problemen[:10]:
        print(f"  {ent['entity_id']}  ({ent['state']})")
    if len(problemen) > 10:
        print(f"  … en nog {len(problemen) - 10}")


def toon_states(ha: HomeAssistant, args) -> None:
    entiteiten = filter_entiteiten(
        ha.states(),
        domeinen=set(args.domein) if args.domein else None,
        zoek=args.zoek,
        alleen_problemen=args.problemen,
    )
    if args.json:
        print(json.dumps(entiteiten, indent=2, ensure_ascii=False))
        return
    if not entiteiten:
        print("Geen entiteiten die aan de filters voldoen.")
        return
    rijen = [
        [
            ent["entity_id"],
            kort(naam(ent), 30),
            kort(f"{ent['state']} {eenheid(ent)}".strip(), 24),
            ent.get("last_changed", "")[:19].replace("T", " "),
        ]
        for ent in entiteiten
    ]
    print(tabel(rijen, ["entity_id", "naam", "waarde", "laatst gewijzigd (UTC)"]))
    print(f"\n{len(entiteiten)} entiteiten.")


def toon_entiteit(ha: HomeAssistant, entity_id: str, als_json: bool) -> None:
    ent = ha.state(entity_id)
    if als_json:
        print(json.dumps(ent, indent=2, ensure_ascii=False))
        return
    print(f"{naam(ent)}  ({ent['entity_id']})")
    print(f"Waarde: {ent['state']} {eenheid(ent)}".rstrip())
    print(f"Laatst gewijzigd: {ent.get('last_changed', '?')}")
    attributen = ent.get("attributes", {})
    if attributen:
        print("\nAttributen:")
        rijen = [[sleutel, kort(json.dumps(w, ensure_ascii=False).strip('"'), 60)] for sleutel, w in sorted(attributen.items())]
        print(tabel(rijen, ["attribuut", "waarde"]))


def toon_services(ha: HomeAssistant, als_json: bool) -> None:
    diensten = ha.services()
    if als_json:
        print(json.dumps(diensten, indent=2, ensure_ascii=False))
        return
    rijen = [[d["domain"], ", ".join(sorted(d.get("services", {}))[:6])] for d in sorted(diensten, key=lambda d: d["domain"])]
    print(tabel(rijen, ["domein", "services (eerste 6)"]))


def toon_historie(ha: HomeAssistant, args) -> None:
    start, eind = bepaal_periode(args)
    punten = ha.historie(args.entity_id, start, eind, attributen=args.attributen)
    if args.json:
        print(json.dumps(punten, indent=2, ensure_ascii=False))
        return
    if not punten:
        print(
            f"Geen historie voor {args.entity_id} tussen {lokale_tijd(start)} en {lokale_tijd(eind)}.\n"
            "Bestaat de entiteit, en bewaart de recorder deze periode nog?"
        )
        return

    print(f"{args.entity_id}   {lokale_tijd(start)} → {lokale_tijd(eind)} (lokale tijd)\n")
    rijen = []
    for index, punt in enumerate(punten):
        begon = lees_tijd(punt.get("last_changed") or punt["last_updated"])
        volgend = punten[index + 1] if index + 1 < len(punten) else None
        tot = lees_tijd(volgend.get("last_changed") or volgend["last_updated"]) if volgend else eind
        eenheid_punt = punt.get("attributes", {}).get("unit_of_measurement", "")
        rijen.append([
            lokale_tijd(begon),
            kort(f"{punt['state']} {eenheid_punt}".strip(), 28),
            duur((tot - begon).total_seconds()),
        ])
    print(tabel(rijen, ["vanaf", "waarde", "duur"]))

    print(f"\n{len(punten)} toestandswijzigingen.")
    niet_beschikbaar = [p for p in punten if p["state"] in ("unavailable", "unknown")]
    if niet_beschikbaar:
        print(f"Waarvan {len(niet_beschikbaar)}x unavailable/unknown — mogelijk een haperende verbinding of integratie.")


def toon_logboek(ha: HomeAssistant, args) -> None:
    start, eind = bepaal_periode(args)
    regels = ha.logboek(start, eind, args.entiteit)
    if args.json:
        print(json.dumps(regels, indent=2, ensure_ascii=False))
        return
    if not regels:
        print(f"Geen logboekregels tussen {lokale_tijd(start)} en {lokale_tijd(eind)}.")
        return

    print(f"Logboek {lokale_tijd(start)} → {lokale_tijd(eind)} (lokale tijd)\n")
    rijen = []
    for regel in regels:
        tijdstip = regel.get("when")
        rijen.append([
            lokale_tijd(lees_tijd(tijdstip)) if tijdstip else "?",
            kort(regel.get("name", ""), 26),
            kort(regel.get("message") or regel.get("state", ""), 30),
            kort(regel.get("entity_id", ""), 34),
        ])
    print(tabel(rijen, ["tijd", "naam", "wat", "entity_id"]))
    print(f"\n{len(regels)} regels.")


def bouw_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Lees een Home Assistant instantie uit via de REST API.",
        epilog="Voorbeeld: ha_uitlezen.py states --domein sensor --zoek temperatuur",
    )
    parser.add_argument("--url", help="basis-URL, bv. http://homeassistant.local:8123 (of env HA_URL)")
    parser.add_argument("--token", help="long-lived access token (of env HA_TOKEN)")
    parser.add_argument("--geen-tls-check", action="store_true", help="TLS-certificaat niet valideren (zelfondertekend certificaat)")
    parser.add_argument("--json", action="store_true", help="ruwe JSON in plaats van een tabel")

    gedeeld = argparse.ArgumentParser(add_help=False)
    gedeeld.add_argument(
        "--json", action="store_true", default=argparse.SUPPRESS,
        help="ruwe JSON in plaats van een tabel",
    )

    sub = parser.add_subparsers(dest="commando", parser_class=argparse.ArgumentParser)
    sub.add_parser("overzicht", parents=[gedeeld], help="versie, aantallen per domein en problemen (standaard)")

    p_states = sub.add_parser("states", parents=[gedeeld], help="entiteiten en hun huidige waarde")
    p_states.add_argument("--domein", action="append", help="beperk tot dit domein; meermaals te gebruiken")
    p_states.add_argument("--zoek", help="filter op entity_id of naam")
    p_states.add_argument("--problemen", action="store_true", help="alleen unavailable/unknown")

    p_ent = sub.add_parser("entiteit", parents=[gedeeld], help="details van één entiteit")
    p_ent.add_argument("entity_id")

    p_hist = sub.add_parser("historie", parents=[gedeeld], help="toestandswijzigingen van één entiteit over een periode")
    p_hist.add_argument("entity_id")
    p_hist.add_argument("--uren", type=float, default=24, help="aantal uren terug (standaard 24)")
    p_hist.add_argument("--vanaf", help='begintijd, bv. "2026-11-06 18:00"; overstemt --uren')
    p_hist.add_argument("--tot", help='eindtijd, bv. "2026-11-07 07:00" (standaard nu)')
    p_hist.add_argument("--attributen", action="store_true", help="ook attributen opvragen (meer data)")

    p_log = sub.add_parser("logboek", parents=[gedeeld], help="logboekregels over een periode")
    p_log.add_argument("--entiteit", help="beperk tot deze entity_id")
    p_log.add_argument("--uren", type=float, default=24, help="aantal uren terug (standaard 24)")
    p_log.add_argument("--vanaf", help='begintijd, bv. "2026-11-06 18:00"; overstemt --uren')
    p_log.add_argument("--tot", help='eindtijd, bv. "2026-11-07 07:00" (standaard nu)')

    sub.add_parser("config", parents=[gedeeld], help="configuratie van de instantie")
    sub.add_parser("services", parents=[gedeeld], help="beschikbare services per domein")
    return parser


def main(argv: list[str]) -> int:
    laad_dotenv(Path.cwd() / ".env")
    parser = bouw_parser()
    args = parser.parse_args(argv)

    url = args.url or os.environ.get("HA_URL")
    token = args.token or os.environ.get("HA_TOKEN")
    if not url or not token:
        parser.error(
            "HA_URL en HA_TOKEN ontbreken. Zet ze in .env, als omgevingsvariabele, "
            "of geef --url en --token mee."
        )

    ha = HomeAssistant(url, token, verify_tls=not args.geen_tls_check)
    try:
        if args.commando in (None, "overzicht"):
            toon_overzicht(ha)
        elif args.commando == "states":
            toon_states(ha, args)
        elif args.commando == "entiteit":
            toon_entiteit(ha, args.entity_id, args.json)
        elif args.commando == "config":
            print(json.dumps(ha.config(), indent=2, ensure_ascii=False))
        elif args.commando == "historie":
            toon_historie(ha, args)
        elif args.commando == "logboek":
            toon_logboek(ha, args)
        elif args.commando == "services":
            toon_services(ha, args.json)
    except HAError as exc:
        print(f"Fout: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
