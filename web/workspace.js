// Versioned local preferences. Theme intentionally retains tabbetter-theme.
function createWorkspacePreferences(storage) {
  const state = {version: 1, sidebarHidden: false, textSize: "default", motion: "device", tutorialEnabled: true, dismissedVersion: 0, completedVersion: 0};
  let persistent = true;
  function accept(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    if (["default", "large", "extra-large"].includes(value.textSize)) state.textSize = value.textSize;
    if (["device", "reduce"].includes(value.motion)) state.motion = value.motion;
    if (typeof value.sidebarHidden === "boolean") state.sidebarHidden = value.sidebarHidden;
    if (typeof value.tutorialEnabled === "boolean") state.tutorialEnabled = value.tutorialEnabled;
    for (const key of ["dismissedVersion", "completedVersion"]) if ([0, 1].includes(value[key])) state[key] = value[key];
  }
  let stored;
  try { stored = storage.getItem("tabbetter-workspace-v1"); }
  catch { persistent = false; }
  try {
    const value = JSON.parse(stored || "null");
    if (value?.version === 1) accept(value);
  } catch { /* Invalid preference data is not evidence of unavailable storage. */ }
  return {
    get: () => ({...state}),
    persistent: () => persistent,
    update(value) {
      accept(value);
      try {
        storage.setItem("tabbetter-workspace-v1", JSON.stringify(state));
        persistent = true;
      }
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
function applyWorkspaceSidebar() {
  const hidden = workspacePreferences.get().sidebarHidden;
  const desktop = window.matchMedia("(min-width: 901px)").matches;
  const slot = $("#workspace-sidebar-slot");
  const toggle = $("#workspace-sidebar-toggle");
  document.documentElement.dataset.sidebarHidden = String(hidden);
  slot.inert = desktop && hidden;
  toggle.setAttribute("aria-expanded", String(!hidden));
  toggle.setAttribute("aria-label", hidden ? "Show sidebar" : "Hide sidebar");
  if (desktop && hidden && slot.contains(document.activeElement)) toggle.focus();
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
// Own every plain Tab step: native traversal can skip buttons in WebKit's
// default keyboard configuration even when those controls accept focus().
function workspaceDialogKeydown(event) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
  const dialog = event.currentTarget;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    .filter(control => !control.matches(":disabled") && control.tabIndex >= 0 && control.getClientRects().length && !control.closest("[hidden], [inert]"));
  const index = controls.indexOf(document.activeElement);
  const next = event.shiftKey
    ? (index <= 0 ? controls.length - 1 : index - 1)
    : (index + 1) % controls.length;
  event.preventDefault();
  controls[next]?.focus();
}
function closeWorkspaceDrawer() {
  const drawer = $("#workspace-drawer");
  if (!drawer?.open) return;
  const navigation = $("#workspace-navigation");
  const focused = navigation.contains(document.activeElement) ? document.activeElement : null;
  drawer.close();
  $("#workspace-sidebar-slot").append(navigation);
  const menu = $("#workspace-menu");
  menu.setAttribute("aria-expanded", "false");
  // A breakpoint change hides Menu. Preserve a focused destination if possible,
  // otherwise restore the opener or a meaningful visible desktop destination.
  applyWorkspaceSidebar();
  const target = [focused, menu, (workspacePreferences.get().sidebarHidden ? $("#workspace-sidebar-toggle") : null), navigation.querySelector('[aria-current="page"]'), $("#app")]
    .find(control => control?.isConnected && control.getClientRects().length && !control.closest("[hidden], [inert]"));
  target?.focus();
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
  applyWorkspaceSidebar();
  $("#workspace-sidebar-toggle").onclick = () => {
    workspacePreferences.update({sidebarHidden: !workspacePreferences.get().sidebarHidden});
    applyWorkspaceSidebar();
  };
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
  // Some engines blur display:none controls before firing the media change.
  // Transfer only that breakpoint blur, never an ordinary pointer blur.
  document.addEventListener("focusout", event => {
    if (!window.matchMedia("(min-width: 901px)").matches &&
        (event.target === $("#workspace-sidebar-toggle") || $("#workspace-sidebar-slot").contains(event.target))) {
      queueMicrotask(() => { if (document.activeElement === document.body) $("#workspace-menu").focus(); });
    }
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", event => {
    if (event.matches) closeWorkspaceDrawer();
    else if (document.activeElement === $("#workspace-sidebar-toggle") || $("#workspace-sidebar-slot").contains(document.activeElement)) $("#workspace-menu").focus();
    applyWorkspaceSidebar();
  });
  initTutorial();
  if (route().name === "settings") renderRoute();
}
