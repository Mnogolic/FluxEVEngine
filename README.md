# FluxEV Engine

Real-time EVE Online market data collector and analysis engine. Tracks top 1000 items across major trade hubs using ESI API (Tranquility).

---

## Stack

- **Python 3.12** — язык
- **FastAPI** — REST API сервер
- **PostgreSQL 17** — база данных (`H:\PostSQl`)
- **SQLAlchemy (async)** + **Alembic** — ORM и миграции
- **aiohttp** — запросы к ESI API
- **APScheduler** — сбор данных по расписанию (каждый день в 01:00)
- **Plotly.js** + **Jinja2** — веб-дашборд

---

## Запуск после перезагрузки ПК

### 1. Запустить PostgreSQL

Открыть **PowerShell от имени администратора** и выполнить:

```powershell
& "H:\PostSQl\bin\pg_ctl.exe" stop -D "H:\PostSQl\data"
& "H:\PostSQl\bin\pg_ctl.exe" start -D "H:\PostSQl\data"
```

> PostgreSQL не запускается автоматически — нужно запускать вручную каждый раз.

### 2. Открыть проект в VSCode

```
C:\Users\kasja\VsCodeSSD\FluxEVEngine
```

### 3. Запустить сервер

В терминале VSCode (`Ctrl+\``):

```bash
.venv\Scripts\uvicorn.exe main:app --reload
```

### 4. Открыть дашборд

```
http://localhost:8000/
```

Swagger UI (API документация):

```
http://localhost:8000/docs
```

---

## Сбор свежих данных вручную

Запускать после старта сервера PostgreSQL, но **не обязательно** запускать uvicorn:

```bash
.venv\Scripts\python.exe -m scripts.collect_now
```

Посмотреть суммарный оборот в ISK и USD:

```bash
.venv\Scripts\python.exe -m scripts.turnover
```

---

## Структура проекта

```
FluxEVEngine/
├── app/
│   ├── api/
│   │   ├── dashboard.py      # GET / — дашборд с графиками
│   │   └── market.py         # GET /market/items, /market/history/{type_id}
│   ├── collector/
│   │   └── scheduler.py      # сбор market history по расписанию
│   ├── core/
│   │   └── config.py         # настройки из .env
│   ├── db/
│   │   ├── models.py         # таблицы: tracked_items, market_history, market_orders
│   │   └── session.py        # подключение к БД
│   └── esi/
│       ├── client.py         # HTTP клиент для ESI API
│       └── market.py         # запросы к ESI + список регионов
├── alembic/                  # миграции БД
├── scripts/
│   ├── seed_top_items.py     # одноразовый: заполнить топ 1000 товаров
│   ├── collect_now.py        # ручной сбор market history
│   ├── turnover.py           # оборот по регионам в ISK и USD
│   ├── diagnose.py           # диагностика ESI и БД
│   └── check_db.py           # проверка данных в market_history
├── templates/
│   └── dashboard.html        # HTML дашборд (Plotly.js)
├── main.py                   # точка входа FastAPI
├── requirements.txt
└── .env                      # DATABASE_URL и ESI_BASE_URL (не в git)
```

---

## Переменные окружения (.env)

```
DATABASE_URL=postgresql+asyncpg://fluxev:D3MyDarling@localhost:5432/fluxev
ESI_BASE_URL=https://esi.evetech.net/latest
```

---

## Установка с нуля (если новая машина)

```bash
python -m venv .venv
.venv\Scripts\pip.exe install -r requirements.txt
.venv\Scripts\alembic.exe upgrade head
.venv\Scripts\python.exe -m scripts.seed_top_items
.venv\Scripts\python.exe -m scripts.collect_now
.venv\Scripts\uvicorn.exe main:app --reload
```
