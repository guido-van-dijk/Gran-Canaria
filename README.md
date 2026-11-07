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

### Historie: uitzoeken waarom iets misging

Voor een vraag over het verleden ("waarom laadde de auto niet?") is de huidige
stand niet genoeg. Twee subopdrachten lezen de recorder uit:

```bash
# toestandswijzigingen van één entiteit, met de duur van elke stand
python3 tools/ha_uitlezen.py historie sensor.laadpunt_vermogen --uren 24
python3 tools/ha_uitlezen.py historie sensor.laadpunt_status \
    --vanaf "2026-11-06 18:00" --tot "2026-11-07 07:00"

# logboek over dezelfde periode, eventueel op één entiteit
python3 tools/ha_uitlezen.py logboek --vanaf "2026-11-06 18:00"
python3 tools/ha_uitlezen.py logboek --entiteit sensor.laadpunt_status --uren 12
```

`--vanaf` en `--tot` zonder tijdzone zijn **lokale** tijd; de uitvoer staat ook
in lokale tijd. De historie markeert hoeveel standen `unavailable`/`unknown`
waren — meestal de eerste aanwijzing bij een afgebroken laadsessie.

Hoe ver terug je kunt kijken hangt af van je recorder-instelling
(standaard 10 dagen).

### JSON

Elke subopdracht accepteert `--json` voor ruwe JSON, vóór of achter de
subopdracht:

```bash
python3 tools/ha_uitlezen.py states --domein sensor --json | jq '.[].entity_id'
python3 tools/ha_uitlezen.py --json historie sensor.laadpunt_vermogen --uren 6
```

Gebruik `--geen-tls-check` alleen bij een zelfondertekend certificaat op je eigen netwerk.

### Wat het niet doet

- **Niets schakelen.** Het script doet uitsluitend `GET`-verzoeken.
- **Geen areas/devices.** Die staan niet in de REST API; daarvoor is de
  WebSocket API nodig.
- **Geen automatiseringen uitlezen.** Welke automatisering een laadsessie
  blokkeerde zie je hiermee niet; dat staat in de automatiseringen zelf.

### Bereikbaarheid

Het script draait op jouw machine en praat rechtstreeks met Home Assistant.
Draait Home Assistant thuis achter je router, dan werkt het alleen vanaf hetzelfde
netwerk (of via VPN/Nabu Casa) — niet vanuit een cloudomgeving.
