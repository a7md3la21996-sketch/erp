const STORAGE_KEY = 'platform_onboarding';

function getData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { completed: false, currentStep: 0 };
  } catch {
    return { completed: false, currentStep: 0 };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function isOnboardingComplete() {
  return getData().completed === true;
}

export function completeOnboarding() {
  const data = getData();
  data.completed = true;
  data.currentStep = 0;
  saveData(data);
}

export function resetOnboarding() {
  saveData({ completed: false, currentStep: 0 });
}

export function getCurrentStep() {
  return getData().currentStep || 0;
}

export function setCurrentStep(step) {
  const data = getData();
  data.currentStep = step;
  saveData(data);
}
