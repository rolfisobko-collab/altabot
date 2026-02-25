import { useState, useEffect, useCallback } from "react";
import {
  Bot, MessageCircle, Settings, RefreshCw, Wifi, WifiOff,
  Save, RotateCcw, CheckCircle, XCircle, Package, Zap, MessagesSquare, ChevronLeft
} from "lucide-react";

const API = "/api";

function StatusBadge({ ok, labelOn, labelOff }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <CheckCircle size={12} /> {labelOn}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <XCircle size={12} /> {labelOff}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
      {children}
    </div>
  );
}

function Btn({ onClick, children, variant = "primary", disabled = false, className = "" }) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-green-500 text-white hover:bg-green-600",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  // Stats
  const [stats, setStats] = useState(null);

  // Telegram
  const [tgStatus, setTgStatus] = useState({ connected: false });
  const [restarting, setRestarting] = useState(false);

  // WhatsApp
  const [waStatus, setWaStatus] = useState({ status: "disconnected", qrDataUrl: null });
  // Chats
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  // Config
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [s, tg, wa, cfg, ch] = await Promise.all([
        fetch(`${API}/stats`).then(r => r.json()),
        fetch(`${API}/telegram/status`).then(r => r.json()),
        fetch(`${API}/whatsapp/status`).then(r => r.json()),
        fetch(`${API}/config`).then(r => r.json()),
        fetch(`${API}/chats`).then(r => r.json()).catch(() => []),
      ]);
      setStats(s);
      setTgStatus(tg);
      setWaStatus(wa);
      setConfig(prev => prev ?? cfg);
      setChats(Array.isArray(ch) ? ch : []);
      setChatsLoading(false);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 4000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const openChat = async (chatId) => {
    setSelectedChat(chatId);
    const data = await fetch(`${API}/chats/${encodeURIComponent(chatId)}`).then(r => r.json());
    setChatMessages(data.messages || []);
  };

  const restartTelegram = async () => {
    setRestarting(true);
    await fetch(`${API}/telegram/restart`, { method: "POST" });
    setTimeout(() => { setRestarting(false); fetchAll(); }, 2000);
  };

  const connectWA = async () => {
    await fetch(`${API}/whatsapp/connect`, { method: "POST" });
    fetchAll();
  };

  const disconnectWA = async () => {
    await fetch(`${API}/whatsapp/disconnect`, { method: "POST" });
    fetchAll();
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const d = await r.json();
      if (d.ok) showToast("Configuración guardada ✓");
      else showToast("Error al guardar", "error");
    } catch {
      showToast("Error al guardar", "error");
    }
    setSaving(false);
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Zap },
    { id: "telegram", label: "Telegram", icon: Bot },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "chats", label: "Chats", icon: MessagesSquare },
    { id: "config", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${toast.type === "error" ? "bg-red-500" : "bg-green-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <div className="flex min-h-screen">
        <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-6 px-3 fixed h-full">
          <div className="flex items-center gap-2 px-3 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">AltaBot</span>
          </div>
          <nav className="flex flex-col gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <t.icon size={17} />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto px-3 text-xs text-gray-400">v1.0 · AltaBot Panel</div>
        </aside>

        {/* Main */}
        <main className="ml-56 flex-1 p-8">
          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
              <p className="text-gray-500 text-sm mb-6">Estado general del sistema</p>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <div className="text-3xl font-bold text-indigo-600">{stats?.totalProducts ?? "—"}</div>
                  <div className="text-sm text-gray-500 mt-1 flex items-center gap-1"><Package size={14}/> Productos en DB</div>
                </Card>
                <Card>
                  <div className="text-3xl font-bold text-green-600">{stats?.inStock ?? "—"}</div>
                  <div className="text-sm text-gray-500 mt-1">Con stock disponible</div>
                </Card>
                <Card>
                  <div className="text-3xl font-bold text-blue-600">{stats?.withPrice ?? "—"}</div>
                  <div className="text-sm text-gray-500 mt-1">Con precio cargado</div>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 font-semibold text-gray-800"><Bot size={18}/> Telegram</div>
                    <StatusBadge ok={tgStatus.connected} labelOn="Conectado" labelOff="Desconectado" />
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Bot{" "}
                    {tgStatus.username ? (
                      <a href={`https://t.me/${tgStatus.username.replace("@","")}`} target="_blank" rel="noreferrer" className="text-sky-600 font-semibold hover:underline">{tgStatus.username}</a>
                    ) : <strong>@buebasbotbot</strong>}
                    {" "}— responde consultas por Telegram
                  </p>
                  <Btn onClick={restartTelegram} disabled={restarting} variant="secondary">
                    <RefreshCw size={15} className={restarting ? "animate-spin" : ""} />
                    {restarting ? "Reiniciando..." : "Reiniciar bot"}
                  </Btn>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 font-semibold text-gray-800"><MessageCircle size={18}/> WhatsApp</div>
                    <StatusBadge ok={waStatus.status === "connected"} labelOn="Conectado" labelOff={waStatus.status === "qr_ready" ? "Esperando QR" : "Desconectado"} />
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    {waStatus.status === "connected" ? "WhatsApp activo y respondiendo clientes." : "Conectá WhatsApp escaneando el QR."}
                  </p>
                  <Btn onClick={() => setTab("whatsapp")} variant="secondary">
                    <MessageCircle size={15}/> Ir a WhatsApp
                  </Btn>
                </Card>
              </div>
            </div>
          )}

          {/* TELEGRAM */}
          {tab === "telegram" && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Telegram</h1>
              <p className="text-gray-500 text-sm mb-6">Configuración y estado del bot de Telegram</p>
              <Card className="max-w-xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                    <Bot size={22} className="text-sky-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {tgStatus.username ? (
                        <a href={`https://t.me/${tgStatus.username.replace("@","")}`} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">{tgStatus.username}</a>
                      ) : "Bot de Telegram"}
                    </div>
                    <StatusBadge ok={tgStatus.connected} labelOn="Conectado" labelOff="Desconectado" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token del bot</label>
                  <input
                    type="password"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="8684980516:AAH..."
                    value={config?.telegramToken || ""}
                    onChange={e => setConfig(c => ({ ...c, telegramToken: e.target.value }))}
                  />
                  <p className="text-xs text-gray-400 mt-1">Obtenido de @BotFather. Se guarda encriptado.</p>
                </div>

                <div className="flex gap-3">
                  <Btn onClick={saveConfig} disabled={saving}>
                    <Save size={15}/> {saving ? "Guardando..." : "Guardar token"}
                  </Btn>
                  <Btn onClick={restartTelegram} disabled={restarting} variant="secondary">
                    <RefreshCw size={15} className={restarting ? "animate-spin" : ""} />
                    {restarting ? "Reiniciando..." : "Reiniciar"}
                  </Btn>
                </div>
              </Card>
            </div>
          )}

          {/* WHATSAPP */}
          {tab === "whatsapp" && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">WhatsApp</h1>
              <p className="text-gray-500 text-sm mb-6">Conectá tu WhatsApp escaneando el código QR</p>
              <Card className="max-w-md">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <MessageCircle size={22} className="text-green-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Estado de WhatsApp</div>
                    <StatusBadge
                      ok={waStatus.status === "connected"}
                      labelOn="Conectado"
                      labelOff={
                        waStatus.status === "qr_ready" ? "Escaneá el QR"
                        : waStatus.status === "connecting" ? "Conectando..."
                        : "Desconectado"
                      }
                    />
                  </div>
                </div>

                {waStatus.status === "qr_ready" && waStatus.qrDataUrl && (
                  <div className="mb-5 flex flex-col items-center">
                    <p className="text-sm text-gray-600 mb-3 text-center">Abrí WhatsApp en tu celular → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong></p>
                    <div className="p-3 bg-white border-2 border-green-400 rounded-2xl shadow-md">
                      <img src={waStatus.qrDataUrl} alt="QR WhatsApp" className="w-52 h-52" />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">El QR se actualiza automáticamente</p>
                  </div>
                )}

                {waStatus.status === "connected" && (
                  <div className="mb-5 flex items-center gap-2 text-green-600 font-semibold">
                    <Wifi size={20}/> WhatsApp conectado y activo ✓
                  </div>
                )}

                {waStatus.status === "connecting" && (
                  <div className="mb-5 text-sm text-gray-500 flex items-center gap-2">
                    <RefreshCw size={15} className="animate-spin"/> Conectando...
                  </div>
                )}

                <div className="flex gap-3">
                  {waStatus.status !== "connected" && (
                    <Btn onClick={connectWA} variant="success">
                      <Wifi size={15}/> Conectar WhatsApp
                    </Btn>
                  )}
                  {waStatus.status === "connected" && (
                    <Btn onClick={disconnectWA} variant="danger">
                      <WifiOff size={15}/> Desconectar
                    </Btn>
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-4">
                  ⚠️ Si el bot se apaga, vas a tener que volver a escanear el QR.
                </p>
              </Card>
            </div>
          )}

          {/* CHATS */}
          {tab === "chats" && (
            <div className="flex gap-4 h-[calc(100vh-120px)]">
              {/* Chat list */}
              <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-y-auto">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800 text-sm">Conversaciones</h2>
                  <p className="text-xs text-gray-400">{chats.length} chats guardados</p>
                </div>
                {chatsLoading && (
                  <div className="px-4 py-8 text-center text-sm text-gray-400"><RefreshCw size={16} className="animate-spin mx-auto mb-2"/>Cargando...</div>
                )}
                {!chatsLoading && chats.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">Aún no hay chats.<br/>Cuando alguien escriba al bot aparecerán acá.</div>
                )}
                {chats.map(c => (
                  <button
                    key={c.chatId}
                    onClick={() => openChat(c.chatId)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-all ${
                      selectedChat === c.chatId ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-800 truncate">{c.chatId.replace("wa_", "")}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        c.channel === "whatsapp" ? "bg-green-100 text-green-700" : "bg-sky-100 text-sky-700"
                      }`}>{c.channel === "whatsapp" ? "WA" : "TG"}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : ""}
                    </div>
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                {!selectedChat ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                    <div className="text-center">
                      <MessagesSquare size={40} className="mx-auto mb-3 opacity-30" />
                      Seleccioná una conversación para verla
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                      <button onClick={() => { setSelectedChat(null); setChatMessages([]); }} className="text-gray-400 hover:text-gray-600 mr-1">
                        <ChevronLeft size={18}/>
                      </button>
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">{selectedChat.replace("wa_", "")}</div>
                        <div className="text-xs text-gray-400">{chatMessages.length} mensajes</div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                      {chatMessages.map((m, i) => (
                        <div key={i} className={`flex ${ m.role === "user" ? "justify-end" : "justify-start" }`}>
                          <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                            m.role === "user"
                              ? "bg-indigo-600 text-white rounded-br-sm"
                              : "bg-gray-100 text-gray-800 rounded-bl-sm"
                          }`}>
                            {m.text}
                            <div className={`text-xs mt-1 opacity-60 ${ m.role === "user" ? "text-right" : "" }`}>
                              {m.ts ? new Date(m.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* CONFIG */}
          {tab === "config" && config !== null && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
              <p className="text-gray-500 text-sm mb-6">Personalizá el comportamiento del bot</p>

              <div className="max-w-2xl space-y-5">
                <Card>
                  <h2 className="font-semibold text-gray-800 mb-4">Identidad del negocio</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio</label>
                      <input
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={config.businessName || ""}
                        onChange={e => setConfig(c => ({ ...c, businessName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del negocio</label>
                      <textarea
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                        value={config.businessDescription || ""}
                        onChange={e => setConfig(c => ({ ...c, businessDescription: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de bienvenida</label>
                      <textarea
                        rows={3}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                        value={config.welcomeMessage || ""}
                        onChange={e => setConfig(c => ({ ...c, welcomeMessage: e.target.value }))}
                      />
                    </div>
                  </div>
                </Card>

                <Card>
                  <h2 className="font-semibold text-gray-800 mb-1">Personalidad de la IA</h2>
                  <p className="text-xs text-gray-400 mb-3">Acá definís cómo habla, qué puede decir y cómo presenta los productos.</p>
                  <textarea
                    rows={12}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
                    value={config.systemPrompt || ""}
                    onChange={e => setConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                  />
                </Card>

                <Card>
                  <h2 className="font-semibold text-gray-800 mb-1">Claves de API</h2>
                  <p className="text-xs text-gray-400 mb-4">Se guardan en MongoDB, no en el código. Dejá vacío para usar las variables de entorno del servidor.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Groq API Key</label>
                      <input
                        type="password"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="gsk_..."
                        value={config.groqApiKey || ""}
                        onChange={e => setConfig(c => ({ ...c, groqApiKey: e.target.value }))}
                      />
                      <p className="text-xs text-gray-400 mt-1">Obtenala gratis en <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-indigo-500 underline">console.groq.com</a></p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telegram Bot Token</label>
                      <input
                        type="password"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="1234567890:AAH..."
                        value={config.telegramToken || ""}
                        onChange={e => setConfig(c => ({ ...c, telegramToken: e.target.value }))}
                      />
                      <p className="text-xs text-gray-400 mt-1">Obtenelo de <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-indigo-500 underline">@BotFather</a> en Telegram</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">MongoDB URI</label>
                      <input
                        type="password"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="mongodb+srv://..."
                        value={config.mongodbUri || ""}
                        onChange={e => setConfig(c => ({ ...c, mongodbUri: e.target.value }))}
                      />
                    </div>
                  </div>
                </Card>

                <Card>
                  <h2 className="font-semibold text-gray-800 mb-4">Parámetros de productos</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Máx. productos en respuesta</label>
                      <input
                        type="number" min={1} max={20}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={config.maxProductsInResponse || 8}
                        onChange={e => setConfig(c => ({ ...c, maxProductsInResponse: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Máx. productos desde DB</label>
                      <input
                        type="number" min={1} max={50}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={config.maxProductsFromDB || 15}
                        onChange={e => setConfig(c => ({ ...c, maxProductsFromDB: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </Card>

                <div className="flex gap-3">
                  <Btn onClick={saveConfig} disabled={saving}>
                    <Save size={15}/> {saving ? "Guardando..." : "Guardar cambios"}
                  </Btn>
                  <Btn onClick={fetchAll} variant="secondary">
                    <RotateCcw size={15}/> Recargar
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
