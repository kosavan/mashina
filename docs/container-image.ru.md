# Установка готового Docker-образа

[English](container-image.md) · [Установка без Docker](standalone.ru.md)

MASHINA поставляется через GitHub Container Registry для `linux/amd64` и `linux/arm64`. В Linux установите Docker Engine и Compose. В macOS и Windows используйте Docker Desktop с контейнерами Linux. Указывайте конкретную опубликованную версию.

1. На [странице релиза](https://github.com/kosavan/mashina/releases/tag/v1.13.0) скачайте `compose.registry.yml` в отдельную папку для установки. Для настройки можно сохранить в ту же папку [.env.example](https://github.com/kosavan/mashina/blob/v1.13.0/.env.example) под именем `.env`. Создайте `.env`, если его ещё нет, и добавьте строку `MASHINA_IMAGE=ghcr.io/kosavan/mashina:1.13.0`.
2. Создайте рядом папку `data`. При использовании Docker Desktop выбирайте локальную папку вне облачной синхронизации и сетевых дисков. Команда `chown` ниже задаёт права новой папки для запуска сервиса без root.
3. Из этой папки выполните:

   ```sh
   docker compose -f compose.registry.yml pull
   docker compose -f compose.registry.yml run --rm --no-deps --user 0:0 --cap-add CHOWN --entrypoint sh mashina -c 'chown 10001:10001 /app/data'
   docker compose -f compose.registry.yml up -d --no-build
   docker compose -f compose.registry.yml exec mashina /app/.venv/bin/python -m backend.cli create-admin
   ```

Откройте `http://localhost:8000` и войдите. По адресу `/api/v1/health` проверьте версию и схему. Compose будет запускать сервис в фоне, пока работает Docker. Для запуска при входе включите эту настройку в Docker Desktop. Для удалённого доступа настройте [HTTPS](handbook.ru.md).

## Обновление и откат

1. Синхронизируйте все устройства. По [инструкции обновления](updating.ru.md) остановите приложение, создайте полный бэкап предыдущей версией и сохраните её образ. Скопируйте архив и старый `.env` в безопасное место. Сохраните имя проекта Compose, включая `-p` или `COMPOSE_PROJECT_NAME`, если они использовались.
2. Используйте прежние проект, каталог, папку `./data` и адрес в браузере. Поместите новый `compose.registry.yml` рядом со старым Compose-файлом и задайте в `.env` новую версию `MASHINA_IMAGE`. Выполните `pull` и `up`, как указано выше. Войдите в существующий аккаунт.
3. Проверьте `/api/v1/health`, историю и вложения. Откройте браузеры и PWA онлайн и проверьте синхронизацию записей.
4. Для отката остановите новую версию и сохраните в отдельный бэкап новые записи. Восстановите соответствующую копию данных прежним образом по [инструкции отката](updating.ru.md). Если предыдущая установка собиралась локально, используйте её Compose-файл. Если она использовала реестр, укажите сохранённый образ в `MASHINA_IMAGE`. Запустите прежнюю версию с тем же проектом и папкой данных.
