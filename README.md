# LabSlot Frontend

> React-клиент системы бронирования оборудования, помещений и рабочих мест.

**[Демо](https://vitaliyarmss.github.io/labspot-frontend/)** · **[Backend](https://github.com/VitaliyArmss/labspot-backend)** · **[Основной проект](https://github.com/VitaliyArmss/labslot-project)**

## О проекте

Frontend реализован на React и JavaScript. Он предоставляет интерфейс для просмотра каталога ресурсов, входа в систему и управления бронированиями. Данные загружаются с ASP.NET Core REST API.

## Возможности

- каталог ресурсов с поиском и фильтрацией;
- регистрация и авторизация;
- создание и отмена бронирований;
- просмотр собственных бронирований;
- административный интерфейс;
- адаптивная вёрстка.

## Технологии

- React
- JavaScript
- Vite
- CSS
- Fetch API
- GitHub Actions / GitHub Pages

## Локальный запуск

```bash
npm install
npm run dev
```

Production-сборка:

```bash
npm run build
```

URL backend задаётся через переменную окружения `VITE_API_URL`. Production API:

```text
https://api.vitaliy-armss.ru/labspot/api
```

## Деплой

Приложение публикуется на GitHub Pages через GitHub Actions.

**[Открыть приложение →](https://vitaliyarmss.github.io/labspot-frontend/)**
