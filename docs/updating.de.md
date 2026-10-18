# MASHINA sicher aktualisieren

Deutsch · [English](updating.md) · [Russisch](updating.ru.md) · [Einführung](../README.de.md)

Verwende das Ziel-Tag **v1.8.0**, sobald es in den [Releases](https://github.com/kosavan/mashina/releases/tag/v1.8.0) veröffentlicht ist. Diese Version ergänzt PWA-Safe-Areas, private Bildvorschauen, fünf weitere Sprachen und OCR-Zuschnitt/Drehung/Mehrseitenauswahl. Originaldateien und Schema 007 bleiben erhalten. Ältere Installationen führen die erforderlichen Zwischenmigrationen mit einem vollständigen Wiederherstellungsarchiv aus. Aktualisiere Server und Oberfläche zusammen; alte Server akzeptieren die neuen Sprach-/OCR-Optionen nicht.

Die Befehle laufen im **bestehenden Installationsverzeichnis**. Bewahre `data`,
die private `.env` und das vorherige Image auf. Führe keine Neueinrichtung durch,
überschreibe `.env` nicht mit der Vorlage und verwende niemals `down -v`.
Prüfe jeden Schritt und halte bei Fehlern an.

## 1. Synchronisieren und sichern

Synchronisiere ausstehende Einträge auf allen Geräten und löse Konflikte online.
Lade in den Einstellungen eine vollständige ZIP-Sicherung auf einen anderen
physischen Datenträger herunter. Prüfe die Wiederherstellung in einer separaten
Testinstallation. Die Wiederherstellung ist auf 200 MiB komprimiert und entpackt
begrenzt; prüfe große Archive vor dem Update.

Notiere den bisherigen Quellstand und die Image-ID:

```sh
git status --short
git describe --tags --always
docker compose images -q mashina
```

Prüfe lokale Änderungen, ohne sie mit Reset oder erzwungenem Checkout zu löschen.
Pausiere einen eventuell separat eingerichteten Benachrichtigungszeitgeber.
Stoppe die App vor der CLI-Sicherung, damit keine Schreibvorgänge laufen:

```sh
docker compose stop mashina
docker compose run --rm --no-deps mashina /app/.venv/bin/python -m backend.cli backup --backup-dir /app/data/backups --keep 7
docker image tag PREVIOUS_IMAGE_ID mashina:before-update
```

Ersetze `PREVIOUS_IMAGE_ID` durch die notierte ID. Bewahre die ausgegebene
ZIP-Datei zusätzlich außerhalb des Datenträgers auf. Sichere `.env` privat.
Unter Linux kann das Lesen der Daten von UID 10001 sudo benötigen.

Erstelle zusätzlich eine unveränderte Kopie des **gestoppten** Datenverzeichnisses.
Die Zielnamen dürfen noch nicht existieren. Linux/macOS:

```sh
sudo cp -a ./data ../mashina-data-before-update
cp .env ../mashina-env-before-update
```

Windows PowerShell: Prüfe zuerst `Test-Path ../mashina-data-before-update`.
Bei `True` wähle einen neuen Namen; fahre nicht mit einem vorhandenen Ziel fort.

```powershell
Copy-Item -LiteralPath ./data -Destination ../mashina-data-before-update -Recurse
Copy-Item -LiteralPath .env -Destination ../mashina-env-before-update
```

Die Kopie muss Datenbank, WAL und Dateien zusammen enthalten. Bewahre sie privat
auf. Starte niemals zwei App-Versionen mit derselben Datenbank.

## 2. Version wählen und bauen

Linux/macOS Terminal und Windows PowerShell:

```sh
git fetch --tags origin
git switch --detach v1.8.0
docker compose build --pull
docker compose up -d --no-build
docker compose ps
docker compose logs --tail=100 mashina
```

Behalte Datenmount und Umgebungseinstellungen bei. Bei Build- oder Startfehlern
anhalten; keine Daten löschen und keine Schema-Markierungen ändern.

## 3. Prüfen und Deutsch wählen

Linux/macOS: `curl --fail http://localhost:8000/api/v1/health`.
Windows: `Invoke-RestMethod http://localhost:8000/api/v1/health`.
Verwende deinen konfigurierten Port und veröffentliche keine privaten Logs.

Wähle **Deutsch** vor dem Anmelden oder unter **Settings → App language**.
Danach heißt der Bereich **Einstellungen → App-Sprache**. Prüfe, dass die Sprache
nach dem Neuladen erhalten bleibt. Bleibt die alte Oberfläche sichtbar,
synchronisiere zuerst, schließe die PWA vollständig und öffne sie erneut.
Lösche keine Browserdaten, solange noch Einträge auf Synchronisierung warten.

Prüfe bestehende Fahrzeuge, Einstellungen, Kilometerstände, Summen, ältere Einträge,
Fotos und ein PDF. Teste mit einem fiktiven Eintrag Speichern/Bearbeiten/Löschen
und einmalige Offline-Synchronisierung. Namen, Notizen, Beträge, Währungen und
Einheiten bleiben unverändert. PDF-/CSV-Beschriftungen, externe Benachrichtigungen
und OCR-Sprachdaten behalten ihren bisherigen Umfang.

## 4. Bei Bedarf zurückrollen

Stelle **die Daten vor dem Update und das passende vorherige Image gemeinsam**
wieder her. Nachträgliche Änderungen fehlen in diesem Snapshot. Stoppe App und
Zeitgeber. Bewahre den fehlgeschlagenen Datenstand auf; `data-failed-update`
darf noch nicht existieren. Linux/macOS:

```sh
docker compose stop mashina
sudo mv ./data ./data-failed-update
sudo cp -a ../mashina-data-before-update ./data
cp ../mashina-env-before-update .env
git switch --detach PREVIOUS_REVISION
```

Windows PowerShell:

```powershell
docker compose stop mashina
Move-Item -LiteralPath ./data -Destination ./data-failed-update
Copy-Item -LiteralPath ../mashina-data-before-update -Destination ./data -Recurse
Copy-Item -LiteralPath ../mashina-env-before-update -Destination .env
git switch --detach PREVIOUS_REVISION
```

Ersetze `PREVIOUS_REVISION` durch den notierten Tag/Commit. Lege privat die Datei
`compose.rollback.yml` an:

```yaml
services:
  mashina:
    image: mashina:before-update
```

Starte das aufbewahrte Image ohne Neubau und wiederhole die Daten-/Health-Prüfung:

```sh
docker compose -f docker-compose.yml -f compose.rollback.yml up -d --no-build
```

Ein reiner Code-Downgrade ist nach einer Schemaänderung unsicher. Images bis 1.5.1
können Schema 007 nicht öffnen. Auch ein altes Frontend unterstützt die gespeicherte
deutsche Sprache nicht. Bei einem intakten aktuellen Schema ist alternativ die
validierte ZIP-Wiederherstellung bei gestoppter App möglich; siehe den
[vollständigen englischen Leitfaden](updating.md). ZIP-Wiederherstellung beendet
Sitzungen, widerruft API-Schlüssel und pausiert Benachrichtigungen. Eine kalte
Verzeichniskopie stellt dagegen die damaligen Sitzungen/Schlüssel mit wieder her.
Bewahre `.env`, Sicherungen und Rollback-Dateien außerhalb von Git auf.
