# Установка MASHINA без Docker

[English version](standalone.md)

MASHINA запускается под вашей учётной записью и открывается в браузере по
адресу `http://127.0.0.1:8000/`. Сервер продолжает работать после закрытия
браузера. Один архив подходит для Linux с systemd, Windows и macOS.

## Установка

1. Установите или обновите [uv](https://docs.astral.sh/uv/getting-started/installation/).
   Скачайте `mashina-standalone.zip` из [релизов GitHub](https://github.com/kosavan/mashina/releases)
   и распакуйте его в постоянный каталог, доступный вашей учётной записи.
2. Откройте терминал в распакованном каталоге `mashina-<version>`. Выполните
   команды от своего обычного пользователя. При первой установке uv скачает
   Python 3.14 и фиксированные версии зависимостей. Веб-интерфейс уже собран
   и входит в архив.

   ```text
   uv python install 3.14 --upgrade
   uv run --no-project --managed-python --python 3.14 tools/standalone.py prepare
   uv run --no-project --managed-python --python 3.14 tools/standalone.py admin create-admin
   uv run --no-project --managed-python --python 3.14 tools/standalone.py install
   ```

3. Откройте `http://127.0.0.1:8000/` и войдите в систему. При установке
   в терминале отобразится каталог данных. Если порт 8000 занят, добавьте
   к команде `install` параметр `--port 8001` и откройте
   `http://127.0.0.1:8001/`. Если служба зарегистрировалась, но проверка
   запуска завершилась ошибкой, посмотрите её состояние через `status`
   и журналы ниже. Перед повторной регистрацией выполните `uninstall`.

Перед открытием базы установщик проверяет наличие SQLite 3.51.3 или новее.
Если SQLite в вашей сборке Python старее, обновите uv и установленный через него
Python. Для распознавания чеков и PDF отдельно установите Tesseract с нужными
языковыми пакетами и Poppler. Перед регистрацией службы проверьте, что
`tesseract` и `pdftoppm` доступны через PATH в терминале.

При установке из тега исходного кода используйте Node.js 22 и перед теми же
действиями выполните `npm ci` и `npm run build` в каталоге `frontend/`.

## Работа в фоне

Вместо `install` можно выполнить `status`, `stop`, `start` или `uninstall`.

| Система | Автозапуск | Журнал |
| --- | --- | --- |
| Linux | Служба `mashina.service` запускается при входе пользователя. На сервере без рабочего стола `loginctl enable-linger` для нужной учётной записи включает запуск при загрузке и работу после выхода. | `journalctl --user -u mashina.service -n 100` |
| Windows | Задание `MASHINA-<SID пользователя>` в Планировщике заданий стартует при входе. | `server.log` в каталоге данных |
| macOS | LaunchAgent `io.github.kosavan.mashina` стартует при входе в рабочий стол. | `server.log` в каталоге данных |

Компьютер должен оставаться включённым. На Windows и macOS нужен активный сеанс
пользователя. Для доступа с других устройств см. [руководство по Docker и HTTPS](https://github.com/kosavan/mashina/blob/main/docs/handbook.ru.md).

## Данные, обновление и откат

- Linux — `$XDG_DATA_HOME/mashina/data` или `~/.local/share/mashina/data`.
- Windows — `%LOCALAPPDATA%\MASHINA\data`.
- macOS — `~/Library/Application Support/MASHINA/data`.

Для своего каталога укажите абсолютный путь через `--data-dir` в командах
`install` и `admin`. Храните данные на приватном локальном диске отдельно
от распакованной версии. `uninstall` удаляет регистрацию службы.

Перед обновлением остановите службу, сделайте бэкап из каталога **старой**
версии и сохраните этот каталог вместе с ZIP-архивом.

```text
uv run --no-project --managed-python --python 3.14 tools/standalone.py stop
uv run --no-project --managed-python --python 3.14 tools/standalone.py admin backup --backup-dir /path/to/private/backups
uv run --no-project --managed-python --python 3.14 tools/standalone.py uninstall
```

Подставьте абсолютный путь для бэкапа, например
`"C:\Users\you\MASHINA backups"` на Windows. Распакуйте новый релиз в
отдельный каталог и выполните `install` с тем же каталогом данных и портом.
Откройте `/api/v1/health`, войдите в систему и проверьте историю машин и
вложения. Приложение сохраняет идентификаторы записей и офлайн-операций.
Продолжайте использовать тот же адрес и профиль браузера, чтобы сохранить
очередь ещё не отправленных операций.

Для отката сделайте бэкап новых записей из новой версии при остановленной
службе и снимите её с регистрации. Из каталога старого релиза восстановите
копию, созданную **до** обновления, в пустой приватный каталог.

```text
uv run --no-project --managed-python --python 3.14 tools/standalone.py admin --data-dir /path/to/restored-data restore --file /path/to/pre-upgrade.zip
uv run --no-project --managed-python --python 3.14 tools/standalone.py install --data-dir /path/to/restored-data
```

Чтобы перейти с Docker, сделайте резервную копию, остановите старую установку
и восстановите архив в пустой каталог данных standalone-версии. Проверьте
новую установку перед удалением старой.

Для запуска в терминале выполните `prepare`, затем запустите
`tools/standalone.py serve` через Python из каталога установки. На Linux и
macOS это `.cache/standalone/bin/python`, на Windows —
`.cache\standalone\Scripts\python.exe`. Перед этим остановите службу.
