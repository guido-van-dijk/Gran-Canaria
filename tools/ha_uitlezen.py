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
import urllib.request
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


def bouw_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Lees een Home Assistant instantie uit via de REST API.",
        epilog="Voorbeeld: ha_uitlezen.py states --domein sensor --zoek temperatuur",
    )
    parser.add_argument("--url", help="basis-URL, bv. http://homeassistant.local:8123 (of env HA_URL)")
    parser.add_argument("--token", help="long-lived access token (of env HA_TOKEN)")
    parser.add_argument("--geen-tls-check", action="store_true", help="TLS-certificaat niet valideren (zelfondertekend certificaat)")
    parser.add_argument("--json", action="store_true", help="ruwe JSON in plaats van een tabel")

    sub = parser.add_subparsers(dest="commando")
    sub.add_parser("overzicht", help="versie, aantallen per domein en problemen (standaard)")

    p_states = sub.add_parser("states", help="entiteiten en hun huidige waarde")
    p_states.add_argument("--domein", action="append", help="beperk tot dit domein; meermaals te gebruiken")
    p_states.add_argument("--zoek", help="filter op entity_id of naam")
    p_states.add_argument("--problemen", action="store_true", help="alleen unavailable/unknown")

    p_ent = sub.add_parser("entiteit", help="details van één entiteit")
    p_ent.add_argument("entity_id")

    sub.add_parser("config", help="configuratie van de instantie")
    sub.add_parser("services", help="beschikbare services per domein")
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
        elif args.commando == "services":
            toon_services(ha, args.json)
    except HAError as exc:
        print(f"Fout: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
