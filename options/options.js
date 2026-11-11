const form = document.getElementById("profileForm");
const status = document.getElementById("status");
const resetButton = document.getElementById("resetProfile");

const profileFields = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "currentLocation",
  "currentCompany",
  "linkedin",
  "github",
  "portfolio",
  "noticePeriod",
  "source",
  "rightToWorkDetails"
];

async function loadProfile() {
  const { profile = {} } =
    await chrome.storage.local.get("profile");

  for (const field of profileFields) {
    const element = document.getElementById(field);

    if (element) {
      element.value = profile[field] || "";
    }
  }

  const rightToWork = profile.rightToWork || "";

  document.querySelectorAll('input[name="rightToWork"]')
    .forEach(radio => {
      radio.checked = radio.value === rightToWork;
    });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const profile = {};

  for (const field of profileFields) {
    profile[field] =
      document.getElementById(field).value.trim();
  }

  profile.rightToWork =
    document.querySelector(
      'input[name="rightToWork"]:checked'
    )?.value || "";

  await chrome.storage.local.set({ profile });

  status.textContent = "Profile saved successfully!";
});

resetButton?.addEventListener("click", async () => {
  const confirmed = confirm(
    "Clear all saved profile information?"
  );

  if (!confirmed) return;

  await chrome.storage.local.remove("profile");
  form.reset();

  status.textContent = "Your profile has been cleared.";
});

loadProfile();