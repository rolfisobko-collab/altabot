# IA Chat Bot — Telegram + Gemini + MongoDB

Bot de atención al cliente con IA para Telegram. Responde preguntas sobre productos, precios y stock consultando la base de datos en tiempo real.

## Estructura del proyecto

```
iachat/
├── index.js          # Punto de entrada principal
├── src/
│   ├── config.js     # ⚙️  CONFIGURACIÓN DEL NEGOCIO (modificar acá)
│   ├── bot.js        # Lógica del bot de Telegram
│   ├── ai.js         # Integración con Gemini AI + historial de conversación
│   ├── products.js   # Búsqueda de productos en MongoDB
│   └── db.js         # Conexión a MongoDB
├── .env              # Variables de entorno (NO subir a GitHub)
├── railway.json      # Configuración para Railway (nube gratis)
└── package.json
```

## Configuración del negocio

Todo lo que necesitás modificar está en `src/config.js`:

- `businessName` — Nombre del negocio
- `businessDescription` — Descripción del negocio
- `welcomeMessage` — Mensaje de bienvenida
- `systemPrompt` — Instrucciones para la IA (comportamiento del bot)
- `maxProductsInResponse` — Cuántos productos mostrar por respuesta

## Variables de entorno (.env)

```env
TELEGRAM_TOKEN=tu_token_de_botfather
GEMINI_API_KEY=tu_api_key_de_google
MONGODB_URI=tu_uri_de_mongodb
MONGODB_DB=test
```

## Comandos del bot

| Comando       | Descripción                          |
|---------------|--------------------------------------|
| `/start`      | Inicia la conversación               |
| `/ayuda`      | Muestra ejemplos de consultas        |
| `/categorias` | Lista las categorías disponibles     |
| `/reset`      | Reinicia el historial de conversación|

## Ejecutar localmente

```bash
npm install
node index.js
```

---

## Despliegue en la nube GRATIS con Railway

Railway ofrece **$5 USD de crédito gratis por mes** — más que suficiente para este bot liviano.

### Pasos:

1. **Crear cuenta** en [railway.app](https://railway.app) (gratis con GitHub)

2. **Subir el código a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # Crear repo en github.com y luego:
   git remote add origin https://github.com/TU_USUARIO/iachat.git
   git push -u origin main
   ```

3. **Crear proyecto en Railway:**
   - New Project → Deploy from GitHub repo → Seleccionar el repo
   - Railway detecta automáticamente que es Node.js

4. **Agregar variables de entorno en Railway:**
   - Ir a tu proyecto → Variables → Add Variable
   - Agregar cada variable del `.env`:
     - `TELEGRAM_TOKEN`
     - `GEMINI_API_KEY`
     - `MONGODB_URI`
     - `MONGODB_DB`

5. **Deploy automático** — Railway despliega y el bot queda corriendo 24/7.

### Alternativa gratis: Render.com

1. Ir a [render.com](https://render.com) → New Web Service
2. Conectar el repo de GitHub
3. Build Command: `npm install`
4. Start Command: `node index.js`
5. Agregar las variables de entorno
6. **Importante:** En Render el plan gratuito "duerme" si no hay requests HTTP. Para evitarlo, agregar un endpoint de health check (ya incluido en el bot).

> **Recomendación: Usar Railway** — es más simple y no tiene el problema del "sleep".
