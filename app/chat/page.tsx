"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@/hooks/useUser";
import Link from "next/link";
import {
  MessageCircle,
  Plus,
  Search,
  Settings,
  Code2,
  Send,
  Paperclip,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Share2,
  Sparkles,
  Image as ImageIcon,
  Mic,
  StopCircle,
  PanelLeftClose,
  PanelLeft,
  Download,
  RefreshCw,
  Zap,
  Bot,
  User,
  ArrowUp,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@hanzo/ui";
import { Input } from "@hanzo/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@hanzo/ui";
import { ScrollArea } from "@hanzo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@hanzo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hanzo/ui";
import { Textarea } from "@hanzo/ui";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  attachments?: string[];
  model?: string;
  isStreaming?: boolean;
  error?: boolean;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
}

export default function ChatPage() {
  const { user } = useUser();
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      title: "React Performance Optimization",
      messages: [
        {
          id: "1",
          role: "user",
          content: "What are the best practices for optimizing React app performance?",
          timestamp: new Date(Date.now() - 3600000),
        },
        {
          id: "2",
          role: "assistant",
          content: "Here are key strategies for optimizing React performance:\n\n1. **Code Splitting & Lazy Loading**\n   - Use React.lazy() and Suspense for route-based splitting\n   - Implement dynamic imports for heavy components\n\n2. **Memoization Techniques**\n   - Use React.memo() for expensive components\n   - Apply useMemo() for costly computations\n   - Utilize useCallback() for function references\n\n3. **Virtual List Rendering**\n   - Implement react-window or react-virtualized for long lists\n   - Only render visible items in viewport\n\n4. **State Management**\n   - Keep state as local as possible\n   - Use context API judiciously\n   - Consider state management libraries for complex apps\n\n5. **Bundle Optimization**\n   - Tree shaking and dead code elimination\n   - Minimize bundle size with tools like webpack-bundle-analyzer\n\nWould you like me to elaborate on any of these techniques?",
          timestamp: new Date(Date.now() - 3500000),
          model: "Claude 3.5 Sonnet"
        }
      ],
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 3500000),
      model: "Claude 3.5 Sonnet"
    },
    {
      id: "2",
      title: "TypeScript Best Practices",
      messages: [],
      createdAt: new Date(Date.now() - 172800000),
      updatedAt: new Date(Date.now() - 172800000),
      model: "GPT-4"
    },
    {
      id: "3",
      title: "Building a REST API",
      messages: [],
      createdAt: new Date(Date.now() - 259200000),
      updatedAt: new Date(Date.now() - 259200000),
      model: "Claude 3.5 Sonnet"
    }
  ]);

  const [activeChat, setActiveChat] = useState<Chat | null>(chats[0]);
  const [inputMessage, setInputMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedModel, setSelectedModel] = useState("Claude 3.5 Sonnet");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputMessage]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !activeChat || isStreaming) return;

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
    setIsStreaming(true);

    // Simulate streaming AI response
    const aiResponse: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      model: selectedModel,
      isStreaming: true
    };

    const chatWithStreamingResponse = {
      ...updatedChat,
      messages: [...updatedChat.messages, aiResponse],
      updatedAt: new Date(),
    };

    setActiveChat(chatWithStreamingResponse);
    setChats(prev => prev.map(c => c.id === activeChat.id ? chatWithStreamingResponse : c));

    // Simulate streaming text
    const fullResponse = `I'll help you with "${inputMessage}". Here's a comprehensive response:\n\nThis is a simulated streaming response that demonstrates how the chat interface handles real-time message updates. The text appears gradually, creating a more engaging user experience.\n\nKey points to consider:\n- Real-time streaming improves perceived performance\n- Users can see the response forming\n- Creates a more interactive experience`;

    let currentText = "";
    const words = fullResponse.split(" ");
    let wordIndex = 0;

    const streamInterval = setInterval(() => {
      if (wordIndex < words.length) {
        currentText += (wordIndex > 0 ? " " : "") + words[wordIndex];
        wordIndex++;

        const updatedResponse = {
          ...aiResponse,
          content: currentText
        };

        const chatWithUpdatedResponse = {
          ...chatWithStreamingResponse,
          messages: [...updatedChat.messages, updatedResponse],
          updatedAt: new Date(),
        };

        setActiveChat(chatWithUpdatedResponse);
        setChats(prev => prev.map(c => c.id === activeChat.id ? chatWithUpdatedResponse : c));
      } else {
        clearInterval(streamInterval);
        setIsStreaming(false);

        // Final update to mark streaming as complete
        const finalResponse = {
          ...aiResponse,
          content: currentText,
          isStreaming: false
        };

        const finalChat = {
          ...chatWithStreamingResponse,
          messages: [...updatedChat.messages, finalResponse],
          updatedAt: new Date(),
        };

        setActiveChat(finalChat);
        setChats(prev => prev.map(c => c.id === activeChat.id ? finalChat : c));
      }
    }, 50);
  };

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      model: selectedModel
    };

    setChats([newChat, ...chats]);
    setActiveChat(newChat);
  };

  const deleteChat = (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChat?.id === chatId) {
      setActiveChat(chats.find(c => c.id !== chatId) || null);
    }
  };

  const duplicateChat = (chatId: string) => {
    const chatToDuplicate = chats.find(c => c.id === chatId);
    if (chatToDuplicate) {
      const newChat: Chat = {
        ...chatToDuplicate,
        id: Date.now().toString(),
        title: `${chatToDuplicate.title} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setChats([newChat, ...chats]);
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  // Filter chats based on search
  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort chats by date
  const sortedChats = [...filteredChats].sort((a, b) =>
    b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-screen flex bg-black">
      {/* Sidebar */}
      <div className={cn(
        "flex flex-col bg-neutral-950 border-r border-neutral-800 transition-all duration-200",
        sidebarCollapsed ? "w-0 overflow-hidden" : "w-64"
      )}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-neutral-800">
          <Button
            onClick={createNewChat}
            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 justify-start gap-2"
          >
            <Plus className="w-4 h-4" />
            New chat
          </Button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="pl-9 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sortedChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-all group relative",
                  activeChat?.id === chat.id
                    ? "bg-neutral-800 text-white"
                    : "hover:bg-neutral-900 text-neutral-400 hover:text-white"
                )}
              >
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {formatRelativeTime(chat.updatedAt)}
                    </p>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => duplicateChat(chat.id)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteChat(chat.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="border-b border-neutral-800 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="text-neutral-400 hover:text-white"
              >
                {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </Button>
              <div className="flex items-center gap-2">
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-[200px] bg-neutral-900 border-neutral-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700">
                    <SelectItem value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="Claude 3.5 Haiku">Claude 3.5 Haiku</SelectItem>
                    <SelectItem value="GPT-4">GPT-4</SelectItem>
                    <SelectItem value="GPT-4 Turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="Gemini Pro">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  <Zap className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/playground">
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  <Code2 className="w-4 h-4 mr-2" />
                  Playground
                </Button>
              </Link>
              <Link href="/agents">
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  <Bot className="w-4 h-4 mr-2" />
                  Agents
                </Button>
              </Link>
              <Link href="/integrations">
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {activeChat ? (
              <div className="space-y-6">
                {activeChat.messages.map((message, index) => (
                  <div key={message.id} className="group">
                    <div className="flex gap-4">
                      {message.role === "assistant" ? (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">H</span>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-neutral-300" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {message.role === "assistant" ? "Hanzo" : "You"}
                          </span>
                          {message.model && (
                            <span className="text-xs text-neutral-500">{message.model}</span>
                          )}
                          <span className="text-xs text-neutral-500">
                            {formatRelativeTime(message.timestamp)}
                          </span>
                        </div>
                        <div className="text-neutral-200 prose prose-invert max-w-none">
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {message.isStreaming && (
                            <span className="inline-block w-2 h-4 ml-1 bg-purple-500 animate-pulse" />
                          )}
                        </div>
                        {message.role === "assistant" && !message.isStreaming && (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-neutral-400 hover:text-white"
                              onClick={() => copyMessage(message.content)}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-neutral-400 hover:text-white">
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Regenerate
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-neutral-400 hover:text-white">
                              <Share2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-4xl">H</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Welcome to Hanzo Chat</h2>
                  <p className="text-neutral-400 max-w-md">
                    Start a new chat or select an existing one to continue your conversation
                  </p>
                  <Button onClick={createNewChat} className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Chat
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        {activeChat && (
          <div className="border-t border-neutral-800 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-3">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                    <Mic className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputMessage(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Message Hanzo..."
                    className="min-h-[44px] max-h-[200px] bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 resize-none pr-12"
                    rows={1}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isStreaming}
                    size="sm"
                    className="absolute right-2 bottom-2 h-8 w-8 p-0 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isStreaming ? (
                      <StopCircle className="w-4 h-4" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-neutral-500">
                  {isStreaming ? "Generating..." : "Press Enter to send, Shift+Enter for new line"}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-neutral-500 hover:text-white">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Enhance prompt
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}