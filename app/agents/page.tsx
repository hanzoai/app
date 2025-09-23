"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Play,
  Pause,
  StopCircle,
  RefreshCw,
  Terminal,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Download,
  Trash2,
  MoreHorizontal,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Zap,
  Code2,
  FileText,
  GitBranch,
  Package,
  Database,
  Shield,
  Eye,
  Copy
} from "lucide-react";
import { Button } from "@hanzo/ui";
import { Input } from "@hanzo/ui";
import { Badge } from "@hanzo/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hanzo/ui";
import { Progress } from "@hanzo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@hanzo/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@hanzo/ui";
import { HanzoLogo } from "@/components/HanzoLogo";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface AgentTask {
  id: string;
  name: string;
  type: "code-generation" | "testing" | "deployment" | "analysis" | "build" | "security";
  status: "queued" | "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  agent: string;
  priority: "low" | "medium" | "high" | "critical";
  queuePosition?: number;
  assignedNode?: string;
  startTime?: Date;
  endTime?: Date;
  estimatedTime?: number;
  output?: string;
  error?: string;
  resources: {
    cpu: number;
    memory: number;
    network: number;
  };
  subtasks?: SubTask[];
  logs: LogEntry[];
}

interface SubTask {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
}

interface LogEntry {
  timestamp: Date;
  level: "info" | "warning" | "error" | "debug";
  message: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Mock data with queue management
  const [queuedTasks, setQueuedTasks] = useState<AgentTask[]>([
    {
      id: "queue-1",
      name: "Optimize Database Queries",
      type: "analysis",
      status: "queued",
      progress: 0,
      agent: "Optimizer-Agent-04",
      priority: "medium",
      queuePosition: 1,
      estimatedTime: 25,
      resources: { cpu: 0, memory: 0, network: 0 },
      logs: [
        { timestamp: new Date(), level: "info", message: "Task queued, waiting for available node" }
      ]
    },
    {
      id: "queue-2",
      name: "Generate API Documentation",
      type: "code-generation",
      status: "queued",
      progress: 0,
      agent: "DocGen-Agent-02",
      priority: "low",
      queuePosition: 2,
      estimatedTime: 15,
      resources: { cpu: 0, memory: 0, network: 0 },
      logs: [
        { timestamp: new Date(), level: "info", message: "Task queued, position #2" }
      ]
    },
    {
      id: "queue-3",
      name: "Build Docker Images",
      type: "build",
      status: "queued",
      priority: "high",
      queuePosition: 3,
      progress: 0,
      agent: "Builder-Agent-01",
      estimatedTime: 30,
      resources: { cpu: 0, memory: 0, network: 0 },
      logs: [
        { timestamp: new Date(), level: "info", message: "Task queued, waiting for build resources" }
      ]
    }
  ]);

  const [tasks, setTasks] = useState<AgentTask[]>([
    {
      id: "task-1",
      name: "Generate React Dashboard Components",
      type: "code-generation",
      status: "running",
      progress: 65,
      agent: "CodeGen-Agent-01",
      priority: "high",
      assignedNode: "node-gpu-01",
      startTime: new Date(Date.now() - 1000 * 60 * 5),
      estimatedTime: 10,
      resources: { cpu: 45, memory: 62, network: 15 },
      subtasks: [
        { id: "sub-1", name: "Generate layout components", status: "completed", progress: 100 },
        { id: "sub-2", name: "Create data visualization widgets", status: "running", progress: 60 },
        { id: "sub-3", name: "Build form components", status: "pending", progress: 0 }
      ],
      logs: [
        { timestamp: new Date(Date.now() - 1000 * 60 * 5), level: "info", message: "Task initialized" },
        { timestamp: new Date(Date.now() - 1000 * 60 * 4), level: "info", message: "Analyzing requirements..." },
        { timestamp: new Date(Date.now() - 1000 * 60 * 3), level: "info", message: "Generating layout components" },
        { timestamp: new Date(Date.now() - 1000 * 60 * 2), level: "info", message: "Layout components completed" },
        { timestamp: new Date(Date.now() - 1000 * 60), level: "info", message: "Creating visualization widgets..." }
      ]
    },
    {
      id: "task-2",
      name: "Run Integration Tests",
      type: "testing",
      status: "completed",
      progress: 100,
      agent: "Test-Runner-02",
      priority: "medium",
      assignedNode: "node-cpu-03",
      startTime: new Date(Date.now() - 1000 * 60 * 30),
      endTime: new Date(Date.now() - 1000 * 60 * 10),
      resources: { cpu: 20, memory: 35, network: 5 },
      output: "All 156 tests passed successfully",
      logs: [
        { timestamp: new Date(Date.now() - 1000 * 60 * 30), level: "info", message: "Starting test suite" },
        { timestamp: new Date(Date.now() - 1000 * 60 * 25), level: "info", message: "Running unit tests" },
        { timestamp: new Date(Date.now() - 1000 * 60 * 20), level: "info", message: "Running integration tests" },
        { timestamp: new Date(Date.now() - 1000 * 60 * 15), level: "info", message: "All tests passed" }
      ]
    },
    {
      id: "task-3",
      name: "Security Vulnerability Scan",
      type: "security",
      status: "running",
      progress: 30,
      agent: "Security-Scanner-01",
      priority: "critical",
      assignedNode: "node-security-01",
      startTime: new Date(Date.now() - 1000 * 60 * 2),
      estimatedTime: 15,
      resources: { cpu: 60, memory: 45, network: 80 },
      logs: [
        { timestamp: new Date(Date.now() - 1000 * 60 * 2), level: "info", message: "Initiating security scan" },
        { timestamp: new Date(Date.now() - 1000 * 60), level: "warning", message: "Scanning dependencies for vulnerabilities" }
      ]
    },
    {
      id: "task-4",
      name: "Deploy to Production",
      type: "deployment",
      status: "pending",
      progress: 0,
      agent: "Deploy-Agent-03",
      priority: "high",
      estimatedTime: 20,
      resources: { cpu: 0, memory: 0, network: 0 },
      logs: [
        { timestamp: new Date(), level: "info", message: "Waiting for security scan completion" }
      ]
    },
    {
      id: "task-5",
      name: "Code Analysis and Optimization",
      type: "analysis",
      status: "failed",
      progress: 85,
      agent: "Analyzer-Agent-02",
      priority: "low",
      startTime: new Date(Date.now() - 1000 * 60 * 45),
      endTime: new Date(Date.now() - 1000 * 60 * 15),
      error: "Memory limit exceeded during AST parsing",
      resources: { cpu: 10, memory: 95, network: 2 },
      logs: [
        { timestamp: new Date(Date.now() - 1000 * 60 * 45), level: "info", message: "Starting code analysis" },
        { timestamp: new Date(Date.now() - 1000 * 60 * 30), level: "info", message: "Analyzing code patterns" },
        { timestamp: new Date(Date.now() - 1000 * 60 * 15), level: "error", message: "Memory limit exceeded" }
      ]
    }
  ]);

  const allTasks = [...queuedTasks, ...tasks];

  const taskStats = {
    total: allTasks.length,
    queued: queuedTasks.length,
    running: tasks.filter(t => t.status === "running").length,
    completed: tasks.filter(t => t.status === "completed").length,
    failed: tasks.filter(t => t.status === "failed").length,
    pending: tasks.filter(t => t.status === "pending").length
  };

  const availableNodes = 5;
  const maxConcurrency = 3;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "text-blue-500";
      case "completed": return "text-green-500";
      case "failed": return "text-red-500";
      case "cancelled": return "text-gray-500";
      case "pending": return "text-yellow-500";
      case "queued": return "text-purple-500";
      default: return "text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running": return <Loader2 className="w-4 h-4 animate-spin" />;
      case "completed": return <CheckCircle2 className="w-4 h-4" />;
      case "failed": return <XCircle className="w-4 h-4" />;
      case "cancelled": return <XCircle className="w-4 h-4" />;
      case "pending": return <Clock className="w-4 h-4" />;
      case "queued": return <Activity className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "code-generation": return <Code2 className="w-4 h-4" />;
      case "testing": return <FileText className="w-4 h-4" />;
      case "deployment": return <Package className="w-4 h-4" />;
      case "analysis": return <Eye className="w-4 h-4" />;
      case "build": return <GitBranch className="w-4 h-4" />;
      case "security": return <Shield className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const filteredTasks = allTasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.agent.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || task.status === selectedStatus;
    const matchesType = selectedType === "all" || task.type === selectedType;
    return matchesSearch && matchesStatus && matchesType;
  });

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        // Simulate task progress updates
        setTasks(prev => prev.map(task => {
          if (task.status === "running" && task.progress < 100) {
            return {
              ...task,
              progress: Math.min(100, task.progress + Math.random() * 10)
            };
          }
          return task;
        }));
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <HanzoLogo className="w-8 h-8 text-purple-500" />
                <span className="text-xl font-bold text-white">Agents</span>
              </Link>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Activity className="w-3 h-3" />
                  {taskStats.running} Running
                </Badge>
                <Badge variant="outline" className="gap-1 border-purple-500/50 text-purple-400">
                  <Clock className="w-3 h-3" />
                  {taskStats.queued} Queued
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Zap className="w-3 h-3" />
                  {taskStats.running}/{maxConcurrency} Slots
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/nodes">
                <Button variant="outline" className="gap-2">
                  <Network className="w-4 h-4" />
                  View Nodes
                </Button>
              </Link>
              <Link href="/dev">
                <Button variant="outline" className="gap-2">
                  <Code2 className="w-4 h-4" />
                  Dev Mode
                </Button>
              </Link>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} />
                Auto-refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* Queue Status */}
        {taskStats.queued > 0 && (
          <Card className="bg-gradient-to-r from-purple-900/20 to-purple-800/10 border-purple-500/30 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Queue Status</CardTitle>
                  <CardDescription className="mt-1">
                    {taskStats.queued} tasks waiting • {availableNodes} nodes available • Max {maxConcurrency} concurrent tasks
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Est. wait time</p>
                    <p className="text-lg font-bold text-purple-400">~{Math.ceil(taskStats.queued * 5 / maxConcurrency)} min</p>
                  </div>
                  <Button variant="outline" className="gap-2">
                    <Zap className="w-4 h-4" />
                    Scale Up
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{taskStats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-purple-400">Queued</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-400">{taskStats.queued}</p>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-400">Running</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-400">{taskStats.running}</p>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-400">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">{taskStats.completed}</p>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-400">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-400">{taskStats.failed}</p>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-yellow-400">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-400">{taskStats.pending}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search tasks or agents..."
              className="pl-10 bg-neutral-900 border-neutral-800"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Status: {selectedStatus === "all" ? "All" : selectedStatus}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedStatus("all")}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("queued")}>Queued</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("running")}>Running</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("completed")}>Completed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("failed")}>Failed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("pending")}>Pending</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Type: {selectedType === "all" ? "All" : selectedType}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedType("all")}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType("code-generation")}>Code Generation</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType("testing")}>Testing</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType("deployment")}>Deployment</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType("analysis")}>Analysis</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType("security")}>Security</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredTasks.map(task => (
            <Card key={task.id} className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleTaskExpansion(task.id)}
                      className="mt-1"
                    >
                      {expandedTasks.has(task.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(task.type)}
                        <CardTitle className="text-lg text-white">{task.name}</CardTitle>
                        <Badge
                          variant={task.priority === "critical" ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {task.priority}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Terminal className="w-3 h-3" />
                          {task.agent}
                        </span>
                        {task.assignedNode && (
                          <span className="flex items-center gap-1">
                            <Network className="w-3 h-3" />
                            {task.assignedNode}
                          </span>
                        )}
                        {task.queuePosition && (
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Queue #{task.queuePosition}
                          </span>
                        )}
                        {task.startTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Started {new Date(task.startTime).toLocaleTimeString()}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={cn("flex items-center gap-1", getStatusColor(task.status))}>
                      {getStatusIcon(task.status)}
                      <span className="text-sm font-medium capitalize">{task.status}</span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {task.status === "running" && (
                          <>
                            <DropdownMenuItem>
                              <Pause className="w-4 h-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500">
                              <StopCircle className="w-4 h-4 mr-2" />
                              Stop
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {task.status === "failed" && (
                          <>
                            <DropdownMenuItem>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Retry
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Task ID
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="w-4 h-4 mr-2" />
                          Export Logs
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-500">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Progress Bar */}
                {task.status === "running" && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">Progress</span>
                      <span className="text-sm text-gray-400">{Math.round(task.progress)}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                  </div>
                )}

                {/* Resource Usage */}
                <div className="mt-4 flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">CPU: {task.resources.cpu}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Memory: {task.resources.memory}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Network: {task.resources.network}%</span>
                  </div>
                </div>
              </CardHeader>

              {expandedTasks.has(task.id) && (
                <CardContent>
                  <Tabs defaultValue="subtasks" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
                      <TabsTrigger value="logs">Logs</TabsTrigger>
                      <TabsTrigger value="output">Output</TabsTrigger>
                    </TabsList>

                    <TabsContent value="subtasks" className="mt-4">
                      {task.subtasks && task.subtasks.length > 0 ? (
                        <div className="space-y-2">
                          {task.subtasks.map(subtask => (
                            <div key={subtask.id} className="flex items-center justify-between p-2 bg-neutral-800 rounded">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(subtask.status)}
                                <span className="text-sm text-gray-300">{subtask.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={subtask.progress} className="h-1 w-20" />
                                <span className="text-xs text-gray-500">{subtask.progress}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No subtasks</p>
                      )}
                    </TabsContent>

                    <TabsContent value="logs" className="mt-4">
                      <div className="bg-neutral-950 rounded p-3 max-h-64 overflow-y-auto font-mono text-xs">
                        {task.logs.map((log, i) => (
                          <div key={i} className="flex gap-2 mb-1">
                            <span className="text-gray-600">{log.timestamp.toLocaleTimeString()}</span>
                            <span className={cn(
                              "uppercase",
                              log.level === "error" && "text-red-500",
                              log.level === "warning" && "text-yellow-500",
                              log.level === "info" && "text-blue-500",
                              log.level === "debug" && "text-gray-500"
                            )}>
                              [{log.level}]
                            </span>
                            <span className="text-gray-300">{log.message}</span>
                          </div>
                        ))}
                        <div ref={logsEndRef} />
                      </div>
                    </TabsContent>

                    <TabsContent value="output" className="mt-4">
                      {task.output ? (
                        <div className="bg-neutral-950 rounded p-3">
                          <pre className="text-sm text-gray-300">{task.output}</pre>
                        </div>
                      ) : task.error ? (
                        <div className="bg-red-950/20 border border-red-900/50 rounded p-3">
                          <pre className="text-sm text-red-400">{task.error}</pre>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No output available yet</p>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}