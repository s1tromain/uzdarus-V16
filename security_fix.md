# 🔐 ИСПРАВЛЕНИЕ УЯЗВИМОСТИ БЕЗОПАСНОСТИ

## ❌ ПРОБЛЕМА
Telegram Bot токены находились в HTML файлах (index.html, tolov.html), которые видны всем пользователям. Кто-то использовал эти токены для отправки спама в ваш чат.

## ✅ РЕШЕНИЕ
Теперь токены хранятся **ТОЛЬКО НА СЕРВЕРЕ** (server/server.js), клиенты используют безопасный API.

---

## 📋 ЧТО СДЕЛАНО:

### 1. Обновлен `server/server.js`
- ✅ Добавлены 2 новых endpoint'а:
  - `/api/send-contact` - для формы обратной связи
  - `/api/send-payment` - для заявок на оплату
- ✅ Токены хранятся на сервере (не видны клиенту)

### 2. Обновлен `index.html`
- ✅ Удалены токены из клиентского кода
- ✅ Форма теперь отправляет через API

### 3. Обновлен `tolov.html`
- ✅ Удалены токены из клиентского кода
- ✅ Форма теперь отправляет через API

---

## 🚀 КАК ЗАПУСТИТЬ:

### Шаг 1: Установите зависимости (если нужно)
```bash
cd server
npm install
```

### Шаг 2: Запустите сервер
```bash
cd server
node server.js
```

Вы должны увидеть:
```
Server running on http://localhost:3000
```

### Шаг 3: Откройте сайт
Откройте `index.html` в браузере. Формы теперь работают через безопасный API!

---

## 🔒 БЕЗОПАСНОСТЬ:

**ВАЖНО:**
1. ❌ **НИКОГДА** не храните API ключи/токены в HTML/JavaScript файлах
2. ✅ Храните их только на сервере (в .env файлах или переменных окружения)
3. ✅ Клиент должен вызывать API, а API использует токены

---

## 🌐 ДЛЯ PRODUCTION:

Когда будете деплоить на хостинг:

### 1. Создайте `.env` файл в папке `server/`:
```env
TELEGRAM_CONTACT_TOKEN=8316080775:AAHixiWEXwaacyeq5NywMi_JdZJ_qtsbrIY
TELEGRAM_PAYMENT_TOKEN=8538707806:AAFKpIuaiZe58LQJCpFh54hlTitzud3ofNM
TELEGRAM_CHAT_ID=8439904337
PORT=3000
```

### 2. Обновите `server.js`:
```javascript
import dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_BOTS = {
    contact: {
        token: process.env.TELEGRAM_CONTACT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    },
    payment: {
        token: process.env.TELEGRAM_PAYMENT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    }
};
```

### 3. Установите dotenv:
```bash
npm install dotenv
```

### 4. Добавьте `.env` в `.gitignore`!
```
.env
node_modules/
```

### 5. В клиентских файлах измените URL:
```javascript
// Вместо http://localhost:3000
fetch('https://ваш-домен.com/api/send-contact', ...)
```

---

## 🛡️ ЧТО ДЕЛАТЬ С УТЕКШИМИ ТОКЕНАМИ:

### 1. Зайдите в Telegram → @BotFather
### 2. Отзовите старые токены:
```
/revoke
```
Выберите каждого бота и отзовите токен.

### 3. Или создайте новых ботов:
```
/newbot
```
И замените токены в `server.js` (или `.env`)

---

## ✅ ПРОВЕРКА:

1. Запустите сервер: `node server.js`
2. Откройте `index.html`
3. Заполните форму "Qayta aloqa"
4. Отправьте
5. Проверьте Telegram - должно прийти сообщение
6. В консоли браузера НЕ должно быть видно токенов!

---

## 📞 ПОДДЕРЖКА:

Если что-то не работает:
1. Проверьте что сервер запущен (`node server.js`)
2. Проверьте консоль браузера (F12) на ошибки
3. Проверьте что URL в клиенте правильный (`http://localhost:3000`)

**ВАЖНО:** Фейковые имена (Travis Huff, Alice Gonzalez и т.д.) больше не будут приходить, так как токены теперь защищены!
