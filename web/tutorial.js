// State transitions do not depend on route data or DOM targets.
function createTutorialController(preferences, effects = {}) {
  let step = -1;
  const sync = () => effects.sync?.();
  const stop = () => {
    if (step < 0) return;
    step = -1;
    effects.hide?.();
    sync();
  };
  return {
    active: () => step >= 0,
    offer: () => {
      const p = preferences.get();
      return p.tutorialEnabled && p.dismissedVersion !== 1 && p.completedVersion !== 1;
    },
    dismiss() { preferences.update({dismissedVersion: 1}); sync(); },
    start() {
      preferences.update({tutorialEnabled: true, dismissedVersion: 1});
      step = 0;
      sync();
      effects.show?.(step);
    },
    next() { if (step >= 0) { step = Math.min(5, step + 1); effects.show?.(step); } },
    back() { if (step >= 0) { step = Math.max(0, step - 1); effects.show?.(step); } },
    finish() { if (step === 5) { preferences.update({completedVersion: 1}); stop(); } },
    stop,
    setEnabled(enabled) {
      preferences.update({tutorialEnabled: enabled, dismissedVersion: 1});
      if (!enabled) stop();
      sync();
    },
  };
}
const tutorialSteps = [
  {title: "Welcome to TabBetter", text: "Find speech and debate tournaments and read published tournament information. Some official actions, including registration and account tools, remain on Tabroom."},
  {title: "Find a tournament", text: "In Tournaments, use search and event or circuit filters to find speech and debate offerings. Event details come from public sources and may be incomplete. Missing metadata does not mean an event is not offered.", target: "#discovery-search", fallback: "Search and filters are available in Tournaments. Your current page and search choices stay unchanged."},
  {title: "Find nearby tournaments", text: "Enter a location manually, or choose the optional browser location action. Set a distance filter and choose whether to include online events separately. This tour never asks for location permission.", target: "#discovery-place", fallback: "Open the location filters in Tournaments when you are ready. You can always enter a location without giving browser permission."},
  {title: "Open a tournament", text: "Open a tournament to explore Schedule, Pairings, Entries, Judges and Results. Event and round selectors help you find published information. Only the source can confirm your assignment or result.", illustration: true},
  {title: "Save and return", text: "Save tournaments to return to them from Saved tournaments in the sidebar or mobile Menu. Saves stay on this device. Official Tabroom tools open the official site and may require its login.", target: '[data-nav="saved"]', fallback: "Saved tournaments and official tools are available in the sidebar or Menu. Nothing is saved automatically by this tour."},
  {title: "Make it yours", text: "You can turn this tutorial on or off in Settings → Tutorial. You can replay it there anytime."},
];
let tutorialController;
let tutorialTrigger;
function renderTutorialStep(index) {
  const step = tutorialSteps[index];
  const dialog = $("#tutorial-dialog");
  $("#tutorial-step-count").textContent = `Step ${index + 1} of 6`;
  $("#tutorial-title").textContent = step.title;
  $("#tutorial-description").textContent = step.text;
  const target = step.target && $(step.target);
  const visible = target && target.getClientRects().length && !target.closest("[hidden]");
  $("#tutorial-illustration").hidden = !step.illustration || route().name === "tournament";
  $("#tutorial-context").textContent = step.illustration
    ? (route().name === "tournament" ? "Use this tournament’s published pages and event/round selectors when you close the tutorial." : "No tournament or personal assignment is selected. This illustration shows where to look when you open one.")
    : step.fallback ? (visible ? "You can use this control after closing the tutorial. " : "") + step.fallback : "";
  $("#tutorial-back").disabled = index === 0;
  $("#tutorial-next").hidden = index === 5;
  $("#tutorial-finish").hidden = index !== 5;
  $("#tutorial-settings").hidden = index !== 5;
  if (!dialog.open) dialog.showModal();
  $("#tutorial-title").focus();
}
function startTutorial(trigger = document.activeElement) {
  if (!tutorialController || tutorialController.active()) return;
  closeWorkspaceDrawer();
  tutorialTrigger = trigger;
  tutorialController.start();
}
function stopTutorial() { tutorialController?.stop(); }
function initTutorial() {
  const dialog = $("#tutorial-dialog");
  tutorialController = createTutorialController(workspacePreferences, {
    show: renderTutorialStep,
    hide() {
      dialog.close();
      const target = tutorialTrigger;
      tutorialTrigger = null;
      if (target?.isConnected && target.getClientRects().length && !target.closest("[hidden]")) target.focus();
      else $("#app").focus();
    },
    sync: syncTutorialSettings,
  });
  $("#tutorial-start").onclick = event => startTutorial(event.currentTarget);
  $("#tutorial-not-now").onclick = () => { tutorialController.dismiss(); $("#app").focus(); };
  $("#tutorial-close").onclick = stopTutorial;
  $("#tutorial-back").onclick = () => tutorialController.back();
  $("#tutorial-next").onclick = () => tutorialController.next();
  $("#tutorial-finish").onclick = () => tutorialController.finish();
  $("#tutorial-settings").onclick = openTutorialSettings;
  dialog.addEventListener("keydown", workspaceDialogKeydown);
  dialog.addEventListener("cancel", event => { event.preventDefault(); stopTutorial(); });
  syncTutorialSettings();
}
