const STORAGE_KEY = "pwa-task-app.tasks.v1";

const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const taskList = document.querySelector("#taskList");
const taskTemplate = document.querySelector("#taskTemplate");
const taskSummary = document.querySelector("#taskSummary");
const emptyState = document.querySelector("#emptyState");
const clearCompletedButton = document.querySelector("#clearCompletedButton");
const installButton = document.querySelector("#installButton");
const iosInstallTip = document.querySelector("#iosInstallTip");
const connectionStatus = document.querySelector("#connectionStatus");

let tasks = loadTasks();
let deferredInstallPrompt = null;

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Не удалось прочитать сохранённые задачи:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn("Не удалось сохранить задачи:", error);
  }
}

function createTask(text) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    text,
    completed: false,
    createdAt: new Date().toISOString()
  };
}

function renderTasks() {
  taskList.replaceChildren();

  for (const task of tasks) {
    const fragment = taskTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".task-item");
    const checkbox = fragment.querySelector(".task-checkbox");
    const text = fragment.querySelector(".task-text");
    const deleteButton = fragment.querySelector(".delete-button");

    item.dataset.taskId = task.id;
    item.classList.toggle("completed", task.completed);
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Отметить задачу «${task.text}» как выполненную`);
    text.textContent = task.text;

    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      saveTasks();
      renderTasks();
    });

    deleteButton.addEventListener("click", () => {
      tasks = tasks.filter((currentTask) => currentTask.id !== task.id);
      saveTasks();
      renderTasks();
    });

    taskList.append(fragment);
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  const activeCount = tasks.length - completedCount;

  if (tasks.length === 0) {
    taskSummary.textContent = "Задач пока нет";
  } else {
    taskSummary.textContent = `Всего: ${tasks.length} · Осталось: ${activeCount}`;
  }

  emptyState.hidden = tasks.length > 0;
  clearCompletedButton.hidden = completedCount === 0;
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = taskInput.value.trim();

  if (!text) {
    taskInput.focus();
    return;
  }

  tasks.unshift(createTask(text));
  saveTasks();
  renderTasks();
  taskForm.reset();
  taskInput.focus();
});

clearCompletedButton.addEventListener("click", () => {
  tasks = tasks.filter((task) => !task.completed);
  saveTasks();
  renderTasks();
});

function updateConnectionStatus() {
  const online = navigator.onLine;
  connectionStatus.textContent = online ? "Онлайн" : "Офлайн";
  connectionStatus.classList.toggle("offline", !online);
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

function showIosInstallTip() {
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  iosInstallTip.hidden = !(isIos && !isStandalone);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (error) {
      console.warn("Service Worker не зарегистрирован:", error);
    }
  });
}

renderTasks();
updateConnectionStatus();
showIosInstallTip();
