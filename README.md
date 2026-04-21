# FluxEV Engine

Программный интерфейс для анализа внутриигровой экономики EVE Online.
Система собирает рыночные данные через официальный ESI API (сервер Tranquility), хранит их в PostgreSQL и предоставляет веб-дашборд с графиками, анализом трендов и прогнозом цен на основе линейной регрессии.

---

## Стек технологий

| Компонент | Технология | Версия |
|---|---|---|
| Язык | Python | 3.12.3 |
| База данных | PostgreSQL | 17 |
| Web framework | FastAPI | 0.135.2 |
| ASGI сервер | Uvicorn | 0.42.0 |
| ORM | SQLAlchemy (async) | 2.0.48 |
| Драйвер БД | asyncpg | 0.31.0 |
| Миграции | Alembic | 1.18.4 |
| HTTP клиент | aiohttp | 3.13.3 |
| Планировщик | APScheduler | 3.11.2 |
| Конфигурация | pydantic-settings | 2.13.1 |
| Шаблоны | Jinja2 | 3.1.6 |
| Визуализация | Plotly.js | 2.27.0 |
| Математика | NumPy | 2.4.4 |

---

## Функционал

- Сбор топ 1000 товаров по торговому объёму из Jita (главный хаб EVE)
- Ежедневный автоматический сбор истории цен по 5 торговым регионам
- Сбор полной 30-дневной истории цен для анализа
- Веб-дашборд с тремя графиками:
  - Торговый оборот по хабам (ISK + USD при наведении)
  - Топ 20 товаров по обороту в Jita
  - История цен + прогноз на 7 дней (выбор товара и региона)
- Линейная регрессия с метриками R2, MAE, slope (ISK/день)
- Конвертация ISK -> USD через актуальный курс PLEX
- REST API с документацией Swagger UI

---

## Структура проекта

```
FluxEVEngine/
├── app/
│   ├── api/
│   │   └── market.py         # GET /market/items, /market/history, /market/price
│   ├── collector/
│   │   └── scheduler.py      # APScheduler - сбор данных каждый день в 01:00
│   ├── core/
│   │   └── config.py         # настройки из .env
│   ├── db/
│   │   ├── models.py         # таблицы: tracked_items, market_history, market_orders
│   │   └── session.py        # async подключение к БД
│   └── esi/
│       ├── client.py         # aiohttp клиент для ESI API
│       └── market.py         # запросы к ESI + список регионов
├── alembic/                  # миграции БД
├── scripts/
│   ├── seed_top_items.py     # одноразовый: заполнить топ 1000 товаров
│   ├── collect_now.py        # ручной сбор с подробными метриками
│   ├── fetch_history.py      # сбор 30-дневной истории по всем регионам
│   ├── price_analysis.py     # линейная регрессия + прогноз по всем регионам
│   ├── turnover.py           # оборот по регионам в ISK и USD
│   ├── diagnose.py           # диагностика ESI и БД
│   └── check_db.py           # статистика строк по датам и регионам
├── main.py                   # точка входа FastAPI
├── requirements.txt
└── .env                      # DATABASE_URL и ESI_BASE_URL (не в git)
```

---

## Переменные окружения (.env)

Скопировать шаблон `.env.example` в `.env` и при необходимости изменить значения:

```
copy .env.example .env
```

Содержимое `.env.example`:

```
DATABASE_URL=postgresql+asyncpg://fluxev:<password>@localhost:5432/fluxev
ESI_BASE_URL=https://esi.evetech.net/latest
```

---

## Установка с нуля

```bash
# 1. Создать виртуальное окружение
python -m venv .venv

# 2. Установить зависимости
.venv\Scripts\pip.exe install -r requirements.txt

# 3. Создать .env из шаблона
copy .env.example .env

# 4. Создать БД и пользователя в PostgreSQL
# (выполнить в psql от имени postgres)
CREATE USER fluxev WITH PASSWORD '<password>';
CREATE DATABASE fluxev OWNER fluxev;

# 5. Применить миграции (создать таблицы)
.venv\Scripts\alembic.exe upgrade head

# 6. Заполнить топ 1000 товаров (одноразово)
.venv\Scripts\python.exe -m scripts.seed_top_items

# 7. Собрать 30-дневную историю цен
.venv\Scripts\python.exe -m scripts.fetch_history

# 8. Запустить сервер
bun api
bun dev
```

---

## Запуск после перезагрузки ПК

### 1. Запустить PostgreSQL

Открыть **PowerShell от имени администратора**:

```powershell
& "H:\PostSQl\bin\pg_ctl.exe" stop -D "H:\PostSQl\data"
& "H:\PostSQl\bin\pg_ctl.exe" start -D "H:\PostSQl\data"
```

> PostgreSQL не запускается автоматически - нужно запускать вручную каждый раз.

### 2. Запустить сервер

В терминале VSCode (`Ctrl+\``):

```bash
bun api
bun dev
```

### 3. Открыть дашборд

```
http://localhost:8000/
```

Swagger UI (документация API):

```
http://localhost:8001/docs
```

---

## Примеры запуска скриптов

### Ручной сбор данных за сегодня (с метриками)

```bash
.venv\Scripts\python.exe -m scripts.collect_now
```

Пример вывода:
```
2026-04-11 21:00:01 [INFO] FluxEV Engine - Market Data Collector
2026-04-11 21:00:01 [INFO] Tracked items loaded: 1000
2026-04-11 21:00:01 [INFO] Total API requests to make: 5000
2026-04-11 21:00:45 [INFO] Collection completed in 44.2 seconds
2026-04-11 21:00:45 [INFO] Rows per region (latest date):
2026-04-11 21:00:45 [INFO]   Jita         959 rows
2026-04-11 21:00:45 [INFO]   Amarr        768 rows
2026-04-11 21:00:45 [INFO]   Dodixie      703 rows
```

### Сбор 30-дневной истории по всем регионам

```bash
.venv\Scripts\python.exe -m scripts.fetch_history
```

Быстрое догоняющее обновление без запросов по уже свежим парам товар/регион:

```bash
.venv\Scripts\python.exe -m scripts.fetch_history --incremental
```

Проверить, сколько ESI-запросов будет сделано, без реального запуска:

```bash
.venv\Scripts\python.exe -m scripts.fetch_history --incremental --dry-run
```

Пример вывода:
```
2026-04-11 21:05:00 [INFO] Items to process : 100
2026-04-11 21:05:00 [INFO] Regions          : Jita, Amarr, Dodixie, Hek, Rens
2026-04-11 21:05:00 [INFO] Total API calls  : ~500
2026-04-11 21:05:12 [INFO]   Jita       saved:   270 rows | empty:   3 | time: 12.1s
2026-04-11 21:05:24 [INFO]   Amarr      saved:   241 rows | empty:   8 | time: 11.8s
```

### Анализ трендов и прогноз цен

```bash
.venv\Scripts\python.exe -m scripts.price_analysis
```

Пример вывода:
```
========================================================================
  Region: Jita | Top 10 items | Forecast: +7 days
========================================================================
  Item                             Trend         R2         MAE       Now         7d    Pts
  Tritanium                    up            0.847        0.12      3.89       3.90    30
  Pyerite                      down          0.761        0.08      5.12       5.11    30
  Mexallon                     up            0.923        0.31     18.45      18.58    28
```

### Оборот в ISK и USD

```bash
.venv\Scripts\python.exe -m scripts.turnover
```

Пример вывода:
```
PLEX price: 6,120,000 ISK  ->  1 USD = 153,000,000 ISK

Hub          ISK                        USD
----------------------------------------------------
Jita         16,588,158,435 ISK        $108.42
Amarr         3,241,000,000 ISK         $21.18
Dodixie       2,100,000,000 ISK         $13.72
Hek           2,800,000,000 ISK         $18.30
Rens            400,000,000 ISK          $2.61
----------------------------------------------------
TOTAL        25,129,158,435 ISK        $164.23
```

---

## REST API

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/dashboard/overview` | Агрегированные данные дашборда для standalone frontend |
| GET | `/market/items` | Список 1000 отслеживаемых товаров |
| GET | `/market/history/{type_id}` | История цен по товару |
| GET | `/market/price/{type_id}` | История + прогноз на 7 дней (JSON) |

Полная документация: `http://localhost:8001/docs`

---

## CI/CD

- `CI` настроен через GitHub Actions в `.github/workflows/ci.yml`.
- Workflow запускается на `push` в `main`/`master` и на каждый `pull request`.
- В CI автоматически выполняются:
  - установка зависимостей;
  - запуск PostgreSQL 17 в GitHub Actions;
  - применение миграций `alembic upgrade head`;
  - проверка, что таблицы созданы;
  - синтаксическая проверка `python -m compileall`;
  - smoke test импорта FastAPI-приложения и маршрутов.

- `CD` настроен через GitHub Actions в `.github/workflows/cd.yml`.
- Workflow запускается при пуше тега формата `v*`, например `v1.0.0`.
- В CD автоматически собирается ZIP-архив проекта, загружается как artifact и прикладывается к GitHub Release.

Пример выпуска релиза:

```bash
git tag v1.0.0
git push origin v1.0.0
```
