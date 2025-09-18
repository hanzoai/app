"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@/hooks/useUser";
import Link from "next/link";
import {
  MessageCircle,
  Plus,
  Folder,
  Pin,
  Search,
  Settings,
  Code2,
  Send,
  Paperclip,
  MoreHorizontal,
  Edit2,
  Trash2,
  Star,
  Clock,
  ChevronRight,
  ChevronDown,
  Home,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  attachments?: string[];
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  pinned?: boolean;
  folderId?: string;
}

interface ChatFolder {
  id: string;
  name: string;
  expanded: boolean;
  chats: string[]; // chat IDs
}

export default function ChatPage() {
  const { user, logout } = useUser();
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      title: "Building a SaaS Dashboard",
      messages: [
        {
          id: "1",
          role: "user",
          content: "Help me build a SaaS dashboard with real-time analytics",
          timestamp: new Date(Date.now() - 3600000),
        },
        {
          id: "2",
          role: "assistant",
          content: "I'll help you create a comprehensive SaaS dashboard. Let me break this down into components...",
          timestamp: new Date(Date.now() - 3500000),
        }
      ],
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 3500000),
      pinned: true
    }
  ]);

  const [folders, setFolders] = useState<ChatFolder[]>([
    {
      id: "1",
      name: "Projects",
      expanded: true,
      chats: []
    },
    {
      id: "2",
      name: "Learning",
      expanded: false,
      chats: []
    }
  ]);

  const [activeChat, setActiveChat] = useState<Chat | null>(chats[0]);
  const [inputMessage, setInputMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !activeChat) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    // Update current chat
    const updatedChat = {
      ...activeChat,
      messages: [...activeChat.messages, newMessage],
      updatedAt: new Date(),
    };

    setActiveChat(updatedChat);
    setChats(prev => prev.map(c => c.id === activeChat.id ? updatedChat : c));
    setInputMessage("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I understand you want to " + inputMessage + ". Let me help you with that...",
        timestamp: new Date(),
      };

      const chatWithResponse = {
        ...updatedChat,
        messages: [...updatedChat.messages, aiResponse],
        updatedAt: new Date(),
      };

      setActiveChat(chatWithResponse);
      setChats(prev => prev.map(c => c.id === activeChat.id ? chatWithResponse : c));
      setIsTyping(false);
    }, 1500);
  };

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setChats([newChat, ...chats]);
    setActiveChat(newChat);
  };

  const togglePin = (chatId: string) => {
    setChats(prev => prev.map(c =>
      c.id === chatId ? { ...c, pinned: !c.pinned } : c
    ));
  };

  const deleteChat = (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChat?.id === chatId) {
      setActiveChat(chats.find(c => c.id !== chatId) || null);
    }
  };

  const toggleFolder = (folderId: string) => {
    setFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, expanded: !f.expanded } : f
    ));
  };

  // Filter chats based on search
  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort chats: pinned first, then by date
  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-neutral-900 border-r dark:border-neutral-800 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b dark:border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">H</span>
              </div>
              <span className="font-semibold">Hanzo Chat</span>
            </Link>
            <Button onClick={createNewChat} size="sm" variant="ghost" className="gap-2">
              <Plus className="w-4 h-4" />
              New
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-50 dark:bg-neutral-800 border-0"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Quick Links */}
          <div className="mb-4">
            <Link href="/dev">
              <Button variant="ghost" className="w-full justify-start gap-2 mb-1">
                <Code2 className="w-4 h-4" />
                Hanzo Dev
                <span className="ml-auto text-xs text-gray-500">Build apps</span>
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Home className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
          </div>

          {/* Folders */}
          {folders.map(folder => (
            <div key={folder.id} className="mb-4">
              <button
                onClick={() => toggleFolder(folder.id)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2 w-full"
              >
                {folder.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Folder className="w-4 h-4" />
                {folder.name}
              </button>
              {folder.expanded && folder.chats.length > 0 && (
                <div className="ml-6 space-y-1">
                  {/* Folder chats would go here */}
                </div>
              )}
            </div>
          ))}

          {/* Recent Chats */}
          <div className="mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 px-2">RECENT</p>
            <div className="space-y-1">
              {sortedChats.map(chat => (
                <div
                  key={chat.id}
                  className={cn(
                    "group relative rounded-lg px-3 py-2 cursor-pointer transition-colors",
                    activeChat?.id === chat.id
                      ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                      : "hover:bg-gray-100 dark:hover:bg-neutral-800"
                  )}
                  onClick={() => setActiveChat(chat)}
                >
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{chat.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {chat.pinned && <Pin className="w-3 h-3 text-purple-500" />}
                  </div>

                  {/* Actions */}
                  <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(chat.id);
                      }}
                      className="p-1 hover:bg-white dark:hover:bg-neutral-700 rounded"
                    >
                      <Star className={cn("w-3 h-3", chat.pinned && "fill-current")} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className="p-1 hover:bg-white dark:hover:bg-neutral-700 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Section */}
        <div className="p-4 border-t dark:border-neutral-800">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-gray-500">{user.id}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button className="w-full">Sign In</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white dark:bg-neutral-900 border-b dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">
                {activeChat?.title || "Select a chat"}
              </h1>
              {activeChat && (
                <p className="text-sm text-gray-500">
                  {activeChat.messages.length} messages
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeChat ? (
            <>
              {activeChat.messages.map(message => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">H</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-2xl rounded-lg px-4 py-2",
                      message.role === "user"
                        ? "bg-purple-500 text-white"
                        : "bg-gray-100 dark:bg-neutral-800"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={cn(
                      "text-xs mt-1",
                      message.role === "user" ? "text-purple-200" : "text-gray-500"
                    )}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">H</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-neutral-800 rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">Select a chat to start messaging</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        {activeChat && (
          <div className="bg-white dark:bg-neutral-900 border-t dark:border-neutral-800 p-4">
            <div className="flex items-end gap-2">
              <Button variant="ghost" size="sm">
                <Paperclip className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={1}
                />
              </div>
              <Button onClick={sendMessage} size="sm">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}