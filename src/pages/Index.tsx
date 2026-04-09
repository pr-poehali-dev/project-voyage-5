import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";

const AUTH_URL = "https://functions.poehali.dev/d14c6eed-44ae-4260-b8bd-12675032087c";
const USERS_URL = "https://functions.poehali.dev/15e02b39-5819-4ccb-80a1-cf88819dc4a1";

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
  from: string;
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

const DEMO_CONTACTS: Contact[] = [
  { id: 1001, name: "Мария Иванова", username: "maria", avatar: "М", color: "#5865f2", status: "online", lastMsg: "Привет!", time: "сейчас" },
  { id: 1002, name: "Дмитрий Волков", username: "dmitry", avatar: "Д", color: "#eb459e", status: "idle", lastMsg: "Ок!", time: "5 мин" },
];

const DEMO_GROUPS: Group[] = [
  { id: 2001, name: "Команда", avatar: "К", members: 5, lastMsg: "Встреча в 15:00", time: "10 мин", color: "#5865f2" },
];

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authScreen, setAuthScreen] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", display_name: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"friends" | "groups">("friends");
  const [contacts, setContacts] = useState<Contact[]>(DEMO_CONTACTS);
  const [groups, setGroups] = useState<Group[]>(DEMO_GROUPS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [message, setMessage] = useState("");
  const [activeCall, setActiveCall] = useState<{ name: string; avatar: string; color: string; isVideo: boolean } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem("groza_session");
    const savedUser = localStorage.getItem("groza_user");
    if (savedSession && savedUser) {
      setSessionId(savedSession);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const authFetch = async (action: string, body: Record<string, string>) => {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    return res;
  };

  const handleRegister = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await authFetch("register", {
        username: authForm.username,
        display_name: authForm.display_name,
        password: authForm.password,
      });
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
      const res = await authFetch("login", {
        username: authForm.username,
        password: authForm.password,
      });
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
    const newContact: Contact = {
      id: u.id,
      name: u.display_name,
      username: u.username,
      avatar: u.display_name[0].toUpperCase(),
      color: u.avatar_color,
      status: "online",
      lastMsg: "Добавлен в контакты",
      time: "сейчас",
    };
    setContacts((prev) => [newContact, ...prev]);
    setSelectedId(u.id);
    setShowSearch(false);
    setSearchResults([]);
    setActiveTab("friends");
  };

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    const g: Group = {
      id: Date.now(),
      name: newGroupName,
      avatar: newGroupName[0].toUpperCase(),
      members: 1,
      lastMsg: "Группа создана",
      time: "сейчас",
      color: "#5865f2",
    };
    setGroups((prev) => [g, ...prev]);
    setNewGroupName("");
    setShowNewGroup(false);
    setActiveTab("groups");
    setSelectedId(g.id);
  };

  const sendMessage = () => {
    if (!message.trim() || !selectedId) return;
    const msg: Message = {
      from: user?.display_name || "Я",
      text: message,
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      self: true,
    };
    setMessages((prev) => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), msg] }));
    setMessage("");
  };

  const allChats = activeTab === "friends" ? contacts : groups;
  const filteredChats = allChats.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selected = [...contacts, ...groups].find((c) => c.id === selectedId);

  // Экран авторизации
  if (!user) {
    return (
      <div className="h-screen bg-[#36393f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-[#5865f2] rounded-full flex items-center justify-center">
              <Icon name="Zap" size={22} className="text-white" />
            </div>
            <span className="text-white text-3xl font-bold">Гроза</span>
          </div>

          <div className="bg-[#2f3136] rounded-xl p-8 shadow-2xl">
            <h2 className="text-white text-2xl font-bold mb-1 text-center">
              {authScreen === "login" ? "С возвращением!" : "Создать аккаунт"}
            </h2>
            <p className="text-[#8e9297] text-sm text-center mb-6">
              {authScreen === "login" ? "Рады снова видеть тебя" : "Присоединяйся к Грозе"}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[#b9bbbe] text-xs font-bold uppercase mb-1.5 block">Юзернейм</label>
                <Input
                  value={authForm.username}
                  onChange={(e) => setAuthForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="example_user"
                  className="bg-[#202225] border-none text-white placeholder:text-[#8e9297]"
                  onKeyDown={(e) => e.key === "Enter" && (authScreen === "login" ? handleLogin() : handleRegister())}
                />
              </div>

              {authScreen === "register" && (
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase mb-1.5 block">Отображаемое имя</label>
                  <Input
                    value={authForm.display_name}
                    onChange={(e) => setAuthForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="Иван Петров"
                    className="bg-[#202225] border-none text-white placeholder:text-[#8e9297]"
                  />
                </div>
              )}

              <div>
                <label className="text-[#b9bbbe] text-xs font-bold uppercase mb-1.5 block">Пароль</label>
                <Input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="bg-[#202225] border-none text-white placeholder:text-[#8e9297]"
                  onKeyDown={(e) => e.key === "Enter" && (authScreen === "login" ? handleLogin() : handleRegister())}
                />
              </div>

              {authError && (
                <div className="bg-[#ed4245]/20 border border-[#ed4245]/40 rounded px-3 py-2 text-[#ed4245] text-sm">
                  {authError}
                </div>
              )}

              <Button
                onClick={authScreen === "login" ? handleLogin : handleRegister}
                disabled={authLoading}
                className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold h-10"
              >
                {authLoading ? "Загрузка..." : authScreen === "login" ? "Войти" : "Зарегистрироваться"}
              </Button>
            </div>

            <p className="text-[#8e9297] text-sm mt-4 text-center">
              {authScreen === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
              <button
                onClick={() => { setAuthScreen(authScreen === "login" ? "register" : "login"); setAuthError(""); }}
                className="text-[#00b0f4] hover:underline"
              >
                {authScreen === "login" ? "Создать" : "Войти"}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#36393f] text-white flex flex-col overflow-hidden">
      {/* Верхняя панель */}
      <div className="h-12 bg-[#202225] flex items-center px-4 gap-3 shrink-0 border-b border-black/30">
        <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center shrink-0">
          <Icon name="Zap" size={16} className="text-white" />
        </div>
        <span className="font-bold text-white text-base hidden sm:block">Гроза</span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowSearch(true)}
          className="text-[#b9bbbe] hover:text-white hover:bg-[#40444b] text-xs px-3 h-7"
        >
          <Icon name="UserPlus" size={14} className="mr-1" />
          <span className="hidden sm:inline">Найти людей</span>
        </Button>
        <Button
          size="sm"
          className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs px-3 h-7"
          onClick={() => setShowNewGroup(true)}
        >
          <Icon name="Plus" size={14} className="mr-1" />
          <span className="hidden sm:inline">Группа</span>
        </Button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer font-bold text-sm text-white"
          style={{ backgroundColor: user.avatar_color }}
          title={`@${user.username}`}
        >
          {user.display_name[0].toUpperCase()}
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#8e9297] hover:text-[#ed4245] p-1.5">
          <Icon name="LogOut" size={15} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="sm:hidden text-[#b9bbbe] p-1"
          onClick={() => setMobileSidebar(!mobileSidebar)}
        >
          <Icon name="Menu" size={18} />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель */}
        <div className={`${mobileSidebar ? "flex" : "hidden"} sm:flex w-full sm:w-72 bg-[#2f3136] flex-col shrink-0`}>
          <div className="p-3">
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e9297]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск в чатах..."
                className="bg-[#202225] border-none text-[#dcddde] placeholder:text-[#8e9297] pl-8 h-7 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-1 px-3 pb-2">
            <button
              onClick={() => setActiveTab("friends")}
              className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${activeTab === "friends" ? "bg-[#5865f2] text-white" : "text-[#8e9297] hover:bg-[#393c43] hover:text-[#dcddde]"}`}
            >
              <Icon name="User" size={12} className="inline mr-1" />
              Друзья
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${activeTab === "groups" ? "bg-[#5865f2] text-white" : "text-[#8e9297] hover:bg-[#393c43] hover:text-[#dcddde]"}`}
            >
              <Icon name="Users" size={12} className="inline mr-1" />
              Группы
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {filteredChats.map((c) => (
              <div
                key={c.id}
                onClick={() => { setSelectedId(c.id); setMobileSidebar(false); }}
                className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-colors ${selectedId === c.id ? "bg-[#393c43]" : "hover:bg-[#34373c]"}`}
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: c.color }}>
                    {c.avatar}
                  </div>
                  {"status" in c && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2f3136]" style={{ backgroundColor: STATUS_COLOR[(c as Contact).status] }} />
                  )}
                  {"members" in c && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#5865f2] border-2 border-[#2f3136] flex items-center justify-center">
                      <Icon name="Users" size={7} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[#dcddde] text-sm font-medium truncate">{c.name}</span>
                    <span className="text-[#8e9297] text-xs ml-1 shrink-0">{c.time}</span>
                  </div>
                  {"username" in c && <div className="text-[#8e9297] text-xs">@{(c as Contact).username}</div>}
                  {"members" in c && <div className="text-[#8e9297] text-xs">{c.lastMsg}</div>}
                </div>
              </div>
            ))}
            {filteredChats.length === 0 && (
              <div className="text-[#8e9297] text-xs text-center py-8 px-4">
                {activeTab === "friends" ? "Нет контактов. Найди людей по кнопке выше!" : "Нет групп. Создай первую!"}
              </div>
            )}
          </div>

          <div className="p-2 bg-[#292b2f] flex items-center gap-2 border-t border-black/20">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0" style={{ backgroundColor: user.avatar_color }}>
              {user.display_name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{user.display_name}</div>
              <div className="text-[#8e9297] text-xs truncate">@{user.username}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-7 h-7 p-0 text-[#8e9297] hover:text-[#ed4245] hover:bg-[#40444b]">
              <Icon name="LogOut" size={13} />
            </Button>
          </div>
        </div>

        {/* Правая часть — чат */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="h-12 bg-[#36393f] border-b border-[#202225] flex items-center px-4 gap-3 shrink-0">
                <Button variant="ghost" size="sm" className="sm:hidden text-[#8e9297] p-1 mr-1" onClick={() => setMobileSidebar(true)}>
                  <Icon name="ArrowLeft" size={16} />
                </Button>
                <div className="relative">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: selected.color }}>
                    {selected.avatar}
                  </div>
                  {"status" in selected && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#36393f]" style={{ backgroundColor: STATUS_COLOR[(selected as Contact).status] }} />
                  )}
                </div>
                <div>
                  <span className="text-white font-semibold text-sm">{selected.name}</span>
                  {"username" in selected && <div className="text-[#8e9297] text-xs">@{(selected as Contact).username}</div>}
                  {"members" in selected && <div className="text-[#8e9297] text-xs">{(selected as Group).members} участников</div>}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setActiveCall({ name: selected.name, avatar: selected.avatar, color: selected.color, isVideo: false })} className="text-[#b9bbbe] hover:text-white hover:bg-[#40444b] p-2">
                    <Icon name="Phone" size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setActiveCall({ name: selected.name, avatar: selected.avatar, color: selected.color, isVideo: true })} className="text-[#b9bbbe] hover:text-white hover:bg-[#40444b] p-2">
                    <Icon name="Video" size={16} />
                  </Button>
                </div>
              </div>

              {activeCall && (
                <div className="bg-[#1e2124] border-b border-[#202225] px-4 py-2 flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-[#57f287] animate-pulse" />
                    <span className="text-[#57f287] text-sm font-semibold">{activeCall.isVideo ? "Видеозвонок" : "Аудиозвонок"} · {activeCall.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setIsMuted(!isMuted)} className={`p-2 ${isMuted ? "text-[#ed4245] bg-[#ed4245]/20" : "text-[#b9bbbe] hover:text-white hover:bg-[#40444b]"}`}>
                    <Icon name={isMuted ? "MicOff" : "Mic"} size={14} />
                  </Button>
                  <Button size="sm" onClick={() => setActiveCall(null)} className="bg-[#ed4245] hover:bg-[#c03537] text-white h-7 px-3 text-xs">
                    <Icon name="PhoneOff" size={13} className="mr-1" />
                    Завершить
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(messages[selectedId!] || []).length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-3" style={{ backgroundColor: selected.color }}>
                      {selected.avatar}
                    </div>
                    <p className="text-white font-bold text-lg">{selected.name}</p>
                    {"username" in selected && <p className="text-[#8e9297] text-sm">@{(selected as Contact).username}</p>}
                    <p className="text-[#8e9297] text-sm mt-2">Напишите первое сообщение!</p>
                  </div>
                )}
                {(messages[selectedId!] || []).map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.self ? "flex-row-reverse" : ""}`}>
                    {!msg.self && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5" style={{ backgroundColor: selected.color }}>
                        {selected.avatar}
                      </div>
                    )}
                    <div className={`max-w-[70%] flex flex-col ${msg.self ? "items-end" : "items-start"}`}>
                      {!msg.self && <span className="text-[#00b0f4] text-xs font-semibold mb-1">{msg.from}</span>}
                      <div className={`px-3 py-2 rounded-2xl text-sm ${msg.self ? "bg-[#5865f2] text-white rounded-tr-sm" : "bg-[#2f3136] text-[#dcddde] rounded-tl-sm"}`}>
                        {msg.text}
                      </div>
                      <span className="text-[#72767d] text-xs mt-1">{msg.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-[#36393f]">
                <div className="flex items-center gap-2 bg-[#40444b] rounded-lg px-3 py-2">
                  <input
                    className="flex-1 bg-transparent text-[#dcddde] placeholder:text-[#8e9297] text-sm outline-none"
                    placeholder={`Написать ${selected.name}...`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <Button variant="ghost" size="sm" className="text-[#b9bbbe] hover:text-white p-1 h-auto">
                    <Icon name="Smile" size={16} />
                  </Button>
                  <Button size="sm" onClick={sendMessage} disabled={!message.trim()} className="bg-[#5865f2] hover:bg-[#4752c4] text-white h-7 w-7 p-0 rounded">
                    <Icon name="Send" size={13} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-20 h-20 bg-[#5865f2]/20 rounded-full flex items-center justify-center mb-4">
                <Icon name="Zap" size={36} className="text-[#5865f2]" />
              </div>
              <h2 className="text-white text-xl font-bold mb-2">Привет, {user.display_name}!</h2>
              <p className="text-[#8e9297] text-sm">Выберите чат слева или найдите людей по кнопке «Найти людей»</p>
            </div>
          )}
        </div>
      </div>

      {/* Модалка поиска людей */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#36393f] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-bold">Найти людей</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowSearch(false); setSearchResults([]); }} className="text-[#8e9297] hover:text-white p-1">
                <Icon name="X" size={16} />
              </Button>
            </div>
            <div className="relative mb-4">
              <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e9297]" />
              <Input
                autoFocus
                placeholder="Поиск по юзернейму или имени..."
                className="bg-[#40444b] border-none text-white placeholder:text-[#8e9297] pl-8"
                onChange={(e) => searchUsers(e.target.value)}
              />
            </div>
            {searchLoading && <div className="text-[#8e9297] text-sm text-center py-4">Поиск...</div>}
            {!searchLoading && searchResults.length === 0 && (
              <div className="text-[#8e9297] text-sm text-center py-4">Введите юзернейм для поиска</div>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#2f3136] hover:bg-[#393c43] transition-colors">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: u.avatar_color }}>
                    {u.display_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium">{u.display_name}</div>
                    <div className="text-[#8e9297] text-sm">@{u.username}</div>
                  </div>
                  {u.is_me ? (
                    <span className="text-[#8e9297] text-xs">Это вы</span>
                  ) : (
                    <Button size="sm" onClick={() => addContact(u)} className="bg-[#5865f2] hover:bg-[#4752c4] text-white h-7 px-3 text-xs">
                      Написать
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Модалка создания группы */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#36393f] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-white text-lg font-bold mb-1">Создать группу</h2>
            <p className="text-[#8e9297] text-sm mb-4">Введите название группы</p>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Название группы..."
              className="bg-[#40444b] border-none text-white placeholder:text-[#8e9297] mb-4"
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowNewGroup(false)} className="flex-1 text-[#b9bbbe] hover:text-white hover:bg-[#40444b]">Отмена</Button>
              <Button onClick={createGroup} disabled={!newGroupName.trim()} className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white">Создать</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
