document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const accountToggle = document.getElementById("account-toggle");
  const accountPanel = document.getElementById("account-panel");
  const accountStatus = document.getElementById("account-status");
  const loginTrigger = document.getElementById("login-trigger");
  const logoutTrigger = document.getElementById("logout-trigger");
  const loginModal = document.getElementById("login-modal");
  const closeLoginModal = document.getElementById("close-login-modal");
  const loginForm = document.getElementById("login-form");
  const teacherHelper = document.getElementById("teacher-helper");

  let authState = {
    authenticated: false,
    username: null,
  };

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    window.clearTimeout(showMessage.timeoutId);
    showMessage.timeoutId = window.setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUi() {
    accountStatus.textContent = authState.authenticated
      ? `Logged in as ${authState.username}`
      : "Viewing as student";

    loginTrigger.classList.toggle("hidden", authState.authenticated);
    logoutTrigger.classList.toggle("hidden", !authState.authenticated);

    signupForm.querySelectorAll("input, select, button").forEach((field) => {
      field.disabled = !authState.authenticated;
    });

    teacherHelper.textContent = authState.authenticated
      ? "Teacher mode is active. You can register or remove students."
      : "Students can view activity rosters. Teachers must log in to register or remove students.";
  }

  async function refreshSession() {
    try {
      const response = await fetch("/auth/session");
      const session = await response.json();

      authState = {
        authenticated: Boolean(session.authenticated),
        username: session.username || null,
      };
    } catch (error) {
      authState = {
        authenticated: false,
        username: null,
      };
      console.error("Error checking session:", error);
    }

    updateAuthUi();
  }

  function setAccountPanelOpen(isOpen) {
    accountPanel.classList.toggle("hidden", !isOpen);
    accountToggle.setAttribute("aria-expanded", String(isOpen));
  }

  function setLoginModalOpen(isOpen) {
    loginModal.classList.toggle("hidden", !isOpen);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        authState.authenticated
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 403) {
          await refreshSession();
          fetchActivities();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 403) {
          await refreshSession();
          fetchActivities();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  accountToggle.addEventListener("click", () => {
    const isOpen = accountToggle.getAttribute("aria-expanded") === "true";
    setAccountPanelOpen(!isOpen);
  });

  loginTrigger.addEventListener("click", () => {
    setAccountPanelOpen(false);
    setLoginModalOpen(true);
  });

  closeLoginModal.addEventListener("click", () => {
    setLoginModalOpen(false);
  });

  logoutTrigger.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Unable to log out.", "error");
        return;
      }

      authState = {
        authenticated: false,
        username: null,
      };
      updateAuthUi();
      await fetchActivities();
      setAccountPanelOpen(false);
      showMessage(result.message, "success");
    } catch (error) {
      showMessage("Unable to log out.", "error");
      console.error("Error logging out:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Unable to log in.", "error");
        return;
      }

      authState = {
        authenticated: true,
        username: result.username,
      };
      updateAuthUi();
      await fetchActivities();
      loginForm.reset();
      setLoginModalOpen(false);
      showMessage(result.message, "success");
    } catch (error) {
      showMessage("Unable to log in.", "error");
      console.error("Error logging in:", error);
    }
  });

  document.addEventListener("click", (event) => {
    if (!accountPanel.contains(event.target) && !accountToggle.contains(event.target)) {
      setAccountPanelOpen(false);
    }

    if (event.target === loginModal) {
      setLoginModalOpen(false);
    }
  });

  // Initialize app
  refreshSession().then(fetchActivities);
});
