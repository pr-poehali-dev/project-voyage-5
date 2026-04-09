import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";

const CONTACTS = [
  { id: 1, name: "Мария Иванова", status: "online", avatar: "М", color: "#5865f2", lastMsg: "Привет! Как дела?", time: "сейчас" },
  { id: 2, name: "Дмитрий Волков", status: "idle", avatar: "Д", color: "#eb459e", lastMsg: "Окей, договорились!", time: "5 мин" },
  { id: 3, name: "Анна Смирнова", status: "online", avatar: "А", color: "#57f287", lastMsg: "Скинь ссылку пожалуйста", time: "22 мин" },
  { id: 4, name: "Павел Кузнецов", status: "dnd", avatar: "П", color: "#fee75c", lastMsg: "Буду позже", time: "1 ч" },
  { id: 5, name: "Ольга Петрова", status: "offline", avatar: "О", color: "#ed4245", lastMsg: "Спасибо за помощь!", time: "вчера" },
];

const GROUPS = [
  { id: 10, name: "Команда дизайна", avatar: "КД", members: 5, lastMsg: "Встреча в 15:00", time: "10 мин", color: "#5865f2" },
  { id: 11, name: "Проект Альфа", avatar: "ПА", members: 8, lastMsg: "Нужен фидбек по макету", time: "1 ч", color: "#eb459e" },
  { id: 12, name: "Семья ❤️", avatar: "С", members: 4, lastMsg: "Мама: ужин готов", time: "2 ч", color: "#57f287" },
];

const MESSAGES: Record<number, { from: string; text: string; time: string; self: boolean }[]> = {
  1: [
    { from: "Мария Иванова", text: "Привет! Как дела?", time: "10:30", self: false },
    { from: "Я", text: "Привет! Всё отлично, работаю над проектом", time: "10:31", self: true },
    { from: "Мария Иванова", text: "Здорово! Можем созвониться сегодня?", time: "10:32", self: false },
  ],
  2: [
    { from: "Дмитрий Волков", text: "Отправил тебе файлы", time: "09:15", self: false },
    { from: "Я", text: "Получил, спасибо!", time: "09:20", self: true },
    { from: "Дмитрий Волков", text: "Окей, договорились!", time: "09:21", self: false },
  ],
  3: [
    { from: "Анна Смирнова", text: "Можешь посмотреть мой PR?", time: "11:05", self: false },
    { from: "Я", text: "Конечно, сейчас гляну", time: "11:10", self: true },
    { from: "Анна Смирнова", text: "Скинь ссылку пожалуйста", time: "11:12", self: false },
  ],
  10: [
    { from: "Мария Иванова", text: "Встреча в 15:00, не забудьте!", time: "13:50", self: false },
    { from: "Дмитрий Волков", text: "Буду", time: "13:52", self: false },
    { from: "Я", text: "Тоже буду, спасибо за напоминание", time: "13:55", self: true },
  ],
  11: [
    { from: "Анна Смирнова", text: "Нужен фидбек по макету главной", time: "12:00", self: false },
    { from: "Я", text: "Посмотрю в течение часа", time: "12:10", self: true },
  ],
  12: [
    { from: "Мама", text: "Ужин готов в 19:00", time: "17:00", self: false },
    { from: "Я", text: "Буду, спасибо!", time: "17:05", self: true },
  ],
};

const STATUS_COLOR: Record<string, string> = {
  online: "#57f287",
  idle: "#fee75c",
  dnd: "#ed4245",
  offline: "#747f8d",
};

type Tab = "friends" | "groups";
type ActiveCall = { name: string; avatar: string; color: string; isMuted: boolean; isVideo: boolean } | null;

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(MESSAGES);
  const [activeCall, setActiveCall] = useState<ActiveCall>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [groups, setGroups] = useState(GROUPS);

  const allChats = activeTab === "friends" ? CONTACTS : groups;
  const filtered = allChats.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selected = [...CONTACTS, ...groups].find((c) => c.id === selectedId);

  const sendMessage = () => {
    if (!message.trim() || !selectedId) return;
    setMessages((prev) => ({
      ...prev,
      [selectedId]: [
        ...(prev[selectedId] || []),
        { from: "Я", text: message, time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), self: true },
      ],
    }));
    setMessage("");
  };

  const startCall = (video = false) => {
    if (!selected) return;
    setActiveCall({
      name: selected.name,
      avatar: selected.avatar,
      color: selected.color,
      isMuted: false,
      isVideo: video,
    });
  };

  const endCall = () => setActiveCall(null);

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup = {
      id: Date.now(),
      name: newGroupName,
      avatar: newGroupName[0].toUpperCase(),
      members: 1,
      lastMsg: "Группа создана",
      time: "сейчас",
      color: "#5865f2",
    };
    setGroups((prev) => [newGroup, ...prev]);
    setNewGroupName("");
    setShowNewGroup(false);
    setActiveTab("groups");
    setSelectedId(newGroup.id);
  };

  return (
    <div className="h-screen bg-[#36393f] text-white flex flex-col overflow-hidden">
      {/* Верхняя панель */}
      <div className="h-12 bg-[#202225] flex items-center px-4 gap-3 shrink-0 border-b border-black/30">
        <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center shrink-0">
          <Icon name="MessageCircle" size={16} className="text-white" />
        </div>
        <span className="font-bold text-white text-base hidden sm:block">DiscordApp</span>
        <div className="flex-1" />
        <Button
          size="sm"
          className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs px-3 h-7"
          onClick={() => setShowNewGroup(true)}
        >
          <Icon name="Plus" size={14} className="mr-1" />
          Группа
        </Button>
        <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center cursor-pointer">
          <span className="text-white text-sm font-bold">Я</span>
        </div>
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
        {/* Левая панель — контакты/группы */}
        <div
          className={`${mobileSidebar ? "flex" : "hidden"} sm:flex w-full sm:w-72 bg-[#2f3136] flex-col shrink-0`}
        >
          {/* Поиск */}
          <div className="p-3">
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e9297]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск..."
                className="bg-[#202225] border-none text-[#dcddde] placeholder:text-[#8e9297] pl-8 h-7 text-sm"
              />
            </div>
          </div>

          {/* Табы */}
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

          {/* Список */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => { setSelectedId(c.id); setMobileSidebar(false); }}
                className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-colors ${selectedId === c.id ? "bg-[#393c43]" : "hover:bg-[#34373c]"}`}
              >
                <div className="relative shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.avatar}
                  </div>
                  {"status" in c && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2f3136]"
                      style={{ backgroundColor: STATUS_COLOR[(c as typeof CONTACTS[0]).status] }}
                    />
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
                  <div className="text-[#8e9297] text-xs truncate">{c.lastMsg}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Пользователь */}
          <div className="p-2 bg-[#292b2f] flex items-center gap-2 border-t border-black/20">
            <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">Я</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium">Мой аккаунт</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#57f287]" />
                <span className="text-[#b9bbbe] text-xs">В сети</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-7 h-7 p-0 text-[#b9bbbe] hover:text-white hover:bg-[#40444b]">
              <Icon name="Settings" size={14} />
            </Button>
          </div>
        </div>

        {/* Правая часть — чат */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Заголовок чата */}
              <div className="h-12 bg-[#36393f] border-b border-[#202225] flex items-center px-4 gap-3 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:hidden text-[#8e9297] p-1 mr-1"
                  onClick={() => setMobileSidebar(true)}
                >
                  <Icon name="ArrowLeft" size={16} />
                </Button>
                <div className="relative">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: selected.color }}
                  >
                    {selected.avatar}
                  </div>
                  {"status" in selected && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#36393f]"
                      style={{ backgroundColor: STATUS_COLOR[(selected as typeof CONTACTS[0]).status] }}
                    />
                  )}
                </div>
                <div>
                  <span className="text-white font-semibold text-sm">{selected.name}</span>
                  {"members" in selected && (
                    <div className="text-[#8e9297] text-xs">{(selected as typeof GROUPS[0]).members} участников</div>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startCall(false)}
                    className="text-[#b9bbbe] hover:text-white hover:bg-[#40444b] p-2"
                    title="Аудиозвонок"
                  >
                    <Icon name="Phone" size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startCall(true)}
                    className="text-[#b9bbbe] hover:text-white hover:bg-[#40444b] p-2"
                    title="Видеозвонок"
                  >
                    <Icon name="Video" size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-[#b9bbbe] hover:text-white hover:bg-[#40444b] p-2">
                    <Icon name="Search" size={16} />
                  </Button>
                </div>
              </div>

              {/* Активный звонок */}
              {activeCall && (
                <div className="bg-[#1e2124] border-b border-[#202225] px-4 py-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-[#57f287] animate-pulse" />
                    <span className="text-[#57f287] text-sm font-semibold">
                      {activeCall.isVideo ? "Видеозвонок" : "Аудиозвонок"} · {activeCall.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-2 ${isMuted ? "text-[#ed4245] bg-[#ed4245]/20" : "text-[#b9bbbe] hover:text-white hover:bg-[#40444b]"}`}
                  >
                    <Icon name={isMuted ? "MicOff" : "Mic"} size={14} />
                  </Button>
                  {activeCall.isVideo && (
                    <Button variant="ghost" size="sm" className="text-[#b9bbbe] hover:text-white hover:bg-[#40444b] p-2">
                      <Icon name="Video" size={14} />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={endCall}
                    className="bg-[#ed4245] hover:bg-[#c03537] text-white h-7 px-3 text-xs"
                  >
                    <Icon name="PhoneOff" size={13} className="mr-1" />
                    Завершить
                  </Button>
                </div>
              )}

              {/* Сообщения */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(messages[selectedId!] || []).map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.self ? "flex-row-reverse" : ""}`}>
                    {!msg.self && (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5"
                        style={{ backgroundColor: selected.color }}
                      >
                        {selected.avatar}
                      </div>
                    )}
                    <div className={`max-w-[70%] ${msg.self ? "items-end" : "items-start"} flex flex-col`}>
                      {!msg.self && (
                        <span className="text-[#00b0f4] text-xs font-semibold mb-1">{msg.from}</span>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm ${msg.self ? "bg-[#5865f2] text-white rounded-tr-sm" : "bg-[#2f3136] text-[#dcddde] rounded-tl-sm"}`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[#72767d] text-xs mt-1">{msg.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Поле ввода */}
              <div className="p-3 bg-[#36393f]">
                <div className="flex items-center gap-2 bg-[#40444b] rounded-lg px-3 py-2">
                  <Button variant="ghost" size="sm" className="text-[#b9bbbe] hover:text-white p-1 h-auto">
                    <Icon name="Plus" size={16} />
                  </Button>
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
                  <Button
                    size="sm"
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="bg-[#5865f2] hover:bg-[#4752c4] text-white h-7 w-7 p-0 rounded"
                  >
                    <Icon name="Send" size={13} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-20 h-20 bg-[#5865f2]/20 rounded-full flex items-center justify-center mb-4">
                <Icon name="MessageCircle" size={36} className="text-[#5865f2]" />
              </div>
              <h2 className="text-white text-xl font-bold mb-2">Выберите, кому написать</h2>
              <p className="text-[#8e9297] text-sm">Выберите контакт слева или создайте новую группу</p>
            </div>
          )}
        </div>
      </div>

      {/* Модалка создания группы */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#36393f] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-white text-lg font-bold mb-1">Создать группу</h2>
            <p className="text-[#8e9297] text-sm mb-4">Введите название для вашей группы</p>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Название группы..."
              className="bg-[#40444b] border-none text-white placeholder:text-[#8e9297] mb-4"
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowNewGroup(false)}
                className="flex-1 text-[#b9bbbe] hover:text-white hover:bg-[#40444b]"
              >
                Отмена
              </Button>
              <Button
                onClick={createGroup}
                disabled={!newGroupName.trim()}
                className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white"
              >
                Создать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
