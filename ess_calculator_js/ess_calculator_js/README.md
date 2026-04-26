# ESS Calculator JS

Це чиста статична JavaScript-версія калькулятора ESS.

## Що всередині

```text
ess_calculator_js/
├─ index.html
├─ style.css
├─ app.js
└─ README.md
```

## Як запустити локально

Найпростіше:

1. Розпакуй архів.
2. Відкрий `index.html` у браузері.

Краще для тесту через VS Code:

1. Відкрий папку `ess_calculator_js` у VS Code.
2. Встанови розширення **Live Server**.
3. Натисни правою кнопкою по `index.html`.
4. Обери **Open with Live Server**.

## Як підключити n8n

1. У n8n створи `Webhook` node.
2. Method: `POST`.
3. Скопіюй Production URL.
4. Встав URL у поле `n8n Webhook URL` на сайті.
5. Натисни `Відправити в n8n`.

## Що приходить у n8n

У webhook приходить JSON, який лежить у body як текст. Якщо n8n не розпарсив його автоматично, додай Code node після Webhook:

```javascript
const raw = $json.body;
return [{ json: typeof raw === 'string' ? JSON.parse(raw) : raw }];
```

Після цього в n8n будуть доступні:

```text
project
price_settings
container_spec
pcs_spec
sts_spec
common_spec
rows
totals
currency
created_at
```

## Важливо про безпеку

У JavaScript-версії всі формули й стандартні ціни видно в коді сайту.
Не вставляй у `app.js` секретні токени Telegram, OpenAI, CRM або інші приватні ключі.

Для секретів використовуй n8n або backend.
