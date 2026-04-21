import React, { useReducer, useEffect, useState, useMemo } from "react";
import {
  Play,
  Pause,
  Check,
  Trash2,
  Clock,
  Target,
  BarChart2,
  LayoutGrid,
  Briefcase,
  Sun,
  Moon,
  Plus,
  AlertCircle,
  Search,
  Tag,
  Maximize2,
  X,
  ListTodo,
  Star,
  Calendar,
  RotateCcw,
  ArchiveRestore,
} from "lucide-react";

// --- CONFIG & CONSTANTS ---
const PRIORITIES = {
  UI: {
    id: "UI",
    name: "Срочно & Важно",
    deadlineAdd: 1 * 60 * 60 * 1000,
    color: "bg-red-500",
    text: "text-red-500",
    border: "border-red-500",
    bgSoft: "bg-red-500/10",
  },
  NUI: {
    id: "NUI",
    name: "Не срочно & Важно",
    deadlineAdd: 24 * 60 * 60 * 1000,
    color: "bg-blue-500",
    text: "text-blue-500",
    border: "border-blue-500",
    bgSoft: "bg-blue-500/10",
  },
  UNI: {
    id: "UNI",
    name: "Срочно & Не важно",
    deadlineAdd: 2 * 60 * 60 * 1000,
    color: "bg-orange-500",
    text: "text-orange-500",
    border: "border-orange-500",
    bgSoft: "bg-orange-500/10",
  },
  NUNI: {
    id: "NUNI",
    name: "Не срочно & Не важно",
    deadlineAdd: 48 * 60 * 60 * 1000,
    color: "bg-gray-500",
    text: "text-gray-500",
    border: "border-gray-500",
    bgSoft: "bg-gray-500/10",
  },
};

const INITIAL_STATE = {
  tasks: [],
  theme: "dark",
  activeTab: "today", // today, matrix, greenopg, focus, analytics, completed, trash
  focusTaskId: null,
  notification: null,
  lastDailyGenerationDate: null,
};

// --- REDUCER ---
function appReducer(state, action) {
  switch (action.type) {
    case "INIT_DATA":
      return { ...state, ...action.payload };

    case "ADD_TASK": {
      let newTask = action.payload;
      let notification = state.notification;

      // Checking limit for MIT tasks upon creation
      if (newTask.isMIT) {
        const activeMITs = state.tasks.filter(
          (t) => t.isMIT && t.status !== "completed" && t.status !== "deleted",
        ).length;
        if (activeMITs >= 3) {
          newTask.isMIT = false;
          notification =
            "Максимум 3 главных (MIT) задачи в день! Задача добавлена как обычная.";
        }
      }

      return { ...state, tasks: [...state.tasks, newTask], notification };
    }

    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t,
        ),
      };

    case "DELETE_TASK":
      // Soft delete: move to trash
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload
            ? {
                ...t,
                status: "deleted",
                prevStatus: t.status,
                deletedAt: Date.now(),
              }
            : t,
        ),
        focusTaskId:
          state.focusTaskId === action.payload ? null : state.focusTaskId,
      };

    case "RESTORE_TASK":
      // Restore from trash
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload
            ? { ...t, status: t.prevStatus || "todo", deletedAt: null }
            : t,
        ),
      };

    case "HARD_DELETE_TASK":
      // Permanently remove
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      };

    case "CLEAR_TRASH":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.status !== "deleted"),
      };

    case "CHANGE_STATUS": {
      const { id, status } = action.payload;
      const now = Date.now();
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          let updates = { status };

          if (status === "active") {
            updates.sessionStart = now;
          } else if (status === "paused" || status === "completed") {
            if (t.sessionStart) {
              updates.timeSpent = (t.timeSpent || 0) + (now - t.sessionStart);
              updates.sessionStart = null;
            }
            if (status === "completed") updates.completedAt = now;
          }
          return { ...t, ...updates };
        }),
      };
    }

    case "TOGGLE_MIT": {
      const task = state.tasks.find((t) => t.id === action.payload);
      if (!task) return state;

      if (!task.isMIT) {
        const activeMITs = state.tasks.filter(
          (t) => t.isMIT && t.status !== "completed" && t.status !== "deleted",
        ).length;
        if (activeMITs >= 3) {
          return {
            ...state,
            notification: "Максимум 3 главных (MIT) задачи в день!",
          };
        }
      }

      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload ? { ...t, isMIT: !t.isMIT } : t,
        ),
      };
    }

    case "CLEAR_NOTIFICATION":
      return { ...state, notification: null };

    case "SET_TAB":
      return { ...state, activeTab: action.payload };

    case "TOGGLE_THEME":
      return { ...state, theme: state.theme === "dark" ? "light" : "dark" };

    case "SET_FOCUS":
      return {
        ...state,
        focusTaskId: action.payload,
        activeTab: action.payload ? "focus" : state.activeTab,
      };

    default:
      return state;
  }
}

// --- UTILS ---
const formatTime = (ms) => {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h > 0 ? h + "ч " : ""}${m}м ${s}с`;
};

const detectKeywords = (text) => {
  const t = text.toLowerCase();
  if (t.includes("срочно") && t.includes("важно")) return "UI";
  if (t.includes("срочно")) return "UNI";
  if (t.includes("важно")) return "NUI";
  return "NUI"; // default
};

// --- ISOLATED COMPONENTS ---

const Sidebar = ({ state, dispatch }) => {
  const navItems = [
    { id: "today", icon: ListTodo, label: "Сегодня" },
    { id: "matrix", icon: LayoutGrid, label: "Матрица Эйзенхауэра" },
    { id: "greenopg", icon: Briefcase, label: "GreenOPG (CRM)" },
    { id: "focus", icon: Target, label: "Режим Фокуса" },
    { id: "analytics", icon: BarChart2, label: "Аналитика" },
    { id: "completed", icon: Check, label: "Завершенные" },
    { id: "trash", icon: Trash2, label: "Корзина" },
  ];

  return (
    <aside
      className={`w-64 flex-shrink-0 border-r flex flex-col transition-colors duration-200
      ${state.theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-gray-50 border-gray-200 text-gray-600"}`}
    >
      <div className="p-6 font-bold text-xl flex items-center gap-3">
        <Target className="text-blue-500" />
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
          SmartTasker
        </span>
      </div>
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => dispatch({ type: "SET_TAB", payload: item.id })}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium
              ${
                state.activeTab === item.id
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                  : "hover:bg-slate-800/50 hover:text-blue-400"
              }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800/50">
        <button
          onClick={() => dispatch({ type: "TOGGLE_THEME" })}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-colors"
        >
          {state.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span>{state.theme === "dark" ? "Светлая тема" : "Темная тема"}</span>
        </button>
      </div>
    </aside>
  );
};

const TaskInput = ({ category = "general", theme, dispatch }) => {
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("NUI");
  const [tags, setTags] = useState("");
  const [isMIT, setIsMIT] = useState(false);

  const [gSub, setGSub] = useState("Аннуляция");
  const [gUR, setGUR] = useState("Доп.часы");
  const [crmAssignee, setCrmAssignee] = useState("");
  const [crmCaseId, setCrmCaseId] = useState("");

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (val.length > 5) {
      const suggested = detectKeywords(val);
      if (suggested !== priority) setPriority(suggested);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newTask = {
      id: crypto.randomUUID(),
      text,
      category,
      priority,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: Date.now(),
      deadline: Date.now() + PRIORITIES[priority].deadlineAdd,
      status: "todo",
      timeSpent: 0,
      isMIT: isMIT,
      gopgSubcategory: category === "greenOPG" ? gSub : null,
      gopgURType: category === "greenOPG" && gSub === "UR" ? gUR : null,
      crmAssignee: category === "greenOPG" ? crmAssignee : null,
      crmCaseId: category === "greenOPG" ? crmCaseId : null,
    };

    dispatch({ type: "ADD_TASK", payload: newTask });
    setText("");
    setTags("");
    setCrmAssignee("");
    setCrmCaseId("");
    setIsMIT(false);
  };

  return (
    <form
      onSubmit={handleAdd}
      className={`p-5 rounded-2xl border mb-6 shadow-sm transition-colors
      ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"}`}
    >
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          placeholder={
            category === "greenOPG"
              ? "Новая заявка/задача..."
              : "Что нужно сделать? (напишите 'срочно' для авто-приоритета)"
          }
          className={`flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
            ${theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-gray-50 border-gray-300 text-gray-900"}`}
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Добавить</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-center text-sm">
        <button
          type="button"
          onClick={() => setIsMIT(!isMIT)}
          title="Сделать главной задачей дня (MIT)"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500
            ${
              isMIT
                ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                : theme === "dark"
                  ? "bg-slate-900 border-slate-700 text-gray-400 hover:text-yellow-500 hover:bg-slate-800"
                  : "bg-white border-gray-300 text-gray-500 hover:text-yellow-500 hover:bg-gray-50"
            }`}
        >
          <Star size={16} fill={isMIT ? "currentColor" : "none"} />
          MIT
        </button>

        <div className="hidden sm:block h-6 w-px bg-gray-500/30"></div>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={`px-3 py-2 rounded-lg border focus:outline-none ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-gray-300"}`}
        >
          {Object.values(PRIORITIES).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div
          className={`flex items-center gap-2 border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all
          ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-gray-300"}`}
        >
          <Tag size={16} className="text-gray-400" />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Теги (через запятую)"
            className="bg-transparent focus:outline-none w-32"
          />
        </div>

        {category === "greenOPG" && (
          <>
            <div className="hidden md:block h-6 w-px bg-gray-500/30"></div>
            <select
              value={gSub}
              onChange={(e) => setGSub(e.target.value)}
              className={`px-3 py-2 rounded-lg border focus:outline-none ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-gray-300"}`}
            >
              <option value="Аннуляция">Аннуляция</option>
              <option value="UR">UR</option>
            </select>
            {gSub === "UR" && (
              <select
                value={gUR}
                onChange={(e) => setGUR(e.target.value)}
                className={`px-3 py-2 rounded-lg border focus:outline-none ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-gray-300"}`}
              >
                <option value="Доп.часы">Доп.часы</option>
                <option value="Отработки">Отработки</option>
              </select>
            )}
            <input
              type="text"
              value={crmCaseId}
              onChange={(e) => setCrmCaseId(e.target.value)}
              placeholder="Case ID"
              className={`px-3 py-2 rounded-lg border focus:outline-none w-24 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-gray-300"}`}
            />
            <input
              type="text"
              value={crmAssignee}
              onChange={(e) => setCrmAssignee(e.target.value)}
              placeholder="Ответственный"
              className={`px-3 py-2 rounded-lg border focus:outline-none w-32 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-gray-300"}`}
            />
          </>
        )}
      </div>
    </form>
  );
};

const TaskCard = ({ task, mini = false, theme, now, dispatch }) => {
  const prio = PRIORITIES[task.priority];
  const isRunning = task.status === "active";
  const isCompleted = task.status === "completed";
  const isDeleted = task.status === "deleted";

  let displayTime = task.timeSpent || 0;
  if (isRunning && task.sessionStart) {
    displayTime += now - task.sessionStart;
  }

  const timeLeft = task.deadline - now;
  const isOverdue = timeLeft < 0 && !isCompleted && !isDeleted;
  const isWarning =
    timeLeft > 0 && timeLeft < 15 * 60 * 1000 && !isCompleted && !isDeleted;

  // Format Completed Timestamps
  let compDate = "",
    compTime = "";
  if (isCompleted && task.completedAt) {
    const d = new Date(task.completedAt);
    compDate = d.toISOString().split("T")[0]; // YYYY-MM-DD
    compTime = d.toTimeString().slice(0, 5); // HH:MM
  }

  return (
    <div
      className={`relative flex flex-col p-4 rounded-xl border transition-all duration-300 w-full overflow-hidden
      ${theme === "dark" ? "bg-slate-800/80 border-slate-700" : "bg-white border-gray-200"}
      ${isWarning ? "shadow-[0_0_15px_rgba(239,68,68,0.3)] border-red-400/50" : task.isMIT && !isCompleted && !isDeleted ? "shadow-[0_0_15px_rgba(234,179,8,0.2)] border-yellow-500/50" : "hover:shadow-md"}
      ${mini ? "p-3 text-sm" : ""}
      ${isDeleted ? "opacity-70" : ""}
    `}
    >
      {isWarning && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      )}

      {/* HEADER: Badges and Timer */}
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${prio.bgSoft} ${prio.text}`}
          >
            {prio.name}
          </span>
          {task.isMIT && (
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 flex items-center gap-1">
              <Star size={10} fill="currentColor" /> MIT
            </span>
          )}
          {task.category === "greenOPG" && (
            <span className="text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              GreenOPG {task.gopgSubcategory}{" "}
              {task.gopgURType ? `(${task.gopgURType})` : ""}
            </span>
          )}
          {isDeleted && task.deletedAt && (
            <span className="text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
              Удалено: {new Date(task.deletedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {!mini && !isCompleted && !isDeleted && (
          <div
            className={`text-sm font-mono flex items-center flex-shrink-0 gap-1
            ${isOverdue ? "text-red-500" : isWarning ? "text-orange-500" : "text-gray-400"}`}
          >
            <Clock size={14} />
            {isOverdue ? "Просрочено" : formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* BODY: Task Text and Meta Data */}
      <div className="w-full break-words mt-1 mb-2 flex-1">
        <h3
          className={`font-medium text-base leading-snug ${isCompleted || isDeleted ? "line-through opacity-60" : ""} ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          {task.text}
        </h3>

        {task.category === "greenOPG" &&
          (task.crmCaseId || task.crmAssignee) && (
            <div className="mt-2 text-xs flex gap-3 text-gray-500">
              {task.crmCaseId && <span>Case: #{task.crmCaseId}</span>}
              {task.crmAssignee && <span>Отв: {task.crmAssignee}</span>}
            </div>
          )}

        {task.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Completed Timestamp Info Block */}
        {isCompleted && task.completedAt && (
          <div className="mt-3 inline-flex flex-wrap items-center gap-3 text-xs font-medium text-emerald-500/90 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} /> {compDate}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} /> {compTime}
            </div>
            <div className="flex items-center gap-1.5 opacity-80">
              <Play size={14} /> Длительность: {formatTime(task.timeSpent || 0)}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER: Action Buttons */}
      {!mini && (
        <div className="flex flex-wrap items-center justify-end gap-2 mt-auto pt-3 border-t border-gray-500/20">
          {/* Actions for ACTIVE tasks */}
          {!isCompleted && !isDeleted && (
            <>
              <button
                onClick={() =>
                  dispatch({ type: "TOGGLE_MIT", payload: task.id })
                }
                title={
                  task.isMIT
                    ? "Убрать из главных (MIT)"
                    : "Сделать главной задачей (MIT)"
                }
                className={`p-2 rounded-lg transition-colors ${task.isMIT ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30" : "bg-gray-500/10 text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/10"}`}
              >
                <Star size={16} fill={task.isMIT ? "currentColor" : "none"} />
              </button>

              {isRunning ? (
                <button
                  onClick={() =>
                    dispatch({
                      type: "CHANGE_STATUS",
                      payload: { id: task.id, status: "paused" },
                    })
                  }
                  className="p-2 rounded-lg bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 transition-colors"
                >
                  <Pause size={16} />
                </button>
              ) : (
                <button
                  onClick={() =>
                    dispatch({
                      type: "CHANGE_STATUS",
                      payload: { id: task.id, status: "active" },
                    })
                  }
                  className="p-2 rounded-lg bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors"
                >
                  <Play size={16} />
                </button>
              )}

              <button
                onClick={() =>
                  dispatch({ type: "SET_FOCUS", payload: task.id })
                }
                title="Режим фокуса"
                className="p-2 rounded-lg bg-purple-500/20 text-purple-500 hover:bg-purple-500/30 transition-colors"
              >
                <Maximize2 size={16} />
              </button>

              <button
                onClick={() =>
                  dispatch({
                    type: "CHANGE_STATUS",
                    payload: { id: task.id, status: "completed" },
                  })
                }
                className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition-colors"
              >
                <Check size={16} />
              </button>

              <button
                onClick={() =>
                  dispatch({ type: "DELETE_TASK", payload: task.id })
                }
                title="Удалить (в корзину)"
                className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}

          {/* Actions for COMPLETED tasks */}
          {isCompleted && (
            <button
              onClick={() =>
                dispatch({ type: "DELETE_TASK", payload: task.id })
              }
              title="Удалить (в корзину)"
              className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}

          {/* Actions for DELETED tasks (Trash Mode) */}
          {isDeleted && (
            <>
              <button
                onClick={() =>
                  dispatch({ type: "RESTORE_TASK", payload: task.id })
                }
                className="px-3 py-2 rounded-lg bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <RotateCcw size={16} /> Восстановить
              </button>
              <button
                onClick={() =>
                  dispatch({ type: "HARD_DELETE_TASK", payload: task.id })
                }
                className="px-3 py-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Trash2 size={16} /> Удалить навсегда
              </button>
            </>
          )}
        </div>
      )}

      {/* Progress bar visual */}
      {isRunning && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-blue-500 animate-pulse rounded-b-xl"
          style={{
            width: `${Math.min(100, (displayTime / (2 * 60 * 60 * 1000)) * 100)}%`,
          }}
        ></div>
      )}
    </div>
  );
};

// --- VIEWS ---

const TodayView = ({ activeTasks, theme, now, dispatch, searchQuery }) => {
  let filtered = activeTasks.filter((t) =>
    t.text.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const manualMITs = filtered.filter((t) => t.isMIT);
  const hasManualMITs = manualMITs.length > 0;

  const displayMITs = hasManualMITs
    ? manualMITs
    : [...filtered].sort((a, b) => a.deadline - b.deadline).slice(0, 3);

  const regularTasks = filtered.filter(
    (t) => !displayMITs.some((mit) => mit.id === t.id),
  );

  return (
    <div className="space-y-6">
      <TaskInput theme={theme} dispatch={dispatch} />

      {displayMITs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
            <Star size={24} fill="currentColor" />
            Главные задачи дня (MIT)
            {!hasManualMITs && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (авто-выбор)
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayMITs.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                theme={theme}
                now={now}
                dispatch={dispatch}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2
          className={`text-lg font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          Остальные задачи
        </h2>
        <div className="space-y-3">
          {regularTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              theme={theme}
              now={now}
              dispatch={dispatch}
            />
          ))}
          {regularTasks.length === 0 && displayMITs.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              Нет активных задач. Вы великолепны! 🎉
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MatrixView = ({ activeTasks, theme, now, dispatch }) => (
  <div className="h-full flex flex-col">
    <div className="mb-6">
      <h2
        className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
      >
        Матрица Эйзенхауэра
      </h2>
      <p className="text-gray-500">Авто-распределение приоритетов</p>
    </div>

    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.values(PRIORITIES).map((prio) => {
        const quadrantTasks = activeTasks.filter((t) => t.priority === prio.id);
        return (
          <div
            key={prio.id}
            className={`p-4 rounded-2xl border ${theme === "dark" ? "bg-slate-800/30 border-slate-700" : "bg-gray-50 border-gray-200"} flex flex-col`}
          >
            <h3
              className={`font-bold mb-4 flex items-center gap-2 ${prio.text}`}
            >
              <div className={`w-3 h-3 rounded-full ${prio.color}`}></div>
              {prio.name}{" "}
              <span className="text-xs text-gray-500 ml-auto">
                {quadrantTasks.length}
              </span>
            </h3>
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              {quadrantTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  mini
                  theme={theme}
                  now={now}
                  dispatch={dispatch}
                />
              ))}
              {quadrantTasks.length === 0 && (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  Пусто
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const GreenOPGView = ({ activeTasks, theme, now, dispatch }) => {
  const gTasks = activeTasks.filter((t) => t.category === "greenOPG");
  return (
    <div>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2
            className={`text-2xl font-bold text-emerald-500 flex items-center gap-2`}
          >
            <Briefcase size={24} /> CRM: GreenOPG
          </h2>
          <p className="text-gray-500">Управление аннуляциями и UR</p>
        </div>
      </div>

      <TaskInput category="greenOPG" theme={theme} dispatch={dispatch} />

      <div className="space-y-3">
        {gTasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            theme={theme}
            now={now}
            dispatch={dispatch}
          />
        ))}
        {gTasks.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            В категории GreenOPG нет задач.
          </div>
        )}
      </div>
    </div>
  );
};

const FocusModeView = ({ state, now, dispatch }) => {
  const task = state.tasks.find((t) => t.id === state.focusTaskId);

  if (!task) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <Target size={64} className="text-gray-500/30 mb-4" />
        <h2 className="text-2xl font-bold text-gray-400 mb-2">
          Режим фокуса не активен
        </h2>
        <p className="text-gray-500">
          Выберите задачу из списка и нажмите иконку фокуса.
        </p>
        <button
          onClick={() => dispatch({ type: "SET_TAB", payload: "today" })}
          className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          Вернуться к задачам
        </button>
      </div>
    );
  }

  const isRunning = task.status === "active";
  let displayTime = task.timeSpent || 0;
  if (isRunning && task.sessionStart) {
    displayTime += now - task.sessionStart;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
      <button
        onClick={() => dispatch({ type: "SET_FOCUS", payload: null })}
        className="absolute top-8 right-8 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
      >
        <X size={24} />
      </button>

      <div className="max-w-2xl w-full p-8 text-center">
        <div className="mb-8">
          <span
            className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-6 ${PRIORITIES[task.priority].bgSoft} ${PRIORITIES[task.priority].text}`}
          >
            {PRIORITIES[task.priority].name}
          </span>
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-4 break-words">
            {task.text}
          </h1>
          {task.tags?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {task.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 bg-white/5 text-gray-400 rounded-full text-sm"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="text-6xl sm:text-8xl font-mono text-white mb-12 tracking-wider font-light tabular-nums">
          {formatTime(displayTime).replace(/[чмс]/g, "").trim()}
          <span className="text-xl sm:text-2xl text-gray-500 ml-4 font-sans tracking-normal">
            затрачено
          </span>
        </div>

        <div className="flex justify-center gap-4 sm:gap-6">
          {isRunning ? (
            <button
              onClick={() =>
                dispatch({
                  type: "CHANGE_STATUS",
                  payload: { id: task.id, status: "paused" },
                })
              }
              className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-400 transition-transform hover:scale-105 shadow-[0_0_30px_rgba(249,115,22,0.3)]"
            >
              <Pause size={32} className="sm:w-10 sm:h-10" />
            </button>
          ) : (
            <button
              onClick={() =>
                dispatch({
                  type: "CHANGE_STATUS",
                  payload: { id: task.id, status: "active" },
                })
              }
              className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-transform hover:scale-105 shadow-[0_0_30px_rgba(37,99,235,0.3)]"
            >
              <Play size={32} ml={2} className="sm:w-10 sm:h-10" />
            </button>
          )}

          <button
            onClick={() => {
              dispatch({
                type: "CHANGE_STATUS",
                payload: { id: task.id, status: "completed" },
              });
              dispatch({ type: "SET_FOCUS", payload: null });
            }}
            className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-transform hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          >
            <Check size={32} className="sm:w-10 sm:h-10" />
          </button>
        </div>
      </div>
    </div>
  );
};

const AnalyticsView = ({ completedTasks, theme }) => {
  const totalCompleted = completedTasks.length;
  const avgTime =
    totalCompleted > 0
      ? completedTasks.reduce((acc, t) => acc + (t.timeSpent || 0), 0) /
        totalCompleted
      : 0;

  const gopgCount = completedTasks.filter(
    (t) => t.category === "greenOPG",
  ).length;

  return (
    <div className="space-y-6">
      <h2
        className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
      >
        Аналитика эффективности
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"}`}
        >
          <div className="text-gray-500 text-sm mb-2">Выполнено задач</div>
          <div className="text-4xl font-bold text-blue-500">
            {totalCompleted}
          </div>
        </div>
        <div
          className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"}`}
        >
          <div className="text-gray-500 text-sm mb-2">
            Среднее время на задачу
          </div>
          <div className="text-4xl font-bold text-emerald-500">
            {formatTime(avgTime)}
          </div>
        </div>
        <div
          className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"}`}
        >
          <div className="text-gray-500 text-sm mb-2">GreenOPG закрыто</div>
          <div className="text-4xl font-bold text-purple-500">{gopgCount}</div>
        </div>
      </div>

      <div
        className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"}`}
      >
        <h3 className="font-bold mb-4">Инсайты ИИ (Имитация)</h3>
        <ul className="space-y-3 text-sm text-gray-400">
          <li className="flex items-center gap-2">
            <Check className="text-emerald-500" size={16} /> Вы отлично
            справляетесь со срочными задачами.
          </li>
          <li className="flex items-center gap-2">
            <AlertCircle className="text-orange-500" size={16} /> Задачи из
            категории "Не срочно/Не важно" отнимают 15% времени. Рекомендуем
            делегировать.
          </li>
        </ul>
      </div>
    </div>
  );
};

const CompletedView = ({ completedTasks, theme, now, dispatch }) => (
  <div>
    <h2
      className={`text-2xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
    >
      История завершенных
    </h2>
    <div className="space-y-3">
      {completedTasks.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          theme={theme}
          now={now}
          dispatch={dispatch}
        />
      ))}
      {completedTasks.length === 0 && (
        <div className="text-gray-500 text-center py-10">
          Пока ничего не завершено.
        </div>
      )}
    </div>
  </div>
);

const TrashView = ({ trashTasks, theme, now, dispatch }) => (
  <div>
    <div className="flex justify-between items-end mb-6">
      <div>
        <h2
          className={`text-2xl font-bold flex items-center gap-2 text-red-500`}
        >
          <Trash2 size={24} /> Корзина
        </h2>
        <p className="text-gray-500">
          Удаленные задачи. Их можно восстановить или удалить навсегда.
        </p>
      </div>
      {trashTasks.length > 0 && (
        <button
          onClick={() => dispatch({ type: "CLEAR_TRASH" })}
          className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
        >
          Очистить всё
        </button>
      )}
    </div>

    <div className="space-y-3">
      {trashTasks.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          theme={theme}
          now={now}
          dispatch={dispatch}
        />
      ))}
      {trashTasks.length === 0 && (
        <div className="text-gray-500 text-center py-10">Корзина пуста.</div>
      )}
    </div>
  </div>
);

// --- MAIN APP COMPONENT ---
export default function SmartTaskManager() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const [now, setNow] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState("");

  // Handle Timer loop
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Hydration and Daily Auto-generation
  useEffect(() => {
    const saved = localStorage.getItem("eisenhower_tasks_v1");
    let dataToInit = { ...INITIAL_STATE };

    if (saved) {
      dataToInit = { ...dataToInit, ...JSON.parse(saved) };
    }

    // Logic for Daily Default MIT Task
    const todayStr = new Date().toLocaleDateString("en-CA");
    if (dataToInit.lastDailyGenerationDate !== todayStr) {
      const defaultMITs = [
        {
          id: `mit-${todayStr}`, // Unique ID tied to the date prevents duplicates
          text: "Пройти урок React",
          category: "general",
          priority: "UI",
          tags: ["MIT", "обучение"],
          createdAt: Date.now(),
          deadline: Date.now() + 24 * 60 * 60 * 1000,
          status: "todo",
          timeSpent: 0,
          isMIT: true,
        },
      ];

      // Merge task ensuring we don't duplicate if logic reruns
      const newTasks = defaultMITs.filter(
        (mit) => !dataToInit.tasks.some((t) => t.id === mit.id),
      );
      dataToInit.tasks = [...dataToInit.tasks, ...newTasks];
      dataToInit.lastDailyGenerationDate = todayStr;
    }

    dispatch({ type: "INIT_DATA", payload: dataToInit });
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (state.lastDailyGenerationDate) {
      localStorage.setItem("eisenhower_tasks_v1", JSON.stringify(state));
    }

    if (state.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [state]);

  // Handle auto-clearing notifications
  useEffect(() => {
    if (state.notification) {
      const timer = setTimeout(
        () => dispatch({ type: "CLEAR_NOTIFICATION" }),
        3500,
      );
      return () => clearTimeout(timer);
    }
  }, [state.notification]);

  const activeTasks = state.tasks.filter(
    (t) => t.status !== "completed" && t.status !== "deleted",
  );
  const completedTasks = state.tasks.filter((t) => t.status === "completed");
  const trashTasks = state.tasks.filter((t) => t.status === "deleted");

  return (
    <div
      className={`flex h-screen overflow-hidden ${state.theme === "dark" ? "bg-slate-950 text-slate-300" : "bg-gray-100 text-gray-800"}`}
    >
      {state.notification && (
        <div className="fixed bottom-6 right-6 bg-red-500 text-white px-5 py-3 rounded-xl shadow-2xl z-[100] flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <AlertCircle size={22} />
          <span className="font-medium">{state.notification}</span>
        </div>
      )}

      <Sidebar state={state} dispatch={dispatch} />

      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header
          className={`px-4 sm:px-8 py-4 border-b flex items-center justify-between z-10
          ${state.theme === "dark" ? "bg-slate-900/50 border-slate-800/50 backdrop-blur-md" : "bg-white/80 border-gray-200 backdrop-blur-md"}`}
        >
          <div className="relative w-full max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Поиск задач..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                ${state.theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-gray-50 border-gray-300 text-gray-900"}`}
            />
          </div>
          <div className="hidden sm:flex text-sm font-medium text-gray-500 items-center gap-2 ml-4 flex-shrink-0">
            <Clock size={16} />
            {new Date(now).toLocaleTimeString()}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-5xl mx-auto h-full">
            {state.activeTab === "today" && (
              <TodayView
                activeTasks={activeTasks}
                theme={state.theme}
                now={now}
                dispatch={dispatch}
                searchQuery={searchQuery}
              />
            )}
            {state.activeTab === "matrix" && (
              <MatrixView
                activeTasks={activeTasks}
                theme={state.theme}
                now={now}
                dispatch={dispatch}
              />
            )}
            {state.activeTab === "greenopg" && (
              <GreenOPGView
                activeTasks={activeTasks}
                theme={state.theme}
                now={now}
                dispatch={dispatch}
              />
            )}
            {state.activeTab === "analytics" && (
              <AnalyticsView
                completedTasks={completedTasks}
                theme={state.theme}
              />
            )}
            {state.activeTab === "completed" && (
              <CompletedView
                completedTasks={completedTasks}
                theme={state.theme}
                now={now}
                dispatch={dispatch}
              />
            )}
            {state.activeTab === "trash" && (
              <TrashView
                trashTasks={trashTasks}
                theme={state.theme}
                now={now}
                dispatch={dispatch}
              />
            )}
          </div>
        </div>

        {state.activeTab === "focus" && (
          <FocusModeView state={state} now={now} dispatch={dispatch} />
        )}
      </main>
    </div>
  );
}
