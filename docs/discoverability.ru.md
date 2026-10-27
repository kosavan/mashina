# Поиск и видимость MASHINA в ответах ИИ

[English](discoverability.md) · Русский · [Роудмап](roadmap.ru.md)

Подготовлено 12 октября 2026 года. Подготовка файлов не означает публикацию,
индексацию или принятие каталогами. Попадание в выдачу и ответы ИИ не гарантируется.

## Подготовлено

MIT для собственного кода, README с вопросами владельцев и объективным сравнением
с LubeLogger, статическая страница с реальными скриншотами на вымышленных данных,
FAQ, canonical, Open Graph, SoftwareApplication и sitemap. Сторонние материалы
сохраняют свои лицензии. Страница не содержит трекеров, удалённых шрифтов и
исполняемых скриптов. Отдельная русская посадочная страница пока в планах.

## Настройки GitHub и публикация

Описание About:

> Modern, open-source, self-hosted vehicle maintenance tracker. Keep service history, repairs, mileage, fuel and expenses in a beautiful, private app.

Topics: `self-hosted`, `car-maintenance`, `vehicle-maintenance`, `car-logbook`,
`automotive`, `docker`, `pwa`, `fuel-consumption`. Сохраните другие полезные темы.
Название MASHINA менять не нужно. После публикации Website:
`https://kosavan.github.io/mashina/`. Для social preview подходит имеющийся обзор
интерфейса с вымышленными данными. Файлы не меняют настройки аккаунта автоматически.

В Settings → Pages выберите GitHub Actions. Публикация запускается после успешного
CI для той же версии main. В артефакт входят только четырнадцать разрешённых файлов,
без исходного дерева, пользовательских данных и комплектов продвижения.
Локальные команды проверки приведены в [English-инструкции](discoverability.md).
После deployment проверьте HTTP 200 страницы, скриншот, sitemap и исходный HTML.

## Роботы и поисковые консоли

Правила читаются из `https://kosavan.github.io/robots.txt`, а не из `/mashina/`.
При отсутствии блокировки отдельное разрешение не нужно. Готовые группы для
OAI-SearchBot, Claude-SearchBot и PerplexityBot есть в
[English-инструкции](discoverability.md); объединять их с корневыми правилами
нужно с учётом остальных проектов. Политику обучающих ботов выбирают отдельно.
Robots не защищает личные данные.

Добавьте URL-prefix property в Google Search Console, подтвердите владение
выданным HTML-файлом или meta-тегом. Подключите Bing Webmaster Tools и отправьте
`https://kosavan.github.io/mashina/sitemap.xml` в обе системы. Нужны ваши аккаунты.
Проверьте индексацию, canonical и ошибки обхода. Разметку проверьте Rich Results
Test; она не гарантирует расширенный сниппет. `llms.txt` не добавлялся: Google
указывает, что специальный файл для его AI-поиска не требуется.

## Каталоги и отзывы

В [форме selfh.st](https://selfh.st/submit/) сейчас прямо исключены новые проекты
из каталога приложений. Вместо этого предлагают **Self-Host Weekly → Project
Launch**. Перед отправкой заявки в рассылку получите согласие владельца и честно
укажите разработку с помощью ИИ. Готовое английское описание есть в
[English-инструкции](discoverability.md). Заявка не гарантирует публикацию.

Для [Awesome Selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted-data/blob/master/CONTRIBUTING.md)
проверьте правила и дождитесь возраста первого опубликованного релиза больше
четырёх месяцев. Первый релиз MASHINA v0.1.0 опубликован 11 октября 2026 года:
подавать стоит не раньше 12 февраля 2027 года, повторно проверив правила.
Возраст репозитория не заменяет возраст релиза.
Используйте имеющийся комплект продвижения, проверяя правила сообществ.
Собирайте реальные отзывы об установке и использовании, не выдумывайте рекомендации.

## Измерение результата

Снимите исходное состояние после публикации и повторяйте ежемесячно: индекс,
показы, переходы, внешние ссылки и полезные отзывы. Включайте веб-поиск и задавайте
одинаковый запрос в ChatGPT, Claude, Perplexity и Google:

> Find modern open-source self-hosted applications for tracking car maintenance history, repairs and mileage. Prefer mobile-friendly interfaces.

Записывайте дату, систему, язык/регион, запрос, наличие MASHINA, процитированную
ссылку и ошибки. Дополнительные запросы: `self-hosted car maintenance tracker`,
`LubeLogger alternatives`, `private vehicle logbook`. Один ответ не является
стабильным рейтингом. Официальные источники перечислены в English-инструкции.
