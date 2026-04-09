import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";

const AUTH_URL = "https://functions.poehali.dev/d14c6eed-44ae-4260-b8bd-12675032087c";
const USERS_URL = "https://functions.poehali.dev/15e02b39-5819-4ccb-80a1-cf88819dc4a1";
const MESSAGES_URL = "https://functions.poehali.dev/3d78cfc1-79cb-4cb5-ad1b-bddfe2d4c8f4";
const CHANNELS_URL = "https://functions.poehali.dev/b3711fc2-306a-40d8-b502-6eb7fe19f05a";
const PROFILE_URL = "https://functions.poehali.dev/4682e786-b78a-4604-b55d-0e0c53fd3fda";

const AVATAR_COLORS = ["#5865f2","#eb459e","#57f287","#fee75c","#ed4245","#00b0f4","#ff7043","#9b59b6"];

interface User { id: number; username: string; display_name: string; avatar_color: string; bio?: string; }
interface Contact { id: number; name: string; username: string; avatar: string; color: string; status: string; lastMsg: string; time: string; }
interface Group { id: number; name: string; avatar: string; members: number; lastMsg: string; time: string; color: string; }
interface Channel { id: number; name: string; username?: string; description?: string; avatar_color: string; subscribers_count: number; is_public: boolean; is_owner?: boolean; subscribed?: boolean; }
interface Message { id?: number; from: string; avatar_color?: string; text: string; time: string; self: boolean; }
interface Post { id: number; text: string; author: string; avatar_color?: string; time: string; }

const STATUS_COLOR: Record<string, string> = { online: "#57f287", idle: "#fee75c", dnd: "#ed4245", offline: "#747f8d" };

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authScreen, setAuthScreen] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", display_name: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Главный таб: chats | channels
  const [mainTab, setMainTab] = useState<"chats" | "channels">("chats");
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

  // Каналы
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelPosts, setChannelPosts] = useState<Post[]>([]);
  const [channelPost, setChannelPost] = useState("");
  const [postSending, setPostSending] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showSearchChannel, setShowSearchChannel] = useState(false);
  const [channelSearchResults, setChannelSearchResults] = useState<Channel[]>([]);
  const [channelSearchQ, setChannelSearchQ] = useState("");
  const [channelForm, setChannelForm] = useState({ name: "", username: "", description: "", is_public: true });
  const [channelFormError, setChannelFormError] = useState("");
  const [channelFormLoading, setChannelFormLoading] = useState(false);
  const [lastPostId, setLastPostId] = useState<Record<number, number>>({});

  // Профиль
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ display_name: "", username: "", bio: "" });
  const [profileColor, setProfileColor] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const lastMsgIdRef = useRef<Record<number, number>>({});
  const selectedChannelRef = useRef<Channel | null>(null);
  const lastPostIdRef = useRef<Record<number, number>>({});

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { lastMsgIdRef.current = lastMsgId; }, [lastMsgId]);
  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);
  useEffect(() => { lastPostIdRef.current = lastPostId; }, [lastPostId]);

  useEffect(() => {
    const savedSession = localStorage.getItem("groza_session");
    const savedUser = localStorage.getItem("groza_user");
    if (savedSession && savedUser) {
      setSessionId(savedSession);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Polling сообщений
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      const sid = selectedIdRef.current;
      const sess = sessionIdRef.current;
      if (!sid || !sess || sid >= 2000) return;
      const since = lastMsgIdRef.current[sid] || 0;
      try {
        const res = await fetch(`${MESSAGES_URL}?with=${sid}&since_id=${since}`, { headers: { "X-Session-Id": sess } });
        if (!res.ok) return;
        const data = await res.json();
        const newMsgs: Message[] = data.messages || [];
        if (!newMsgs.length) return;
        setMessages((prev) => {
          const existing = prev[sid] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const fresh = newMsgs.filter((m) => !existingIds.has(m.id));
          return fresh.length ? { ...prev, [sid]: [...existing, ...fresh] } : prev;
        });
        const maxId = Math.max(...newMsgs.map((m) => m.id || 0));
        setLastMsgId((prev) => ({ ...prev, [sid]: Math.max(prev[sid] || 0, maxId) }));
      } catch (_e) { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Polling постов канала
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      const ch = selectedChannelRef.current;
      const sess = sessionIdRef.current;
      if (!ch || !sess) return;
      const since = lastPostIdRef.current[ch.id] || 0;
      try {
        const res = await fetch(`${CHANNELS_URL}?action=posts&channel_id=${ch.id}&since_id=${since}`, { headers: { "X-Session-Id": sess } });
        if (!res.ok) return;
        const data = await res.json();
        const newPosts: Post[] = data.posts || [];
        if (!newPosts.length) return;
        setChannelPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = newPosts.filter((p) => !existingIds.has(p.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        const maxId = Math.max(...newPosts.map((p) => p.id));
        setLastPostId((prev) => ({ ...prev, [ch.id]: Math.max(prev[ch.id] || 0, maxId) }));
      } catch (_e) { /* ignore */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, selectedId, channelPosts]);

  // Auth
  const authFetch = (action: string, body: Record<string, string>) =>
    fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });

  const handleRegister = async () => {
    setAuthError(""); setAuthLoading(true);
    try {
      const res = await authFetch("register", authForm);
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Ошибка"); return; }
      localStorage.setItem("groza_session", data.session_id);
      localStorage.setItem("groza_user", JSON.stringify(data.user));
      setSessionId(data.session_id); setUser(data.user);
    } finally { setAuthLoading(false); }
  };

  const handleLogin = async () => {
    setAuthError(""); setAuthLoading(true);
    try {
      const res = await authFetch("login", { username: authForm.username, password: authForm.password });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Ошибка"); return; }
      localStorage.setItem("groza_session", data.session_id);
      localStorage.setItem("groza_user", JSON.stringify(data.user));
      setSessionId(data.session_id); setUser(data.user);
    } finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    if (sessionId) await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Session-Id": sessionId }, body: JSON.stringify({ action: "logout" }) });
    localStorage.removeItem("groza_session"); localStorage.removeItem("groza_user");
    setUser(null); setSessionId(null); setContacts([]); setGroups([]); setSelectedId(null); setChannels([]); setSelectedChannel(null);
  };

  // Users search
  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`${USERS_URL}?q=${encodeURIComponent(q)}`, { headers: sessionId ? { "X-Session-Id": sessionId } : {} });
      const data = await res.json();
      setSearchResults(data.users || []);
    } finally { setSearchLoading(false); }
  };

  const addContact = (u: User) => {
    if (contacts.find((c) => c.id === u.id)) { setShowSearch(false); setSelectedId(u.id); setMobileView("chat"); return; }
    setContacts((prev) => [{ id: u.id, name: u.display_name, username: u.username, avatar: u.display_name[0].toUpperCase(), color: u.avatar_color, status: "online", lastMsg: "Нажмите, чтобы написать", time: "сейчас" }, ...prev]);
    setSelectedId(u.id); setActiveTab("friends"); setShowSearch(false); setSearchResults([]); setMobileView("chat"); setMainTab("chats");
  };

  // Groups
  const createGroup = () => {
    if (!newGroupName.trim()) return;
    const g: Group = { id: Date.now(), name: newGroupName, avatar: newGroupName[0].toUpperCase(), members: 1, lastMsg: "Группа создана", time: "сейчас", color: "#5865f2" };
    setGroups((prev) => [g, ...prev]); setNewGroupName(""); setShowNewGroup(false); setActiveTab("groups"); setSelectedId(g.id); setMobileView("chat");
  };

  // Messages
  const loadMessages = async (contactId: number, sess: string) => {
    try {
      const since = lastMsgIdRef.current[contactId] || 0;
      const res = await fetch(`${MESSAGES_URL}?with=${contactId}&since_id=${since}`, { headers: { "X-Session-Id": sess } });
      if (!res.ok) return;
      const data = await res.json();
      const newMsgs: Message[] = data.messages || [];
      if (!newMsgs.length) return;
      setMessages((prev) => {
        const existing = prev[contactId] || [];
        const existingIds = new Set(existing.map((m) => m.id));
        const fresh = newMsgs.filter((m) => !existingIds.has(m.id));
        return fresh.length ? { ...prev, [contactId]: [...existing, ...fresh] } : prev;
      });
      const maxId = Math.max(...newMsgs.map((m) => m.id || 0));
      setLastMsgId((prev) => ({ ...prev, [contactId]: Math.max(prev[contactId] || 0, maxId) }));
    } catch (_e) { /* ignore */ }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedId || !sessionId || sending) return;
    if (selectedId >= 2000) {
      setMessages((prev) => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), { from: user?.display_name || "Я", text: message, time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), self: true }] }));
      setMessage(""); return;
    }
    const text = message; setMessage(""); setSending(true);
    try {
      const res = await fetch(MESSAGES_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Session-Id": sessionId }, body: JSON.stringify({ receiver_id: selectedId, text }) });
      if (!res.ok) { setMessage(text); return; }
      const data = await res.json();
      const msg: Message = data.message;
      setMessages((prev) => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), msg] }));
      setLastMsgId((prev) => ({ ...prev, [selectedId]: Math.max(prev[selectedId] || 0, msg.id || 0) }));
      setContacts((prev) => prev.map((c) => c.id === selectedId ? { ...c, lastMsg: text, time: msg.time } : c));
    } finally { setSending(false); }
  };

  const openChat = (id: number) => {
    setSelectedId(id); setMobileView("chat");
    if (id < 2000 && sessionId) loadMessages(id, sessionId);
  };

  // Channels
  const loadMyChannels = async (sess: string) => {
    try {
      const res = await fetch(`${CHANNELS_URL}?action=my`, { headers: { "X-Session-Id": sess } });
      if (!res.ok) return;
      const data = await res.json();
      setChannels(data.channels || []);
    } catch (_e) { /* ignore */ }
  };

  const openChannel = async (ch: Channel) => {
    setSelectedChannel(ch); setMobileView("chat"); setChannelPosts([]);
    if (!sessionId) return;
    try {
      const res = await fetch(`${CHANNELS_URL}?action=posts&channel_id=${ch.id}&since_id=0`, { headers: { "X-Session-Id": sessionId } });
      if (!res.ok) return;
      const data = await res.json();
      const posts: Post[] = data.posts || [];
      setChannelPosts(posts);
      if (posts.length) setLastPostId((prev) => ({ ...prev, [ch.id]: Math.max(...posts.map((p) => p.id)) }));
    } catch (_e) { /* ignore */ }
  };

  const searchChannels = async (q: string) => {
    setChannelSearchQ(q);
    if (!q.trim()) { setChannelSearchResults([]); return; }
    try {
      const res = await fetch(`${CHANNELS_URL}?action=search&q=${encodeURIComponent(q)}`, { headers: sessionId ? { "X-Session-Id": sessionId } : {} });
      if (!res.ok) return;
      const data = await res.json();
      setChannelSearchResults(data.channels || []);
    } catch (_e) { /* ignore */ }
  };

  const subscribeChannel = async (ch: Channel, subscribe: boolean) => {
    if (!sessionId) return;
    try {
      await fetch(CHANNELS_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Session-Id": sessionId }, body: JSON.stringify({ action: "subscribe", channel_id: ch.id, subscribe }) });
      if (subscribe) {
        const updated = { ...ch, subscribed: true, subscribers_count: ch.subscribers_count + 1 };
        setChannels((prev) => prev.find((c) => c.id === ch.id) ? prev.map((c) => c.id === ch.id ? updated : c) : [updated, ...prev]);
        setChannelSearchResults((prev) => prev.map((c) => c.id === ch.id ? updated : c));
      } else {
        setChannels((prev) => prev.filter((c) => c.id !== ch.id));
        setChannelSearchResults((prev) => prev.map((c) => c.id === ch.id ? { ...c, subscribed: false, subscribers_count: c.subscribers_count - 1 } : c));
        if (selectedChannel?.id === ch.id) { setSelectedChannel(null); setMobileView("list"); }
      }
    } catch (_e) { /* ignore */ }
  };

  const createChannel = async () => {
    setChannelFormError(""); setChannelFormLoading(true);
    try {
      const res = await fetch(CHANNELS_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Session-Id": sessionId! }, body: JSON.stringify({ action: "create", ...channelForm }) });
      const data = await res.json();
      if (!res.ok) { setChannelFormError(data.error || "Ошибка"); return; }
      setChannels((prev) => [data.channel, ...prev]);
      setShowCreateChannel(false);
      setChannelForm({ name: "", username: "", description: "", is_public: true });
      openChannel(data.channel);
      setMainTab("channels");
    } finally { setChannelFormLoading(false); }
  };

  const publishPost = async () => {
    if (!channelPost.trim() || !selectedChannel || !sessionId || postSending) return;
    const text = channelPost; setChannelPost(""); setPostSending(true);
    try {
      const res = await fetch(CHANNELS_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Session-Id": sessionId }, body: JSON.stringify({ action: "post", channel_id: selectedChannel.id, text }) });
      if (!res.ok) { setChannelPost(text); return; }
      const data = await res.json();
      setChannelPosts((prev) => [...prev, data.post]);
      setLastPostId((prev) => ({ ...prev, [selectedChannel.id]: data.post.id }));
    } finally { setPostSending(false); }
  };

  // Profile
  const openProfile = () => {
    if (!user) return;
    setProfileForm({ display_name: user.display_name, username: user.username, bio: user.bio || "" });
    setProfileColor(user.avatar_color);
    setProfileError(""); setProfileSaved(false);
    setShowProfile(true);
  };

  const saveProfile = async () => {
    if (!sessionId) return;
    setProfileError(""); setProfileLoading(true);
    try {
      const res = await fetch(PROFILE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
        body: JSON.stringify({ display_name: profileForm.display_name, username: profileForm.username, bio: profileForm.bio, avatar_color: profileColor }),
      });
      const data = await res.json();
      if (!res.ok) { setProfileError(data.error || "Ошибка"); return; }
      const updated = data.user;
      setUser(updated);
      localStorage.setItem("groza_user", JSON.stringify(updated));
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } finally { setProfileLoading(false); }
  };

  // load channels when tab opens
  useEffect(() => {
    if (mainTab === "channels" && sessionId) loadMyChannels(sessionId);
  }, [mainTab, sessionId]);

  const allChats = activeTab === "friends" ? contacts : groups;
  const filteredChats = allChats.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selected = [...contacts, ...groups].find((c) => c.id === selectedId);

  // ── AUTH SCREEN ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1c20] via-[#23272a] to-[#1e2025] flex items-center justify-center p-4">
        <div className="fixed top-[-100px] left-[-100px] w-80 h-80 bg-[#5865f2]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-[-80px] right-[-80px] w-72 h-72 bg-[#eb459e]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="w-full max-w-[400px] relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#5865f2] to-[#4752c4] rounded-2xl flex items-center justify-center shadow-lg shadow-[#5865f2]/30 mb-3">
              <Icon name="Zap" size={28} className="text-white" />
            </div>
            <h1 className="text-white text-3xl font-black tracking-tight">Гроза</h1>
            <p className="text-[#8e9297] text-sm mt-1">Мессенджер нового поколения</p>
          </div>
          <div className="bg-[#2b2d31]/90 backdrop-blur-sm rounded-2xl p-7 shadow-2xl border border-white/5">
            <h2 className="text-white text-xl font-bold mb-0.5">{authScreen === "login" ? "С возвращением! 👋" : "Создай аккаунт"}</h2>
            <p className="text-[#8e9297] text-sm mb-6">{authScreen === "login" ? "Войди в свой аккаунт Грозы" : "Присоединяйся к Грозе бесплатно"}</p>
            <div className="space-y-4">
              <div>
                <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Юзернейм</label>
                <div className="relative">
                  <Icon name="AtSign" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                  <Input value={authForm.username} onChange={(e) => setAuthForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))} placeholder="your_username" className="bg-[#1e1f22] border border-white/10 text-white placeholder:text-[#4e5058] pl-9 h-11 rounded-xl focus:border-[#5865f2] transition-colors" onKeyDown={(e) => e.key === "Enter" && (authScreen === "login" ? handleLogin() : null)} />
                </div>
              </div>
              {authScreen === "register" && (
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Отображаемое имя</label>
                  <div className="relative">
                    <Icon name="User" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                    <Input value={authForm.display_name} onChange={(e) => setAuthForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Иван Петров" className="bg-[#1e1f22] border border-white/10 text-white placeholder:text-[#4e5058] pl-9 h-11 rounded-xl focus:border-[#5865f2] transition-colors" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Пароль</label>
                <div className="relative">
                  <Icon name="Lock" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                  <Input type="password" value={authForm.password} onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="bg-[#1e1f22] border border-white/10 text-white placeholder:text-[#4e5058] pl-9 h-11 rounded-xl focus:border-[#5865f2] transition-colors" onKeyDown={(e) => e.key === "Enter" && (authScreen === "login" ? handleLogin() : handleRegister())} />
                </div>
              </div>
              {authError && <div className="flex items-center gap-2 bg-[#ed4245]/15 border border-[#ed4245]/30 rounded-xl px-3 py-2.5 text-[#ed4245] text-sm"><Icon name="AlertCircle" size={15} className="shrink-0" />{authError}</div>}
              <Button onClick={authScreen === "login" ? handleLogin : handleRegister} disabled={authLoading} className="w-full bg-gradient-to-r from-[#5865f2] to-[#4752c4] hover:from-[#4752c4] hover:to-[#3c45a5] text-white font-bold h-11 rounded-xl text-base shadow-lg shadow-[#5865f2]/20 transition-all">
                {authLoading ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Загрузка...</span> : authScreen === "login" ? "Войти" : "Создать аккаунт"}
              </Button>
            </div>
            <div className="mt-5 pt-5 border-t border-white/5 text-center">
              <span className="text-[#8e9297] text-sm">{authScreen === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}</span>
              <button onClick={() => { setAuthScreen(authScreen === "login" ? "register" : "login"); setAuthError(""); setAuthForm({ username: "", display_name: "", password: "" }); }} className="text-[#5865f2] hover:text-[#4752c4] text-sm font-semibold transition-colors">
                {authScreen === "login" ? "Зарегистрироваться" : "Войти"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN APP ───────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-[#313338] text-white flex flex-col overflow-hidden">

      {/* Мобильный хедер */}
      {mobileView === "list" && (
        <div className="md:hidden bg-[#1e1f22] px-4 pt-safe-top pb-3 flex items-center gap-2 border-b border-black/20">
          <div className="w-8 h-8 bg-gradient-to-br from-[#5865f2] to-[#4752c4] rounded-xl flex items-center justify-center">
            <Icon name="Zap" size={15} className="text-white" />
          </div>
          <span className="font-black text-white text-lg tracking-tight flex-1">Гроза</span>
          {mainTab === "chats" && <>
            <button onClick={() => setShowSearch(true)} className="w-9 h-9 bg-[#2b2d31] rounded-xl flex items-center justify-center text-[#b9bbbe]"><Icon name="UserPlus" size={17} /></button>
            <button onClick={() => setShowNewGroup(true)} className="w-9 h-9 bg-[#2b2d31] rounded-xl flex items-center justify-center text-[#b9bbbe]"><Icon name="Users" size={17} /></button>
          </>}
          {mainTab === "channels" && <>
            <button onClick={() => setShowSearchChannel(true)} className="w-9 h-9 bg-[#2b2d31] rounded-xl flex items-center justify-center text-[#b9bbbe]"><Icon name="Search" size={17} /></button>
            <button onClick={() => setShowCreateChannel(true)} className="w-9 h-9 bg-[#5865f2] rounded-xl flex items-center justify-center text-white"><Icon name="Plus" size={17} /></button>
          </>}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <div className={`${mobileView === "list" ? "flex" : "hidden"} md:flex w-full md:w-72 lg:w-80 bg-[#2b2d31] flex-col shrink-0`}>

          {/* Десктопная шапка */}
          <div className="hidden md:flex items-center gap-2 px-4 py-4 border-b border-black/20">
            <div className="w-9 h-9 bg-gradient-to-br from-[#5865f2] to-[#4752c4] rounded-xl flex items-center justify-center shrink-0">
              <Icon name="Zap" size={16} className="text-white" />
            </div>
            <span className="font-black text-white text-xl tracking-tight flex-1">Гроза</span>
            {mainTab === "chats" && <>
              <button onClick={() => setShowSearch(true)} className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#5865f2] transition-all"><Icon name="UserPlus" size={15} /></button>
              <button onClick={() => setShowNewGroup(true)} className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#5865f2] transition-all"><Icon name="Users" size={15} /></button>
            </>}
            {mainTab === "channels" && <>
              <button onClick={() => setShowSearchChannel(true)} className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#5865f2] transition-all"><Icon name="Search" size={15} /></button>
              <button onClick={() => setShowCreateChannel(true)} className="w-8 h-8 bg-[#5865f2] rounded-lg flex items-center justify-center text-white hover:bg-[#4752c4] transition-all"><Icon name="Plus" size={15} /></button>
            </>}
          </div>

          {/* Главные табы: Чаты / Каналы */}
          <div className="flex gap-1 px-3 pt-3 pb-2">
            <button onClick={() => setMainTab("chats")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mainTab === "chats" ? "bg-[#5865f2] text-white shadow-md shadow-[#5865f2]/20" : "text-[#8e9297] hover:bg-[#383a40] hover:text-[#dcddde]"}`}>
              <Icon name="MessageCircle" size={13} className="inline mr-1" />Чаты
            </button>
            <button onClick={() => setMainTab("channels")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mainTab === "channels" ? "bg-[#5865f2] text-white shadow-md shadow-[#5865f2]/20" : "text-[#8e9297] hover:bg-[#383a40] hover:text-[#dcddde]"}`}>
              <Icon name="Radio" size={13} className="inline mr-1" />Каналы
            </button>
          </div>

          {/* CHATS TAB */}
          {mainTab === "chats" && <>
            <div className="px-3 pb-2">
              <div className="relative">
                <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск..." className="w-full bg-[#1e1f22] text-[#dcddde] placeholder:text-[#4e5058] pl-9 pr-3 h-9 rounded-lg text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-1 px-3 pb-2">
              <button onClick={() => setActiveTab("friends")} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "friends" ? "bg-[#404249] text-white" : "text-[#8e9297] hover:bg-[#35373c]"}`}>
                <Icon name="User" size={11} className="inline mr-1" />Личные
              </button>
              <button onClick={() => setActiveTab("groups")} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "groups" ? "bg-[#404249] text-white" : "text-[#8e9297] hover:bg-[#35373c]"}`}>
                <Icon name="Users" size={11} className="inline mr-1" />Группы
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
              {filteredChats.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="w-12 h-12 bg-[#1e1f22] rounded-2xl flex items-center justify-center mb-2"><Icon name={activeTab === "friends" ? "MessageCircle" : "Users"} size={22} className="text-[#5865f2]" /></div>
                  <p className="text-[#8e9297] text-sm font-medium">{activeTab === "friends" ? "Нет чатов" : "Нет групп"}</p>
                  <p className="text-[#4e5058] text-xs mt-1">{activeTab === "friends" ? "Найди людей через поиск" : "Создай первую группу"}</p>
                </div>
              )}
              {filteredChats.map((c) => (
                <button key={c.id} onClick={() => openChat(c.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${selectedId === c.id ? "bg-[#404249]" : "hover:bg-[#35373c]"}`}>
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base" style={{ backgroundColor: c.color }}>{c.avatar}</div>
                    {"status" in c && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#2b2d31]" style={{ backgroundColor: STATUS_COLOR[(c as Contact).status] }} />}
                    {"members" in c && <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#5865f2] border-2 border-[#2b2d31] flex items-center justify-center"><Icon name="Users" size={8} className="text-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[#f2f3f5] text-sm font-semibold truncate">{c.name}</span>
                      <span className="text-[#5c5f66] text-xs shrink-0">{c.time}</span>
                    </div>
                    <div className="text-[#8e9297] text-xs truncate mt-0.5">{"username" in c ? `@${(c as Contact).username}` : c.lastMsg}</div>
                  </div>
                </button>
              ))}
            </div>
          </>}

          {/* CHANNELS TAB */}
          {mainTab === "channels" && (
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
              {channels.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="w-12 h-12 bg-[#1e1f22] rounded-2xl flex items-center justify-center mb-2"><Icon name="Radio" size={22} className="text-[#5865f2]" /></div>
                  <p className="text-[#8e9297] text-sm font-medium">Нет каналов</p>
                  <p className="text-[#4e5058] text-xs mt-1">Создай канал или найди через поиск</p>
                </div>
              )}
              {channels.map((ch) => (
                <button key={ch.id} onClick={() => { openChannel(ch); setMobileView("chat"); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${selectedChannel?.id === ch.id ? "bg-[#404249]" : "hover:bg-[#35373c]"}`}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0" style={{ backgroundColor: ch.avatar_color }}>{ch.name[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[#f2f3f5] text-sm font-semibold truncate">{ch.name}</span>
                      {ch.is_owner && <span className="text-[#5865f2] text-xs shrink-0">✦</span>}
                    </div>
                    <div className="text-[#8e9297] text-xs">{ch.subscribers_count} подписчиков</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Профиль */}
          <div className="px-3 py-3 border-t border-black/20 bg-[#232428]">
            <button onClick={openProfile} className="w-full flex items-center gap-3 hover:bg-[#2b2d31] rounded-xl px-1 py-1 transition-colors">
              <div className="relative">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0" style={{ backgroundColor: user.avatar_color }}>{user.display_name[0].toUpperCase()}</div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#57f287] border-2 border-[#232428]" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-white text-sm font-semibold truncate">{user.display_name}</div>
                <div className="text-[#8e9297] text-xs truncate">@{user.username}</div>
              </div>
              <Icon name="Settings" size={15} className="text-[#8e9297] shrink-0" />
            </button>
          </div>
        </div>

        {/* ── CHAT / CHANNEL AREA ── */}
        <div className={`${mobileView === "chat" ? "flex" : "hidden"} md:flex flex-1 flex-col overflow-hidden bg-[#313338]`}>

          {/* CHANNEL VIEW */}
          {mainTab === "channels" && selectedChannel ? (
            <>
              <div className="h-14 bg-[#313338] border-b border-black/20 flex items-center px-4 gap-3 shrink-0">
                <button onClick={() => setMobileView("list")} className="md:hidden w-8 h-8 flex items-center justify-center text-[#8e9297]"><Icon name="ArrowLeft" size={20} /></button>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: selectedChannel.avatar_color }}>{selectedChannel.name[0].toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm flex items-center gap-1">
                    {selectedChannel.name}
                    {selectedChannel.is_owner && <span className="text-[#5865f2] text-xs">✦ владелец</span>}
                  </div>
                  <div className="text-[#8e9297] text-xs">{selectedChannel.subscribers_count} подписчиков</div>
                </div>
                {!selectedChannel.is_owner && (
                  <button onClick={() => subscribeChannel(selectedChannel, false)} className="text-[#ed4245] text-xs hover:underline">Отписаться</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {channelPosts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-2xl mb-4" style={{ backgroundColor: selectedChannel.avatar_color }}>{selectedChannel.name[0].toUpperCase()}</div>
                    <p className="text-white font-bold text-lg">{selectedChannel.name}</p>
                    {selectedChannel.description && <p className="text-[#8e9297] text-sm mt-1 max-w-xs">{selectedChannel.description}</p>}
                    <p className="text-[#5c5f66] text-sm mt-3">{selectedChannel.is_owner ? "Опубликуйте первый пост!" : "Пока нет постов"}</p>
                  </div>
                )}
                {channelPosts.map((post) => (
                  <div key={post.id} className="bg-[#2b2d31] rounded-2xl p-4 max-w-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: selectedChannel.avatar_color }}>{selectedChannel.name[0].toUpperCase()}</div>
                      <span className="text-[#f2f3f5] text-sm font-semibold">{selectedChannel.name}</span>
                      <span className="text-[#5c5f66] text-xs ml-auto">{post.time}</span>
                    </div>
                    <p className="text-[#dcddde] text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {selectedChannel.is_owner && (
                <div className="px-4 pb-4 pt-2">
                  <div className="flex items-end gap-2 bg-[#383a40] rounded-xl px-3 py-2.5 border border-transparent focus-within:border-[#5865f2]/30 transition-colors">
                    <textarea
                      className="flex-1 bg-transparent text-[#f2f3f5] placeholder:text-[#5c5f66] text-sm outline-none resize-none min-h-[36px] max-h-32"
                      placeholder="Написать пост..."
                      value={channelPost}
                      onChange={(e) => setChannelPost(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); publishPost(); } }}
                      rows={1}
                    />
                    <button onClick={publishPost} disabled={!channelPost.trim() || postSending} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${channelPost.trim() && !postSending ? "bg-[#5865f2] hover:bg-[#4752c4] text-white" : "bg-[#2e3035] text-[#4e5058]"}`}>
                      {postSending ? <div className="w-3.5 h-3.5 border-2 border-[#4e5058] border-t-white rounded-full animate-spin" /> : <Icon name="Send" size={14} />}
                    </button>
                  </div>
                  <p className="text-[#5c5f66] text-xs mt-1 px-1">Enter — опубликовать · Shift+Enter — новая строка</p>
                </div>
              )}
            </>
          ) : mainTab === "channels" ? (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center px-8">
              <div className="w-20 h-20 bg-[#5865f2]/15 rounded-3xl flex items-center justify-center mb-4"><Icon name="Radio" size={36} className="text-[#5865f2]" /></div>
              <h2 className="text-white text-xl font-black mb-2">Каналы</h2>
              <p className="text-[#8e9297] text-sm max-w-xs">Создай свой канал или подпишись на существующие</p>
            </div>
          ) : selected ? (
            <>
              <div className="h-14 bg-[#313338] border-b border-black/20 flex items-center px-4 gap-3 shrink-0">
                <button onClick={() => setMobileView("list")} className="md:hidden w-8 h-8 flex items-center justify-center text-[#8e9297]"><Icon name="ArrowLeft" size={20} /></button>
                <div className="relative">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: selected.color }}>{selected.avatar}</div>
                  {"status" in selected && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#313338]" style={{ backgroundColor: STATUS_COLOR[(selected as Contact).status] }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">{selected.name}</div>
                  {"username" in selected ? <div className="text-[#8e9297] text-xs">@{(selected as Contact).username}</div> : <div className="text-[#8e9297] text-xs">{(selected as Group).members} участников</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setActiveCall({ name: selected.name, avatar: selected.avatar, color: selected.color, isVideo: false })} className="w-9 h-9 rounded-xl flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#404249] transition-all"><Icon name="Phone" size={17} /></button>
                  <button onClick={() => setActiveCall({ name: selected.name, avatar: selected.avatar, color: selected.color, isVideo: true })} className="w-9 h-9 rounded-xl flex items-center justify-center text-[#b9bbbe] hover:text-white hover:bg-[#404249] transition-all"><Icon name="Video" size={17} /></button>
                </div>
              </div>
              {activeCall && (
                <div className="bg-[#232428] border-b border-black/20 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-[#57f287] animate-pulse shrink-0" />
                    <span className="text-[#57f287] text-sm font-semibold truncate">{activeCall.isVideo ? "Видеозвонок" : "Аудиозвонок"} · {activeCall.name}</span>
                  </div>
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isMuted ? "bg-[#ed4245]/20 text-[#ed4245]" : "text-[#b9bbbe] hover:bg-[#404249] hover:text-white"}`}><Icon name={isMuted ? "MicOff" : "Mic"} size={15} /></button>
                  <button onClick={() => setActiveCall(null)} className="flex items-center gap-1.5 bg-[#ed4245] hover:bg-[#c03537] text-white rounded-lg px-3 h-8 text-xs font-bold transition-colors"><Icon name="PhoneOff" size={13} />Завершить</button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {(messages[selectedId!] || []).length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl mb-4" style={{ backgroundColor: selected.color }}>{selected.avatar}</div>
                    <p className="text-white font-bold text-xl">{selected.name}</p>
                    {"username" in selected && <p className="text-[#8e9297] text-sm mt-1">@{(selected as Contact).username}</p>}
                    <p className="text-[#5c5f66] text-sm mt-3">Начни переписку!</p>
                  </div>
                )}
                {(messages[selectedId!] || []).map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.self ? "flex-row-reverse" : ""}`}>
                    {!msg.self && <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 mt-1" style={{ backgroundColor: selected.color }}>{selected.avatar}</div>}
                    <div className={`max-w-[75%] flex flex-col ${msg.self ? "items-end" : "items-start"}`}>
                      {!msg.self && <span className="text-[#00b0f4] text-xs font-bold mb-1 ml-1">{msg.from}</span>}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.self ? "bg-[#5865f2] text-white rounded-tr-md" : "bg-[#383a40] text-[#f2f3f5] rounded-tl-md"}`}>{msg.text}</div>
                      <span className="text-[#5c5f66] text-xs mt-1 mx-1">{msg.time}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="px-4 pb-4 pt-2 bg-[#313338]">
                <div className="flex items-center gap-2 bg-[#383a40] rounded-xl px-3 py-2.5 border border-transparent focus-within:border-[#5865f2]/30 transition-colors">
                  <input className="flex-1 bg-transparent text-[#f2f3f5] placeholder:text-[#5c5f66] text-sm outline-none" placeholder={`Написать ${selected.name}...`} value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} />
                  <button onClick={sendMessage} disabled={!message.trim() || sending} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${message.trim() && !sending ? "bg-[#5865f2] hover:bg-[#4752c4] text-white" : "bg-[#2e3035] text-[#4e5058]"}`}>
                    {sending ? <div className="w-3.5 h-3.5 border-2 border-[#4e5058] border-t-white rounded-full animate-spin" /> : <Icon name="Send" size={14} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center px-8">
              <div className="w-24 h-24 bg-gradient-to-br from-[#5865f2]/20 to-[#eb459e]/20 rounded-3xl flex items-center justify-center mb-5"><Icon name="Zap" size={42} className="text-[#5865f2]" /></div>
              <h2 className="text-white text-2xl font-black mb-2">Привет, {user.display_name}!</h2>
              <p className="text-[#8e9297] text-sm max-w-xs">Выбери чат или открой вкладку «Каналы»</p>
            </div>
          )}
        </div>
      </div>

      {/* ── МОДАЛКА ПОИСКА ЛЮДЕЙ ── */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#2b2d31] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-[#4e5058] rounded-full" /></div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-bold">Найти людей</h2>
                <button onClick={() => { setShowSearch(false); setSearchResults([]); }} className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#8e9297] hover:text-white"><Icon name="X" size={15} /></button>
              </div>
              <div className="relative mb-4">
                <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                <input autoFocus placeholder="Поиск по юзернейму или имени..." className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] pl-10 pr-4 h-11 rounded-xl text-sm outline-none" onChange={(e) => searchUsers(e.target.value)} />
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {searchLoading && <div className="flex items-center justify-center py-8 gap-2 text-[#8e9297] text-sm"><div className="w-4 h-4 border-2 border-[#8e9297]/30 border-t-[#8e9297] rounded-full animate-spin" />Поиск...</div>}
                {!searchLoading && searchResults.length === 0 && <div className="text-center py-8"><Icon name="Search" size={28} className="text-[#4e5058] mx-auto mb-2" /><p className="text-[#8e9297] text-sm">Введите юзернейм для поиска</p></div>}
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1e1f22] hover:bg-[#383a40] transition-colors">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0" style={{ backgroundColor: u.avatar_color }}>{u.display_name[0].toUpperCase()}</div>
                    <div className="flex-1 min-w-0"><div className="text-white font-semibold text-sm">{u.display_name}</div><div className="text-[#8e9297] text-xs">@{u.username}</div></div>
                    {u.is_me ? <span className="text-[#4e5058] text-xs bg-[#2b2d31] px-2 py-1 rounded-lg">Вы</span> : <button onClick={() => addContact(u)} className="bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl px-4 h-9 text-xs font-bold transition-colors">Написать</button>}
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
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-[#4e5058] rounded-full" /></div>
            <div className="p-5">
              <h2 className="text-white text-lg font-bold mb-1">Создать группу</h2>
              <p className="text-[#8e9297] text-sm mb-4">Введите название группы</p>
              <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Название группы..." className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] px-4 h-11 rounded-xl text-sm outline-none mb-4" onKeyDown={(e) => e.key === "Enter" && createGroup()} autoFocus />
              <div className="flex gap-2">
                <button onClick={() => setShowNewGroup(false)} className="flex-1 h-10 rounded-xl bg-[#1e1f22] text-[#8e9297] hover:text-white hover:bg-[#383a40] text-sm font-semibold transition-colors">Отмена</button>
                <button onClick={createGroup} disabled={!newGroupName.trim()} className="flex-1 h-10 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white text-sm font-bold transition-colors">Создать</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── МОДАЛКА СОЗДАНИЯ КАНАЛА ── */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#2b2d31] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/5">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-[#4e5058] rounded-full" /></div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-white text-lg font-bold">Создать канал</h2>
                <button onClick={() => setShowCreateChannel(false)} className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#8e9297] hover:text-white"><Icon name="X" size={15} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Название *</label>
                  <input value={channelForm.name} onChange={(e) => setChannelForm((f) => ({ ...f, name: e.target.value }))} placeholder="Мой канал" className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] px-4 h-11 rounded-xl text-sm outline-none border border-transparent focus:border-[#5865f2]/50 transition-colors" />
                </div>
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Username канала</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297] text-sm">@</span>
                    <input value={channelForm.username} onChange={(e) => setChannelForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))} placeholder="my_channel" className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] pl-8 pr-4 h-11 rounded-xl text-sm outline-none border border-transparent focus:border-[#5865f2]/50 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Описание</label>
                  <textarea value={channelForm.description} onChange={(e) => setChannelForm((f) => ({ ...f, description: e.target.value }))} placeholder="О чём ваш канал..." className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] px-4 py-3 rounded-xl text-sm outline-none resize-none h-20 border border-transparent focus:border-[#5865f2]/50 transition-colors" />
                </div>
                <div className="flex items-center justify-between bg-[#1e1f22] rounded-xl px-4 py-3">
                  <div>
                    <div className="text-white text-sm font-semibold">Публичный канал</div>
                    <div className="text-[#8e9297] text-xs">Любой сможет найти и подписаться</div>
                  </div>
                  <button onClick={() => setChannelForm((f) => ({ ...f, is_public: !f.is_public }))} className={`w-12 h-6 rounded-full transition-colors relative ${channelForm.is_public ? "bg-[#5865f2]" : "bg-[#4e5058]"}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${channelForm.is_public ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>
                {channelFormError && <div className="flex items-center gap-2 bg-[#ed4245]/15 border border-[#ed4245]/30 rounded-xl px-3 py-2.5 text-[#ed4245] text-sm"><Icon name="AlertCircle" size={15} />{channelFormError}</div>}
                <div className="flex gap-2">
                  <button onClick={() => setShowCreateChannel(false)} className="flex-1 h-11 rounded-xl bg-[#1e1f22] text-[#8e9297] hover:text-white hover:bg-[#383a40] text-sm font-semibold transition-colors">Отмена</button>
                  <button onClick={createChannel} disabled={!channelForm.name.trim() || channelFormLoading} className="flex-1 h-11 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white text-sm font-bold transition-colors">
                    {channelFormLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : "Создать"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ПОИСК КАНАЛОВ ── */}
      {showSearchChannel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#2b2d31] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-[#4e5058] rounded-full" /></div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-bold">Поиск каналов</h2>
                <button onClick={() => { setShowSearchChannel(false); setChannelSearchResults([]); setChannelSearchQ(""); }} className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#8e9297] hover:text-white"><Icon name="X" size={15} /></button>
              </div>
              <div className="relative mb-4">
                <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297]" />
                <input autoFocus value={channelSearchQ} onChange={(e) => searchChannels(e.target.value)} placeholder="Название или @username канала..." className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] pl-10 pr-4 h-11 rounded-xl text-sm outline-none" />
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {channelSearchResults.length === 0 && <div className="text-center py-8"><Icon name="Radio" size={28} className="text-[#4e5058] mx-auto mb-2" /><p className="text-[#8e9297] text-sm">Введите название канала</p></div>}
                {channelSearchResults.map((ch) => (
                  <div key={ch.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1e1f22] hover:bg-[#383a40] transition-colors">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0" style={{ backgroundColor: ch.avatar_color }}>{ch.name[0].toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold text-sm">{ch.name}</div>
                      <div className="text-[#8e9297] text-xs">{ch.subscribers_count} подписчиков{ch.username ? ` · @${ch.username}` : ""}</div>
                      {ch.description && <div className="text-[#5c5f66] text-xs truncate mt-0.5">{ch.description}</div>}
                    </div>
                    <button
                      onClick={() => { subscribeChannel(ch, !ch.subscribed); if (!ch.subscribed) { setShowSearchChannel(false); setMainTab("channels"); } }}
                      className={`rounded-xl px-3 h-9 text-xs font-bold transition-colors shrink-0 ${ch.subscribed ? "bg-[#383a40] text-[#8e9297] hover:bg-[#ed4245]/20 hover:text-[#ed4245]" : "bg-[#5865f2] hover:bg-[#4752c4] text-white"}`}
                    >
                      {ch.subscribed ? "Отписаться" : "Подписаться"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── РЕДАКТИРОВАНИЕ ПРОФИЛЯ ── */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#2b2d31] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/5">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-[#4e5058] rounded-full" /></div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-white text-lg font-bold">Мой профиль</h2>
                <button onClick={() => setShowProfile(false)} className="w-8 h-8 bg-[#1e1f22] rounded-lg flex items-center justify-center text-[#8e9297] hover:text-white"><Icon name="X" size={15} /></button>
              </div>

              {/* Аватар-превью */}
              <div className="flex items-center gap-4 mb-5 p-4 bg-[#1e1f22] rounded-2xl">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-lg transition-colors" style={{ backgroundColor: profileColor }}>{(profileForm.display_name || user.display_name)[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-base">{profileForm.display_name || user.display_name}</div>
                  <div className="text-[#8e9297] text-sm">@{profileForm.username || user.username}</div>
                  {profileForm.bio && <div className="text-[#8e9297] text-xs mt-1 truncate">{profileForm.bio}</div>}
                </div>
              </div>

              {/* Выбор цвета */}
              <div className="mb-4">
                <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Цвет аватара</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((c) => (
                    <button key={c} onClick={() => setProfileColor(c)} className={`w-9 h-9 rounded-full transition-all ${profileColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#2b2d31] scale-110" : "hover:scale-105"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Имя</label>
                  <input value={profileForm.display_name} onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Твоё имя" className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] px-4 h-11 rounded-xl text-sm outline-none border border-transparent focus:border-[#5865f2]/50 transition-colors" />
                </div>
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9297] text-sm">@</span>
                    <input value={profileForm.username} onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))} placeholder="username" className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] pl-8 pr-4 h-11 rounded-xl text-sm outline-none border border-transparent focus:border-[#5865f2]/50 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-[#b9bbbe] text-xs font-bold uppercase tracking-wider mb-2 block">О себе</label>
                  <textarea value={profileForm.bio} onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Несколько слов о себе..." maxLength={200} className="w-full bg-[#1e1f22] text-white placeholder:text-[#4e5058] px-4 py-3 rounded-xl text-sm outline-none resize-none h-20 border border-transparent focus:border-[#5865f2]/50 transition-colors" />
                  <div className="text-[#5c5f66] text-xs text-right mt-1">{profileForm.bio.length}/200</div>
                </div>
                {profileError && <div className="flex items-center gap-2 bg-[#ed4245]/15 border border-[#ed4245]/30 rounded-xl px-3 py-2.5 text-[#ed4245] text-sm"><Icon name="AlertCircle" size={15} />{profileError}</div>}
                {profileSaved && <div className="flex items-center gap-2 bg-[#57f287]/15 border border-[#57f287]/30 rounded-xl px-3 py-2.5 text-[#57f287] text-sm"><Icon name="Check" size={15} />Профиль сохранён!</div>}
                <div className="flex gap-2 pt-1">
                  <button onClick={handleLogout} className="h-11 px-4 rounded-xl bg-[#ed4245]/15 text-[#ed4245] hover:bg-[#ed4245]/25 text-sm font-semibold transition-colors flex items-center gap-2"><Icon name="LogOut" size={15} />Выйти</button>
                  <button onClick={saveProfile} disabled={profileLoading} className="flex-1 h-11 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-sm font-bold transition-colors">
                    {profileLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : profileSaved ? "✓ Сохранено" : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
