# Gran-Canaria

## Home Assistant uitlezen

`tools/ha_uitlezen.py` leest een Home Assistant instantie uit via de REST API.
Alleen de Python-standaardbibliotheek (3.9+), dus geen `pip install` nodig.

### Eenmalig instellen

1. Maak een long-lived access token in Home Assistant:
   profielfoto linksonder → tabblad **Beveiliging** → **Langlevende toegangstokens**
   → *Token aanmaken*. Kopieer het token meteen; het wordt maar één keer getoond.
2. Zet URL en token klaar:

```bash
cp .env.example .env     # en vul HA_URL en HA_TOKEN in
```

`.env` staat in `.gitignore` en hoort daar te blijven — een token is een wachtwoord.
Als alternatief kun je `HA_URL`/`HA_TOKEN` als omgevingsvariabele exporteren of
`--url`/`--token` meegeven.

### Gebruik

```bash
python3 tools/ha_uitlezen.py                          # overzicht: versie, domeinen, problemen
python3 tools/ha_uitlezen.py states                   # alle entiteiten met hun waarde
python3 tools/ha_uitlezen.py states --domein sensor   # alleen sensoren
python3 tools/ha_uitlezen.py states --zoek temperatuur
python3 tools/ha_uitlezen.py states --problemen       # alleen unavailable/unknown
python3 tools/ha_uitlezen.py entiteit light.keuken    # detail incl. attributen
python3 tools/ha_uitlezen.py config
python3 tools/ha_uitlezen.py services
```

Elke subopdracht accepteert `--json` voor ruwe JSON, handig om door te pipen:

```bash
python3 tools/ha_uitlezen.py states --domein sensor --json | jq '.[].entity_id'
```

Gebruik `--geen-tls-check` alleen bij een zelfondertekend certificaat op je eigen netwerk.

### Wat het niet doet

- **Niets schakelen.** Het script doet uitsluitend `GET`-verzoeken.
- **Geen areas/devices.** Die staan niet in de REST API; daarvoor is de
  WebSocket API nodig.
- **Geen historie.** `/api/history` is bewust niet ontsloten; voeg toe als je het nodig hebt.

### Bereikbaarheid

Het script draait op jouw machine en praat rechtstreeks met Home Assistant.
Draait Home Assistant thuis achter je router, dan werkt het alleen vanaf hetzelfde
netwerk (of via VPN/Nabu Casa) — niet vanuit een cloudomgeving.
