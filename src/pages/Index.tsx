import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";

const AUTH_URL = "https://functions.poehali.dev/d14c6eed-44ae-4260-b8bd-12675032087c";
const USERS_URL = "https://functions.poehali.dev/15e02b39-5819-4ccb-80a1-cf88819dc4a1";
const MESSAGES_URL = "https://functions.poehali.dev/3d78cfc1-79cb-4cb5-ad1b-bddfe2d4c8f4";

interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_color: string;
}

interface Contact {
  id: number;
  name: string;
  username: string;
  avatar: string;
  color: string;
  status: string;
  lastMsg: string;
  time: string;
}

interface Group {
  id: number;
  name: string;
  avatar: string;
  members: number;
  lastMsg: string;
  time: string;
  color: string;
}

interface Message {
  id?: number;
  from: string;
  avatar_color?: string;
  text: string;
  time: string;
  self: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  online: "#57f287",
  idle: "#fee75c",
  dnd: "#ed4245",
  offline: "#747f8d",
};

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authScreen, setAuthScreen] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", display_name: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"friends" | "groups">("friends");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [lastMsgId, setLastMsgId] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeCall, setActiveCall] = useState<{ name: string; avatar: string; color: string; isVideo: boolean } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const lastMsgIdRef = useRef<Record<number, number>>({});

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { lastMsgIdRef.current = lastMsgId; }, [lastMsgId]);

  useEffect(() => {
    const savedSession = localStorage.getItem("groza_session");
    const savedUser = localStorage.getItem("groza_user");
    if (savedSession && savedUser) {
      setSessionId(savedSession);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Polling: подгружаем новые сообщения каждые 3 сек
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      const sid = selectedIdRef.current;
      const sess = sessionIdRef.current;
      if (!sid || !sess) return;
      // только для контактов (не групп)
      if (sid >= 2000) return;
      const since = lastMsgIdRef.current[sid] || 0;
      try {
        const res = await fetch(`${MESSAGES_URL}?with=${sid}&since_id=${since}`, {
          headers: { "X-Session-Id": sess },
        });
        if (!res.ok) return;
        const data = await res.json();
        const newMsgs: Message[] = data.messages || [];
        if (newMsgs.length === 0) return;
        setMessages((prev) => {
          const existing = prev[sid] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const fresh = newMsgs.filter((m) => !existingIds.has(m.id));
          if (fresh.length === 0) return prev;
          return { ...prev, [sid]: [...existing, ...fresh] };
        });
        const maxId = Math.max(...newMsgs.map((m) => m.id || 0));
        setLastMsgId((prev) => ({ ...prev, [sid]: Math.max(prev[sid] || 0, maxId) }));
      } catch (_e) { /* игнорируем сетевые ошибки polling */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedId]);

  const authFetch = async (action: string, body: Record<string, string>) => {
    return fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
  };

  const handleRegister = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await authFetch("register", authForm);
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Ошибка"); return; }
      localStorage.setItem("groza_session", data.session_id);
      localStorage.setItem("groza_user", JSON.stringify(data.user));
      setSessionId(data.session_id);
      setUser(data.user);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await authFetch("login", { username: authForm.username, password: authForm.password });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Ошибка"); return; }
      localStorage.setItem("groza_session", data.session_id);
      localStorage.setItem("groza_user", JSON.stringify(data.user));
      setSessionId(data.session_id);
      setUser(data.user);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (sessionId) {
      await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
        body: JSON.stringify({ action: "logout" }),
      });
    }
    localStorage.removeItem("groza_session");
    localStorage.removeItem("groza_user");
    setUser(null);
    setSessionId(null);
    setContacts([]);
    setGroups([]);
    setSelectedId(null);
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`${USERS_URL}?q=${encodeURIComponent(q)}`, {
        headers: sessionId ? { "X-Session-Id": sessionId } : {},
      });
      const data = await res.json();
      setSearchResults(data.users || []);
    } finally {
      setSearchLoading(false);
    }
  };

  const addContact = (u: User) => {
    if (contacts.find((c) => c.id === u.id)) return;
    setContacts((prev) => [{
      id: u.id, name: u.display_name, username: u.username,
      avatar: u.display_name[0].toUpperCase(), color: u.avatar_color,
      status: "online", lastMsg: "Нажмите, чтобы написать", time: "сейчас",
    }, ...prev]);
    setSelectedId(u.id);
    setActiveTab("friends");
    setShowSearch(false);
    setSearchResults([]);
    setMobileView("chat");
  };

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    const g: Group = {
      id: Date.now(), name: newGroupName,
      avatar: newGroupName[0].toUpperCase(), members: 1,
      lastMsg: "Группа создана", time: "сейчас", color: "#5865f2",
    };
    setGroups((prev) => [g, ...prev]);
    setNewGroupName("");
    setShowNewGroup(false);
    setActiveTab("groups");
    setSelectedId(g.id);
    setMobileView("chat");
  };

  const loadMessages = async (contactId: number, sess: string) => {
    try {
      const since = lastMsgIdRef.current[contactId] || 0;
      const res = await fetch(`${MESSAGES_URL}?with=${contactId}&since_id=${since}`, {
        headers: { "X-Session-Id": sess },
      });
      if (!res.ok) return;
      const data = await res.json();
      const newMsgs: Message[] = data.messages || [];
      if (newMsgs.length === 0) return;
      setMessages((prev) => {
        const existing = prev[contactId] || [];
        const existingIds = new Set(existing.map((m) => m.id));
        const fresh = newMsgs.filter((m) => !existingIds.has(m.id));
        if (fresh.length === 0) return prev;
        return { ...prev, [contactId]: [...existing, ...fresh] };
      });
      const maxId = Math.max(...newMsgs.map((m) => m.id || 0));
      setLastMsgId((prev) => ({ ...prev, [contactId]: Math.max(prev[contactId] || 0, maxId) }));
    } catch (_e) { /* игнор */ }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedId || !sessionId || sending) return;
    // группы — локально (пока)
    if (selectedId >= 2000) {
      setMessages((prev) => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] || []), {
          from: user?.display_name || "Я",
          text: message,
          time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          self: true,
        }],
      }));
      setMessage("");
      return;
    }
    const text = message;
    setMessage("");
    setSending(true);
    try {
      const res = await fetch(MESSAGES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
        body: JSON.stringify({ receiver_id: selectedId, text }),
      });
      if (!res.ok) { setMessage(text); return; }
      const data = await res.json();
      const msg: Message = data.message;
      setMessages((prev) => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] || []), msg],
      }));
      setLastMsgId((prev) => ({ ...prev, [selectedId]: Math.max(prev[selectedId] || 0, msg.id || 0) }));
      // обновить lastMsg в контакте
      setContacts((prev) => prev.map((c) =>
        c.id === selectedId ? { ...c, lastMsg: text, time: msg.time } : c
      ));
    } finally {
      setSending(false);
    }
  };

  const openChat = (id: number) => {
    setSelectedId(id);
    setMobileView("chat");
    // загрузить историю при открытии (только для реальных контактов)
    if (id < 2000 && sessionId) {
      loadMessages(id, sessionId);
    }
  };

  const allChats = activeTab === "friends" ? contacts : groups;
  const filteredChats = allChats.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selected = [...contacts, ...groups].find((c) => c.id === selectedId);

  // ── ЭКРАН АВТОРИЗАЦИИ ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1c20] via-[#23272a] to-[#1e2025] flex items-center justify-center p-4">
        {/* Декоративные блюры */}
        <div className="fixed top-[-100px] left-[-100px] w-80 h-80 bg-[#5865f2]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-[-80px] right-[-80px] w-72 h-72 bg-[#eb459e]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Лого */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#5865f2] to-[#4752c4] rounded-2xl flex items-center justify-center shadow-lg shadow-[#5865f2]/30 mb-3">
              <Icon name="Zap" size={28} className="text-white" />
            </div>
            <h1 className="text-white text-3xl font-black tracking-tight">Гроза</h1>
            <p className="text-[#8e9297] text-sm mt-1">Мессенджер нового поколения</p>
          </div>

          {/* Карточка */}
          <div className="bg-[#2b2d31]/90 backdrop-blur-sm rounded-2xl p-7 shadow-2xl border border-white/5">
            <h2 className="text-white text-xl font-bold mb-0.5">
              {authScreen === "login" ? "С возвращением! 👋" : "Создай аккаунт"}
            </h2>
            <p className="text-[#8e9297] text-sm mb-6">
              {authScreen === "login" ? "Войди в свой аккаунт Грозы" : "Присоединяйся к Грозе бесплатно"}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">
                  Юзернейм
                </label>
                <div className="relative">
                  <Icon name="AtSign" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                  <Input
                    value={authForm.username}
                    onChange={(e) => setAuthForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                    placeholder="your_username"
                    className="bg-[#1e1f22] border border-white/10 text-white placeholder:text-[#4e5058] pl-9 h-11 rounded-xl focus:border-[#5865f2] transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && (authScreen === "login" ? handleLogin() : null)}
                  />
                </div>
              </div>

              {authScreen === "register" && (
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">
                    Отображаемое имя
                  </label>
                  <div className="relative">
                    <Icon name="User" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                    <Input
                      value={authForm.display_name}
                      onChange={(e) => setAuthForm((f) => ({ ...f, display_name: e.target.value }))}
                      placeholder="Иван Петров"
                      className="bg-[#1e1f22] border border-white/10 text-white placeholder:text-[#4e5058] pl-9 h-11 rounded-xl focus:border-[#5865f2] transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">
                  Пароль
                </label>
                <div className="relative">
                  <Icon name="Lock" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                  <Input
                    type="password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="bg-[#1e1f22] border border-white/10 text-white placeholder:text-[#4e5058] pl-9 h-11 rounded-xl focus:border-[#5865f2] transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && (authScreen === "login" ? handleLogin() : handleRegister())}
                  />
                </div>
              </div>

              {authError && (
                <div className="flex items-center gap-2 bg-[#ed4245]/15 border border-[#ed4245]/30 rounded-xl px-3 py-2.5 text-[#ed4245] text-sm">
                  <Icon name="AlertCircle" size={15} className="shrink-0" />
                  {authError}
                </div>
              )}

              <Button
                onClick={authScreen === "login" ? handleLogin : handleRegister}
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-[#5865f2] to-[#4752c4] hover:from-[#4752c4] hover:to-[#3c45a5] text-white font-bold h-11 rounded-xl text-base shadow-lg shadow-[#5865f2]/20 transition-all"
              >
                {authLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Загрузка...
                  </span>
                ) : authScreen === "login" ? "Войти" : "Создать аккаунт"}
              </Button>
            </div>

            <div className="mt-5 pt-5 border-t border-white/5 text-center">
              <span className="text-[#8e9297] text-sm">
                {authScreen === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
              </span>
              <button
                onClick={() => { setAuthScreen(authScreen === "login" ? "register" : "login"); setAuthError(""); setAuthForm({ username: "", display_name: "", password: "" }); }}
                className="text-[#5865f2] hover:text-[#4752c4] text-sm font-semibold transition-colors"
              >
                {authScreen === "login" ? "Зарегистрироваться" : "Войти"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ГЛАВНЫЙ ЭКРАН ──────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-[#313338] text-white flex flex-col overflow-hidden">

      {/* Мобильная навигация — только когда в списке */}
      {mobileView === "list" && (
        <div className="md:hidden bg-[#1e1f22] px-4 pt-safe-top pb-3 flex items-center gap-3 border-b border-black/20">
          <div className="w-8 h-8 bg-gradient-to-br from-[#5865f2] to-[#4752c4] rounded-xl flex items-center justify-center">
            <Icon name="Zap" size={15} className="text-white" />
          </div>
          <span className="font-black text-white text-lg tracking-tight flex-1">Гроза</span>
          <button onClick={() => setShowSearch(true)} className="w-9 h-9 bg-[#2b2d31] rounded-xl flex items-center justify-center text-[#b9bbbe] hover:text-white transition-colors">
            <Icon name="UserPlus" size={17} />
          </button>
          <button onClick={() => setShowNewGroup(true)} className="w-9 h-9 bg-[#5865f2] rounded-xl flex items-center justify-center text-white">
            <Icon name="Users" size={17} />
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── БОКОВАЯ ПАНЕЛЬ ── */}
        <div className={`
          ${mobileView === "list" ? "flex" : "hidden"} md:flex
          w-full md:w-72 lg:w-80 bg-[#2b2d31] flex-col shrink-0
        `}>
          {/* Шапка — только десктоп */}
          <div className="hidden md:flex items-center gap-3 px-4 py-4 border-b border-black/20">
            <div className="w-9 h-9 bg-gradient-to-br from-[#5865f2] to-[#4752c4] rounded-xl flex items-center justify-center shrink-0">
              <Icon name="Zap" size={16} className="text-white" />
            </div>
            <span className="font-black text-white text-xl tracking-tight flex-1">Гроза</span>
            <button onClick={() => setShowSearch(true)} title="Найти людей" className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#5865f2] transition-all">
              <Icon name="UserPlus" size={15} />
            </button>
            <button onClick={() => setShowNewGroup(true)} title="Создать группу" className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#5865f2] transition-all">
              <Icon name="Plus" size={15} />
            </button>
          </div>

          {/* Поиск по чатам */}
          <div className="px-3 py-3">
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск..."
                className="w-full bg-[#1e1f22] text-[#dcddde] placeholder:text-[#4e5058] pl-9 pr-3 h-9 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2]/50 transition-colors"
              />
            </div>
          </div>

          {/* Табы */}
          <div className="flex gap-1 px-3 pb-3">
            <button
              onClick={() => setActiveTab("friends")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "friends" ? "bg-[#5865f2] text-white shadow-md shadow-[#5865f2]/20" : "text-[#8e9297] hover:bg-[#383a40] hover:text-[#dcddde]"}`}
            >
              <Icon name="MessageCircle" size={13} className="inline mr-1.5" />
              Чаты
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "groups" ? "bg-[#5865f2] text-white shadow-md shadow-[#5865f2]/20" : "text-[#8e9297] hover:bg-[#383a40] hover:text-[#dcddde]"}`}
            >
              <Icon name="Users" size={13} className="inline mr-1.5" />
              Группы
            </button>
          </div>

          {/* Список чатов */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
            {filteredChats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-14 h-14 bg-[#1e1f22] rounded-2xl flex items-center justify-center mb-3">
                  <Icon name={activeTab === "friends" ? "MessageCircle" : "Users"} size={24} className="text-[#5865f2]" />
                </div>
                <p className="text-[#8e9297] text-sm font-medium">
                  {activeTab === "friends" ? "Нет чатов" : "Нет групп"}
                </p>
                <p className="text-[#4e5058] text-xs mt-1">
                  {activeTab === "friends" ? "Найди людей по кнопке +" : "Создай первую группу"}
                </p>
              </div>
            )}
            {filteredChats.map((c) => (
              <button
                key={c.id}
                onClick={() => openChat(c.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${selectedId === c.id ? "bg-[#404249]" : "hover:bg-[#35373c]"}`}
              >
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm" style={{ backgroundColor: c.color }}>
                    {c.avatar}
                  </div>
                  {"status" in c && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#2b2d31]" style={{ backgroundColor: STATUS_COLOR[(c as Contact).status] }} />
                  )}
                  {"members" in c && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#5865f2] border-2 border-[#2b2d31] flex items-center justify-center">
                      <Icon name="Users" size={8} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[#f2f3f5] text-sm font-semibold truncate">{c.name}</span>
                    <span className="text-[#5c5f66] text-xs shrink-0">{c.time}</span>
                  </div>
                  <div className="text-[#8e9297] text-xs truncate mt-0.5">
                    {"username" in c ? `@${(c as Contact).username}` : c.lastMsg}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Профиль пользователя */}
          <div className="px-3 py-3 border-t border-black/20 bg-[#232428]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm" style={{ backgroundColor: user.avatar_color }}>
                  {user.display_name[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#57f287] border-2 border-[#232428]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold truncate">{user.display_name}</div>
                <div className="text-[#8e9297] text-xs truncate">@{user.username}</div>
              </div>
              <button onClick={handleLogout} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8e9297] hover:text-[#ed4245] hover:bg-[#ed4245]/10 transition-all">
                <Icon name="LogOut" size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── ОБЛАСТЬ ЧАТА ── */}
        <div className={`
          ${mobileView === "chat" ? "flex" : "hidden"} md:flex
          flex-1 flex-col overflow-hidden bg-[#313338]
        `}>
          {selected ? (
            <>
              {/* Заголовок чата */}
              <div className="h-14 bg-[#313338] border-b border-black/20 flex items-center px-4 gap-3 shrink-0">
                <button
                  onClick={() => setMobileView("list")}
                  className="md:hidden w-8 h-8 flex items-center justify-center text-[#8e9297] hover:text-white transition-colors mr-1"
                >
                  <Icon name="ArrowLeft" size={20} />
                </button>
                <div className="relative">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: selected.color }}>
                    {selected.avatar}
                  </div>
                  {"status" in selected && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#313338]" style={{ backgroundColor: STATUS_COLOR[(selected as Contact).status] }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">{selected.name}</div>
                  {"username" in selected
                    ? <div className="text-[#8e9297] text-xs">@{(selected as Contact).username}</div>
                    : <div className="text-[#8e9297] text-xs">{(selected as Group).members} участников</div>
                  }
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setActiveCall({ name: selected.name, avatar: selected.avatar, color: selected.color, isVideo: false })} className="w-9 h-9 rounded-xl flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#404249] transition-all">
                    <Icon name="Phone" size={17} />
                  </button>
                  <button onClick={() => setActiveCall({ name: selected.name, avatar: selected.avatar, color: selected.color, isVideo: true })} className="w-9 h-9 rounded-xl flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#404249] transition-all">
                    <Icon name="Video" size={17} />
                  </button>
                </div>
              </div>

              {/* Активный звонок */}
              {activeCall && (
                <div className="bg-[#232428] border-b border-black/20 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-[#57f287] animate-pulse shrink-0" />
                    <span className="text-[#57f287] text-sm font-semibold truncate">
                      {activeCall.isVideo ? "Видеозвонок" : "Аудиозвонок"} · {activeCall.name}
                    </span>
                  </div>
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isMuted ? "bg-[#ed4245]/20 text-[#ed4245]" : "text-[#b9bbbe] hover:bg-[#404249] hover:text-white"}`}>
                    <Icon name={isMuted ? "MicOff" : "Mic"} size={15} />
                  </button>
                  <button onClick={() => setActiveCall(null)} className="flex items-center gap-1.5 bg-[#ed4245] hover:bg-[#c03537] text-white rounded-lg px-3 h-8 text-xs font-bold transition-colors">
                    <Icon name="PhoneOff" size={13} />
                    Завершить
                  </button>
                </div>
              )}

              {/* Сообщения */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {(messages[selectedId!] || []).length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl mb-4 shadow-lg" style={{ backgroundColor: selected.color }}>
                      {selected.avatar}
                    </div>
                    <p className="text-white font-bold text-xl">{selected.name}</p>
                    {"username" in selected && <p className="text-[#8e9297] text-sm mt-1">@{(selected as Contact).username}</p>}
                    <p className="text-[#5c5f66] text-sm mt-3">Начни переписку — напиши первое сообщение!</p>
                  </div>
                )}
                {(messages[selectedId!] || []).map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.self ? "flex-row-reverse" : ""}`}>
                    {!msg.self && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 mt-1" style={{ backgroundColor: selected.color }}>
                        {selected.avatar}
                      </div>
                    )}
                    <div className={`max-w-[75%] flex flex-col ${msg.self ? "items-end" : "items-start"}`}>
                      {!msg.self && <span className="text-[#00b0f4] text-xs font-bold mb-1 ml-1">{msg.from}</span>}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.self ? "bg-[#5865f2] text-white rounded-tr-md" : "bg-[#383a40] text-[#f2f3f5] rounded-tl-md"}`}>
                        {msg.text}
                      </div>
                      <span className="text-[#5c5f66] text-xs mt-1 mx-1">{msg.time}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Поле ввода */}
              <div className="px-4 pb-4 pt-2 bg-[#313338]">
                <div className="flex items-center gap-2 bg-[#383a40] rounded-xl px-3 py-2.5 border border-transparent focus-within:border-[#5865f2]/30 transition-colors">
                  <input
                    className="flex-1 bg-transparent text-[#f2f3f5] placeholder:text-[#5c5f66] text-sm outline-none"
                    placeholder={`Написать ${selected.name}...`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim() || sending}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${message.trim() && !sending ? "bg-[#5865f2] hover:bg-[#4752c4] text-white" : "bg-[#2e3035] text-[#4e5058]"}`}
                  >
                    {sending
                      ? <div className="w-3.5 h-3.5 border-2 border-[#4e5058] border-t-white rounded-full animate-spin" />
                      : <Icon name="Send" size={14} />
                    }
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Заглушка — нет выбранного чата (только десктоп) */
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center px-8">
              <div className="w-24 h-24 bg-gradient-to-br from-[#5865f2]/20 to-[#eb459e]/20 rounded-3xl flex items-center justify-center mb-5">
                <Icon name="Zap" size={42} className="text-[#5865f2]" />
              </div>
              <h2 className="text-white text-2xl font-black mb-2">Привет, {user.display_name}!</h2>
              <p className="text-[#8e9297] text-sm max-w-xs">Выбери чат слева или найди новых людей, нажав на иконку <span className="text-[#5865f2] font-semibold">UserPlus</span> вверху</p>
            </div>
          )}
        </div>
      </div>

      {/* ── МОДАЛКА ПОИСКА ЛЮДЕЙ ── */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#2b2d31] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
            {/* Ручка для свайпа — мобильная */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#4e5058] rounded-full" />
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-bold">Найти людей</h2>
                <button onClick={() => { setShowSearch(false); setSearchResults([]); }} className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#8e9297] hover:text-white transition-colors">
                  <Icon name="X" size={15} />
                </button>
              </div>
              <div className="relative mb-4">
                <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                <input
                  autoFocus
                  placeholder="Поиск по юзернейму или имени..."
                  className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] pl-10 pr-4 h-11 rounded-xl text-sm outline-none border border-transparent focus:border-[#5865f2]/50 transition-colors"
                  onChange={(e) => searchUsers(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {searchLoading && (
                  <div className="flex items-center justify-center py-8 gap-2 text-[#8e9297] text-sm">
                    <div className="w-4 h-4 border-2 border-[#8e9297]/30 border-t-[#8e9297] rounded-full animate-spin" />
                    Поиск...
                  </div>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <div className="text-center py-8">
                    <Icon name="Search" size={28} className="text-[#4e5058] mx-auto mb-2" />
                    <p className="text-[#8e9297] text-sm">Введите юзернейм для поиска</p>
                  </div>
                )}
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1e1f22] hover:bg-[#383a40] transition-colors">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm" style={{ backgroundColor: u.avatar_color }}>
                      {u.display_name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold text-sm">{u.display_name}</div>
                      <div className="text-[#8e9297] text-xs">@{u.username}</div>
                    </div>
                    {u.is_me ? (
                      <span className="text-[#4e5058] text-xs bg-[#2b2d31] px-2 py-1 rounded-lg">Вы</span>
                    ) : (
                      <button onClick={() => addContact(u)} className="bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl px-4 h-9 text-xs font-bold transition-colors shadow-sm">
                        Написать
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── МОДАЛКА СОЗДАНИЯ ГРУППЫ ── */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#2b2d31] w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/5">
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#4e5058] rounded-full" />
            </div>
            <div className="p-5">
              <h2 className="text-white text-lg font-bold mb-1">Создать группу</h2>
              <p className="text-[#8e9297] text-sm mb-4">Введите название для вашей группы</p>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Название группы..."
                className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] px-4 h-11 rounded-xl text-sm outline-none border border-transparent focus:border-[#5865f2]/50 transition-colors mb-4"
                onKeyDown={(e) => e.key === "Enter" && createGroup()}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => setShowNewGroup(false)} className="flex-1 h-10 rounded-xl bg-[#1e1f22] text-[#8e9297] hover:text-white hover:bg-[#383a40] text-sm font-semibold transition-colors">
                  Отмена
                </button>
                <button onClick={createGroup} disabled={!newGroupName.trim()} className="flex-1 h-10 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white text-sm font-bold transition-colors">
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}