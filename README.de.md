<p align="center">
  <img src="design/identity/exports/mashina-header.svg" width="320" alt="MASHINA" />
</p>

# Deine Garage. Dein Verlauf. Dein Server.

Deutsch · [English](README.md) · [Russisch](README.ru.md) · [Releases](https://github.com/kosavan/mashina/releases) · [Update](docs/updating.de.md)

MASHINA ist ein quelloffenes, selbst gehostetes Fahrzeugtagebuch für Wartung,
Reparaturen, Kilometerstände, Tankvorgänge und Ausgaben. Deine Daten und Dateien
bleiben auf deinem Server. Die mobile Oberfläche bietet ein installierbares PWA,
helle und dunkle Designs sowie Deutsch, Englisch, Russisch, vereinfachtes Chinesisch, Hindi, Spanisch, Arabisch und Französisch.

## Was du erfassen kannst

- Mehrere Fahrzeuge mit Bildern, technischen Daten, Besitzverlauf und Archiv.
- Ausgaben, Teile und Werkstattarbeiten; exakte Beträge ohne doppelte Buchungen.
- Tankvorgänge und Verbrauch von Volltankung zu Volltankung.
- Karosserieschäden mit Markierungen, Vorher-/Nachher-Fotos und Reparaturverlauf.
- Reifensätze, Montagen, DOT-Alter und gemessene Profiltiefe.
- Wartungserinnerungen, Budgets und regelmäßige Zahlungen.
- Dokumente und lokale Anhänge, JSON-/CSV-Exporte und vollständige Sicherungen.
- Gemeinsame Fahrzeugnutzung mit getrennten Eigentümer- und Fahrerrechten.
- Geprüfter Bank-CSV-Import und optionale API-/MCP-Anbindungen.
- Lokale Texterkennung mit Tesseract für russische/englische Vorlagen; Ergebnisse
  werden vor dem Speichern geprüft. Deutsche OCR-Sprachdaten sind nicht enthalten.

Offline-Einträge werden auf dem Gerät gespeichert und bei geöffneter App nach
Wiederherstellung der Verbindung synchronisiert. Neue Dateianhänge und OCR
benötigen eine Serververbindung. Währungen und Einheiten werden durch die
Sprachwahl nicht umgerechnet. PDF-/CSV-Beschriftungen und externe
Benachrichtigungstexte behalten ihren bisherigen Sprachumfang.

## Installation mit Docker

Linux: Docker Engine und Compose. macOS/Windows: Docker Desktop mit
Linux-Containern. Für bestehende Installationen verwende die
[Update-Anleitung](docs/updating.de.md), statt neu zu installieren.

```sh
git clone https://github.com/kosavan/mashina.git
cd mashina
```

Linux/macOS:

```sh
cp .env.example .env
mkdir -p data
```

Unter Linux dem Containerbenutzer Schreibzugriff geben: `sudo chown 10001:10001 data`.
Windows PowerShell:

```powershell
Copy-Item .env.example .env
New-Item -ItemType Directory -Path data
```

Auf allen Plattformen:

```sh
docker compose up -d --build
docker compose exec mashina /app/.venv/bin/python -m backend.cli create-admin
```

Öffne `http://localhost:8000` und wähle **Deutsch**. Der letzte Befehl erstellt
das Eigentümerkonto interaktiv. Die öffentliche Registrierung ist geschlossen.
Für Fernzugriff nutze einen HTTPS-Reverse-Proxy und konfiguriere
`MASHINA_ORIGIN` sowie `MASHINA_SECURE_COOKIES=1`; siehe
[Installationsdetails auf Englisch](docs/self-hosting.md).

## Erst einmal ausprobieren

Wähle auf dem Anmeldebildschirm **Deutsch → Demo-Garage erkunden**.
Die fiktiven Fahrzeuge und Einträge liegen in einer eigenen temporären Datenbank,
vollständig getrennt von deiner persönlichen Garage.

Die Sprache lässt sich später unter **Einstellungen → App-Sprache** ändern.
Russisch bleibt die Voreinstellung; für Deutsch gibt es keine Übersetzungs-API.
Persönliche Namen, Notizen und Dokumente werden nie übersetzt.

## Sicher betreiben und weiterentwickeln

Bewahre `data` und die private `.env` auf. Lade vollständige Sicherungen auf einen
anderen physischen Datenträger herunter und prüfe ihre Wiederherstellbarkeit.
Lösche Browserdaten erst, nachdem ausstehende Einträge synchronisiert sind.

[Sicher aktualisieren und zurückrollen](docs/updating.de.md) ·
[Sprachumfang](docs/languages.md) · [Roadmap auf Englisch](docs/roadmap.md) ·
[Entwicklung und Tests](docs/development.md) · [MIT-Lizenz](LICENSE)

Physische iPhone- und separate arm64-Tests stehen noch aus; die Roadmap trennt
verfügbare Funktionen von geplanter Arbeit.

Vibecoded with love ❤️
