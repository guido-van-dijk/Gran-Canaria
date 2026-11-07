# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other AI assistants working in this repository.

## Repository

- **Remote:** https://github.com/guido-van-dijk/Gran-Canaria (public)
- **Owner:** guido-van-dijk
- **Default branch:** `claude/claude-md-docs-oqhq7d` (er is nog geen `main`)

## Development workflow

### Branching

Work happens on feature branches, not directly on the default branch. Claude
Code sessions are assigned a branch of the form `claude/<topic>-<suffix>` and
must push only to that branch.

```bash
git checkout -b <branch-name>          # create the branch if it does not exist
git push -u origin <branch-name>       # always use -u origin <branch>
```

Never push to a branch other than the one assigned for the session without
explicit permission.

### Commits

- One logical change per commit.
- Imperative, descriptive subject lines (`Add …`, `Fix …`, `Update …`).
- Commit and push only when the user asks for it.

### Pull requests

Do not open a pull request unless the user explicitly requests one. If a PR
template is added under `.github/`, populate its headings rather than writing a
freeform body.

## Project structure

```
README.md                 Gebruiksaanwijzing (Nederlands)
.env.example              Sjabloon voor HA_URL / HA_TOKEN; .env is gitignored
tools/ha_uitlezen.py      CLI die een Home Assistant instantie uitleest via de REST API
```

`tools/ha_uitlezen.py` is het enige uitvoerbare bestand en het startpunt.

## Build, test, and run

Er is geen build-systeem, package manifest of testsuite — het script gebruikt
alleen de Python-standaardbibliotheek (3.9+).

```bash
python3 tools/ha_uitlezen.py --help          # subopdrachten en vlaggen
python3 tools/ha_uitlezen.py                 # overzicht (vereist HA_URL + HA_TOKEN)
python3 -m py_compile tools/ha_uitlezen.py   # syntaxcontrole
```

Handmatig testen zonder echte instantie: draai een mock-HTTP-server die
`/api/`, `/api/config`, `/api/states`, `/api/states/<id>`, `/api/services`,
`/api/history/period/<ts>` en `/api/logbook/period/<ts>` teruggeeft, en wijs
`--url` daarheen. Zet `NO_PROXY` voor het loopback-adres als er een HTTP-proxy
in de omgeving staat, en `TZ` om de tijdzone-omrekening te controleren.

## Conventions

- **Taal:** Python 3, alleen standaardbibliotheek. Geen dependencies toevoegen
  zonder aanleiding — de drempel om het script te draaien moet laag blijven.
- **Naamgeving:** functies, variabelen en CLI-opdrachten zijn Nederlands; dat
  geldt ook voor alle uitvoer en foutmeldingen. `snake_case`, geen afkortingen.
- **Foutafhandeling:** netwerk- en HTTP-fouten worden omgezet naar `HAError` met
  een melding die zegt wat de gebruiker moet doen (401 → nieuw token, connection
  refused → draait HA en is de URL bereikbaar). `main` vangt `HAError`, print
  naar stderr en geeft exit 1.
- **Alleen lezen:** het script doet uitsluitend `GET`. Schakelen of services
  aanroepen is bewust geen onderdeel; voeg dat niet toe zonder expliciete vraag.
- **Tijdzones:** Home Assistant levert tijden in UTC; invoer van de gebruiker
  (`--vanaf`/`--tot`) zonder zone is lokale tijd. `lees_tijd(..., naief_is_lokaal=)`
  legt dat verschil vast — ga niet terug naar één vaste aanname.
- **Globale vlaggen:** `--json` zit op een `parents=[gedeeld]`-parser met
  `default=argparse.SUPPRESS`, zodat de vlag vóór én achter de subopdracht werkt.
  Zonder SUPPRESS overschrijft de subparser de globale waarde.
- **Geheimen:** tokens komen uit `.env`, omgevingsvariabelen of vlaggen en staan
  nooit in de repository.

## Notes for AI assistants

- Match the surrounding code's style once there is surrounding code; until then,
  follow the conventions of whatever stack the user introduces.
- Prefer verifying over assuming: run the commands, read the files, and correct
  this document when it drifts from reality.
- Keep this file current. If you change how the project is built, tested, or
  laid out, update the matching section in the same change.
