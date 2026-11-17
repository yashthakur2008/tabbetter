// Versioned local preferences. Theme intentionally retains tabbetter-theme.
function createWorkspacePreferences(storage) {
  const state = {version: 1, textSize: "default", motion: "device", tutorialEnabled: true, dismissedVersion: 0, completedVersion: 0};
  let persistent = true;
  function accept(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    if (["default", "large", "extra-large"].includes(value.textSize)) state.textSize = value.textSize;
    if (["device", "reduce"].includes(value.motion)) state.motion = value.motion;
    if (typeof value.tutorialEnabled === "boolean") state.tutorialEnabled = value.tutorialEnabled;
    for (const key of ["dismissedVersion", "completedVersion"]) if ([0, 1].includes(value[key])) state[key] = value[key];
  }
  try {
    const value = JSON.parse(storage.getItem("tabbetter-workspace-v1") || "null");
    if (value?.version === 1) accept(value);
  } catch { persistent = false; }
  return {
    get: () => ({...state}),
    persistent: () => persistent,
    update(value) {
      accept(value);
      try { storage.setItem("tabbetter-workspace-v1", JSON.stringify(state)); }
      catch { persistent = false; }
      return {...state};
    },
  };
}

let workspacePreferences;
let workspaceMotionMedia;
let workspaceInitialized = false;
let workspaceSettingsFocus = false;
function applyWorkspacePreferences() {
  const prefs = workspacePreferences.get();
  document.documentElement.dataset.textSize = prefs.textSize;
  const reduce = prefs.motion === "reduce" || workspaceMotionMedia.matches;
  document.documentElement.dataset.motion = reduce ? "reduce" : "device";
  // CSS cannot cancel an already running Web Animations API animation.
  if (reduce) document.getAnimations().forEach(animation => animation.cancel());
}
function renderWorkspaceSettings() {
  if (!workspacePreferences) return;
  const prefs = workspacePreferences.get();
  $("#app").innerHTML = `<section class="workspace-settings" aria-labelledby="settings-heading">
    <h1 id="settings-heading">Settings</h1>
    <p>Preferences stay on this device, not in an account or across devices.</p>
    <fieldset><legend>Appearance</legend>
      <label for="theme">Color theme</label>
      <select id="theme"><option value="light">Light</option><option value="dark">Dark</option><option value="midnight">Midnight</option><option value="system">System</option></select>
      <label for="workspace-text-size">Text size</label>
      <select id="workspace-text-size"><option value="default">Default</option><option value="large">Large</option><option value="extra-large">Extra large</option></select>
      <label for="workspace-motion">Motion</label>
      <select id="workspace-motion"><option value="device">Follow device</option><option value="reduce">Reduce motion</option></select>
      <p>Your device’s reduced-motion preference always takes priority.</p>
    </fieldset>
    <fieldset id="settings-tutorial"><legend>Tutorial</legend>
      <label class="workspace-switch"><input type="checkbox" role="switch" id="tutorial-enabled"> Tutorial enabled</label>
      <p>Allow the one-time welcome offer. Turning this on never interrupts your current task. Replay enables the tutorial and starts a new run.</p>
      <button class="btn" id="tutorial-replay">Start tutorial</button>
      <p id="tutorial-status" role="status" aria-live="polite"></p>
    </fieldset>
    <p id="workspace-persistence" role="status"></p>
  </section>` + footer;
  initTheme();
  $("#workspace-text-size").value = prefs.textSize;
  $("#workspace-motion").value = prefs.motion;
  for (const [selector, key] of [["#workspace-text-size", "textSize"], ["#workspace-motion", "motion"]]) {
    $(selector).onchange = event => {
      workspacePreferences.update({[key]: event.target.value});
      applyWorkspacePreferences();
      syncTutorialSettings();
    };
  }
  $("#tutorial-enabled").onchange = event => tutorialController.setEnabled(event.target.checked);
  $("#tutorial-replay").onclick = event => startTutorial(event.currentTarget);
  syncTutorialSettings();
  if (workspaceSettingsFocus) {
    workspaceSettingsFocus = false;
    $("#tutorial-enabled").focus();
  }
}
function syncTutorialSettings() {
  if (!workspacePreferences) return;
  const prefs = workspacePreferences.get();
  const enabled = $("#tutorial-enabled");
  if (enabled) {
    enabled.checked = prefs.tutorialEnabled;
    $("#tutorial-replay").textContent = prefs.dismissedVersion || prefs.completedVersion ? "Replay tutorial" : "Start tutorial";
    $("#tutorial-status").textContent = "Tutorial " + (prefs.tutorialEnabled ? "enabled." : "off.") +
      (prefs.completedVersion ? " Completed. You can replay anytime." : " You can start or replay anytime.");
    $("#workspace-persistence").textContent = workspacePreferences.persistent()
      ? "Saved locally when browser storage is available."
      : "Browser storage is unavailable. These choices last for this session only.";
  }
  const welcome = $("#tutorial-welcome");
  if (welcome) welcome.hidden = !tutorialController.offer();
}
// Keep keyboard navigation in the modal, including browsers that otherwise
// move focus to browser chrome after the final native-dialog control.
function workspaceDialogKeydown(event) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    .filter(control => control.getClientRects().length && !control.closest("[hidden]"));
  const first = controls[0], last = controls[controls.length - 1];
  const current = document.activeElement;
  if (event.shiftKey && (current === first || !controls.includes(current))) {
    event.preventDefault(); last?.focus();
  } else if (!event.shiftKey && (current === last || !controls.includes(current))) {
    event.preventDefault(); first?.focus();
  }
}
function closeWorkspaceDrawer() {
  const drawer = $("#workspace-drawer");
  if (!drawer?.open) return;
  drawer.close();
  $("#workspace-sidebar-slot").append($("#workspace-navigation"));
  $("#workspace-menu").setAttribute("aria-expanded", "false");
  if ($("#workspace-menu").getClientRects().length) $("#workspace-menu").focus();
}
function workspaceRouteChanged() {
  if (!workspaceInitialized) return;
  closeWorkspaceDrawer();
  const wasActive = tutorialController?.active();
  stopTutorial();
  if (wasActive) $("#app").focus();
}
function openTutorialSettings() {
  stopTutorial();
  workspaceSettingsFocus = true;
  if (route().name === "settings") renderWorkspaceSettings();
  else navigate("settings");
}
function initWorkspace() {
  if (workspaceInitialized) return;
  workspaceInitialized = true;
  let storage;
  try { storage = window.localStorage; } catch { /* Access itself can throw. */ }
  workspacePreferences = createWorkspacePreferences(storage);
  workspaceMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  workspaceMotionMedia.addEventListener("change", applyWorkspacePreferences);
  applyWorkspacePreferences();
  const drawer = $("#workspace-drawer");
  $("#workspace-menu").onclick = () => {
    drawer.append($("#workspace-navigation"));
    drawer.showModal();
    $("#workspace-menu").setAttribute("aria-expanded", "true");
    $("#workspace-drawer-close").focus();
  };
  $("#workspace-drawer-close").onclick = closeWorkspaceDrawer;
  drawer.addEventListener("keydown", workspaceDialogKeydown);
  drawer.addEventListener("cancel", event => { event.preventDefault(); closeWorkspaceDrawer(); });
  drawer.addEventListener("click", event => { if (event.target === drawer && (event.clientX > drawer.getBoundingClientRect().right || event.clientY > drawer.getBoundingClientRect().bottom)) closeWorkspaceDrawer(); });
  // Selecting the current route does not fire hashchange.
  $("#workspace-navigation").addEventListener("click", event => {
    if (event.target.closest("[data-nav], a")) closeWorkspaceDrawer();
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", event => { if (event.matches) closeWorkspaceDrawer(); });
  initTutorial();
  if (route().name === "settings") renderRoute();
}
