#!/bin/bash
# ==============================================================
# AltaBot - Script de deploy automático para VPS Ubuntu 22.04
# Uso: ssh root@TU_IP "bash <(curl -s https://raw.githubusercontent.com/rolfisobko-collab/altabot/main/deploy.sh)"
# ==============================================================

set -e

echo "🤖 AltaBot Deploy Script"
echo "========================"

# 1. Instalar Node.js 20
if ! command -v node &> /dev/null; then
  echo "📦 Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "✅ Node.js $(node -v) ya instalado"
fi

# 2. Instalar PM2 (gestor de procesos)
if ! command -v pm2 &> /dev/null; then
  echo "📦 Instalando PM2..."
  npm install -g pm2
else
  echo "✅ PM2 ya instalado"
fi

# 3. Clonar o actualizar el repo
if [ -d "/opt/altabot" ]; then
  echo "🔄 Actualizando código..."
  cd /opt/altabot
  git pull origin main
else
  echo "📥 Clonando repositorio..."
  git clone https://github.com/rolfisobko-collab/altabot.git /opt/altabot
  cd /opt/altabot
fi

# 4. Instalar dependencias y buildear el panel
echo "📦 Instalando dependencias..."
npm install
echo "🔨 Buildeando panel..."
npm run build

# 5. Crear archivo .env si no existe
if [ ! -f "/opt/altabot/.env" ]; then
  echo ""
  echo "⚙️  Configurando variables de entorno..."
  read -p "MongoDB URI: " MONGODB_URI
  read -p "MongoDB DB (default: test): " MONGODB_DB
  MONGODB_DB=${MONGODB_DB:-test}

  cat > /opt/altabot/.env << EOF
MONGODB_URI=${MONGODB_URI}
MONGODB_DB=${MONGODB_DB}
PORT=3000
EOF
  echo "✅ .env creado"
fi

# 6. Iniciar/reiniciar con PM2
cd /opt/altabot
pm2 delete altabot 2>/dev/null || true
pm2 start index.js --name altabot
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "✅ AltaBot corriendo!"
echo "📊 Panel en: http://$(curl -s ifconfig.me):3000"
echo ""
echo "Comandos útiles:"
echo "  pm2 logs altabot     → ver logs en tiempo real"
echo "  pm2 restart altabot  → reiniciar el bot"
echo "  pm2 status           → ver estado"
