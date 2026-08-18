const API_BASE = "https://lakemaple-dev-functions.azurewebsites.net/api";

// =====================================
// Helper: safely parse API responses
// =====================================

async function readApiResponse(response) {
  const text = await response.text();

  console.log("Status:", response.status);
  console.log("Response:", text);

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      console.warn("Invalid JSON response:", text);
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "API endpoint not found. Please verify the Azure Function route.",
      );
    }

    throw new Error(
      data?.message || text || `Request failed with status ${response.status}`,
    );
  }

  return data;
}

// =====================================
// Helper: escape HTML
// =====================================

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =====================================
// Register Contestant
// =====================================

const registrationForm = document.getElementById("registrationForm");

const registrationResult = document.getElementById("registrationResult");

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    registrationResult.className = "";
    registrationResult.textContent = "Registering...";

    try {
      const firstName = document.getElementById("firstName").value.trim();

      const lastName = document.getElementById("lastName").value.trim();

      const email = document.getElementById("email").value.trim();

      if (!firstName || !lastName || !email) {
        throw new Error("First name, last name, and email are required.");
      }

      const response = await fetch(`${API_BASE}/contestants/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
        }),
      });

      const data = await readApiResponse(response);

      if (!data?.contestant?.id) {
        throw new Error(
          "Registration succeeded but contestant data was not returned.",
        );
      }

      registrationResult.className = "success";

      registrationResult.textContent = `Registration successful. Contestant ID: ${data.contestant.id}`;

      const contestantIdInput = document.getElementById("contestantId");

      if (contestantIdInput) {
        contestantIdInput.value = data.contestant.id;
      }

      registrationForm.reset();
    } catch (error) {
      console.error("Registration error:", error);

      registrationResult.className = "error";

      registrationResult.textContent = error.message;
    }
  });
}

// =====================================
// Submit Fish Catch
// =====================================

const fishForm = document.getElementById("fishForm");

const fishResult = document.getElementById("fishResult");

if (fishForm) {
  fishForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    fishResult.className = "";
    fishResult.textContent = "Submitting fish catch...";

    try {
      const contestantId = document.getElementById("contestantId").value.trim();

      const fishType = document.getElementById("fishType").value.trim();

      const weight = document.getElementById("weight").value;

      const photo = document.getElementById("photo").files[0];

      if (!contestantId) {
        throw new Error("Contestant ID is required.");
      }

      if (!fishType) {
        throw new Error("Fish type is required.");
      }

      if (!weight || Number(weight) <= 0) {
        throw new Error("Enter a valid fish weight.");
      }

      if (!photo) {
        throw new Error("Please select a fish photo.");
      }

      if (!photo.type.startsWith("image/")) {
        throw new Error("The selected file must be an image.");
      }

      const formData = new FormData();

      formData.append("contestantId", contestantId);

      formData.append("fishType", fishType);

      formData.append("weight", weight);

      formData.append("photo", photo);

      const response = await fetch(`${API_BASE}/fish-catches`, {
        method: "POST",
        body: formData,
      });

      const data = await readApiResponse(response);

      fishResult.className = "success";

      if (data?.fishCatch?.id) {
        fishResult.textContent = `Catch submitted successfully. Catch ID: ${data.fishCatch.id}`;
      } else {
        fishResult.textContent = "Catch submitted successfully.";
      }

      const savedContestantId = contestantId;

      fishForm.reset();

      document.getElementById("contestantId").value = savedContestantId;

      setTimeout(() => {
        loadLeaderboardData();
      }, 3000);
    } catch (error) {
      console.error("Fish submission error:", error);

      fishResult.className = "error";

      fishResult.textContent = error.message;
    }
  });
}

// =====================================
// Leaderboard
// =====================================

const leaderboard = document.getElementById("leaderboard");

const loadLeaderboardButton = document.getElementById("loadLeaderboard");

async function loadLeaderboardData() {
  if (!leaderboard) {
    return;
  }

  leaderboard.innerHTML = "<p>Loading leaderboard...</p>";

  try {
    const response = await fetch(`${API_BASE}/leaderboard`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await readApiResponse(response);

    if (!data || !Array.isArray(data.leaderboard)) {
      leaderboard.innerHTML = "<p>No leaderboard data available.</p>";

      return;
    }

    if (data.leaderboard.length === 0) {
      leaderboard.innerHTML = "<p>No leaderboard records yet.</p>";

      return;
    }

    const records = [...data.leaderboard].sort((a, b) =>
      String(a.fishType || "").localeCompare(String(b.fishType || "")),
    );

    let html = `
            <table>
                <thead>
                    <tr>
                        <th>Fish Type</th>
                        <th>Contestant</th>
                        <th>Weight</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>

                <tbody>
        `;

    for (const item of records) {
      const updatedAt = item.updatedAt
        ? new Date(item.updatedAt).toLocaleString()
        : "N/A";

      const weight = Number.isFinite(Number(item.weight))
        ? Number(item.weight).toFixed(2)
        : "N/A";

      html += `
                <tr>
                    <td>
                        ${escapeHtml(item.fishType)}
                    </td>

                    <td>
                        ${escapeHtml(item.contestantName)}
                    </td>

                    <td>
                        ${escapeHtml(weight)} kg
                    </td>

                    <td>
                        ${escapeHtml(updatedAt)}
                    </td>
                </tr>
            `;
    }

    html += `
                </tbody>
            </table>
        `;

    leaderboard.innerHTML = html;
  } catch (error) {
    console.error("Leaderboard error:", error);

    leaderboard.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

if (loadLeaderboardButton) {
  loadLeaderboardButton.addEventListener("click", loadLeaderboardData);
}

// =====================================
// Initial Load
// =====================================

document.addEventListener("DOMContentLoaded", () => {
  loadLeaderboardData();
});
