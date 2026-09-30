const API_URL = "http://localhost:5000/api";

let allDocuments = [];

// =========================
// AUTH FUNCTIONS
// =========================

function showRegister() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("registerSection").style.display = "block";
}

function showLogin() {
  document.getElementById("registerSection").style.display = "none";
  document.getElementById("loginSection").style.display = "block";
}

// =========================
// REGISTER
// =========================

async function register() {
  const name = document.getElementById("registerName").value.trim();

  const email = document.getElementById("registerEmail").value.trim();

  const password = document.getElementById("registerPassword").value;

  const message = document.getElementById("registerMessage");

  if (!name || !email || !password) {
    message.textContent = "Please fill all fields";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    message.textContent = data.message;

    if (response.ok) {
      document.getElementById("registerName").value = "";
      document.getElementById("registerEmail").value = "";
      document.getElementById("registerPassword").value = "";

      showLogin();
    }
  } catch (error) {
    console.error("Register error:", error);

    message.textContent = "Server connection failed";
  }
}

// =========================
// LOGIN
// =========================

async function login() {
  const email = document.getElementById("loginEmail").value.trim();

  const password = document.getElementById("loginPassword").value;

  const message = document.getElementById("loginMessage");

  if (!email || !password) {
    message.textContent = "Please enter email and password";

    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    message.textContent = data.message;

    if (response.ok) {
      localStorage.setItem("token", data.token);

      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error("Login error:", error);

    message.textContent = "Server connection failed";
  }
}

// =========================
// TOKEN
// =========================

function getToken() {
  return localStorage.getItem("token");
}

// =========================
// LOGOUT
// =========================

function logout() {
  localStorage.removeItem("token");

  window.location.href = "index.html";
}

// =========================
// DASHBOARD INITIALIZATION
// =========================

if (window.location.pathname.includes("dashboard.html")) {
  if (!getToken()) {
    window.location.href = "index.html";
  } else {
    loadDocuments();
    loadSharedDocuments();
    loadAuditLogs();
  }
}

// =========================
// UPLOAD DOCUMENT
// =========================

async function uploadDocument() {
  const fileInput = document.getElementById("documentFile");

  const message = document.getElementById("uploadMessage");

  if (!fileInput.files.length) {
    message.textContent = "Please select a document";

    return;
  }

  const formData = new FormData();

  formData.append("document", fileInput.files[0]);

  try {
    const response = await fetch(`${API_URL}/documents/upload`, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${getToken()}`,
      },

      body: formData,
    });

    const data = await response.json();

    message.textContent = data.message || "Upload completed";

    if (response.ok) {
      fileInput.value = "";

      await loadDocuments();
      await loadAuditLogs();
    }
  } catch (error) {
    console.error("Upload error:", error);

    message.textContent = "Upload failed. Server may be offline.";
  }
}

// =========================
// LOAD MY DOCUMENTS
// =========================

async function loadDocuments() {
  const container = document.getElementById("documentsList");

  if (!container) {
    return;
  }

  try {
    const token = getToken();

    if (!token) {
      container.innerHTML = "<p>Please login again.</p>";

      return;
    }

    const response = await fetch(`${API_URL}/documents/`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();

    console.log("Documents API:", response.status, text);

    if (response.status === 401) {
      container.innerHTML = "<p>Session expired. Please login again.</p>";

      localStorage.removeItem("token");

      return;
    }

    if (!response.ok) {
      container.innerHTML = `
                <p>
                    Server error:
                    ${response.status}
                </p>

                <p>
                    ${escapeHTML(text)}
                </p>
            `;

      return;
    }

    const data = JSON.parse(text);

    allDocuments = data.documents || [];

    const documentCount = document.getElementById("documentCount");

    if (documentCount) {
      documentCount.textContent = data.documents ? data.documents.length : 0;
    }

    if (!data.documents || data.documents.length === 0) {
      container.innerHTML = "<p>No documents uploaded yet.</p>";

      return;
    }

    container.innerHTML = "";

    data.documents.forEach((doc) => {
      const div = document.createElement("div");

      div.className = "document-item";

      div.innerHTML = `

                <div>

                    <strong>
                        ${escapeHTML(doc.originalName)}
                    </strong>

                    <p>
                        Uploaded:
                        ${new Date(doc.createdAt).toLocaleString()}
                    </p>

                </div>

                <div>

                    <button
                        onclick="downloadDocument('${doc._id}')"
                    >
                        Download
                    </button>

                    <button
                        onclick="deleteDocument('${doc._id}')"
                    >
                        Delete
                    </button>

                    <button
                        onclick="showShareForm('${doc._id}')"
                    >
                        Share
                    </button>

                </div>

                <div
                    id="shareForm-${doc._id}"
                    style="display:none; margin-top:10px;"
                ></div>

            `;

      container.appendChild(div);
    });
  } catch (error) {
    console.error("Documents error:", error);

    container.innerHTML = "<p>Failed to load documents.</p>";
  }
}

// =========================
// SHOW SHARE FORM
// =========================

function showShareForm(documentId) {
  const formContainer = document.getElementById(`shareForm-${documentId}`);

  if (!formContainer) {
    return;
  }

  if (formContainer.style.display === "block") {
    formContainer.style.display = "none";

    return;
  }

  const now = new Date();

  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  const minDateTime = now.toISOString().slice(0, 16);

  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  expiry.setMinutes(expiry.getMinutes() - expiry.getTimezoneOffset());

  const defaultExpiry = expiry.toISOString().slice(0, 16);

  formContainer.style.display = "block";

  formContainer.innerHTML = `

        <div class="share-form">

            <h3>Share Document</h3>

            <input
                type="email"
                id="shareEmail-${documentId}"
                placeholder="Enter user's email"
            >

            <br><br>

            <label>
                Expiry Time:
            </label>

            <input
                type="datetime-local"
                id="shareExpiry-${documentId}"
                min="${minDateTime}"
                value="${defaultExpiry}"
            >

            <br><br>

            <button
                onclick="shareDocument('${documentId}')"
            >
                Share Document
            </button>

            <button
                onclick="showShareForm('${documentId}')"
            >
                Cancel
            </button>

            <p
                id="shareMessage-${documentId}"
            ></p>

        </div>

    `;
}

// =========================
// SHARE DOCUMENT
// =========================

async function shareDocument(documentId) {
  const emailInput = document.getElementById(`shareEmail-${documentId}`);

  const expiryInput = document.getElementById(`shareExpiry-${documentId}`);

  const message = document.getElementById(`shareMessage-${documentId}`);

  if (!emailInput || !expiryInput) {
    return;
  }

  const email = emailInput.value.trim();

  const expiresAt = expiryInput.value;

  if (!email) {
    message.textContent = "Please enter the user's email.";

    return;
  }

  if (!expiresAt) {
    message.textContent = "Please select an expiry time.";

    return;
  }

  if (new Date(expiresAt) <= new Date()) {
    message.textContent = "Expiry time must be in the future.";

    return;
  }

  try {
    const response = await fetch(`${API_URL}/shares`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${getToken()}`,
      },

      body: JSON.stringify({
        documentId: documentId,

        email: email,

        expiresAt: new Date(expiresAt).toISOString(),
      }),
    });

    const data = await response.json();

    console.log("Share response:", response.status, data);

    message.textContent = data.message || "Sharing completed.";

    if (response.ok) {
      emailInput.value = "";

      await loadAuditLogs();

      setTimeout(() => {
        const formContainer = document.getElementById(
          `shareForm-${documentId}`,
        );

        if (formContainer) {
          formContainer.style.display = "none";
        }
      }, 1000);
    }
  } catch (error) {
    console.error("Share error:", error);

    message.textContent = "Sharing failed. Server may be offline.";
  }
}

// =========================
// DOWNLOAD DOCUMENT
// =========================

async function downloadDocument(id) {
  try {
    const response = await fetch(`${API_URL}/documents/download/${id}`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (response.status === 401) {
      alert("Session expired. Please login again.");

      localStorage.removeItem("token");

      window.location.href = "index.html";

      return;
    }

    if (!response.ok) {
      const data = await response.json();

      alert(data.message || "Download failed");

      return;
    }

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "document";

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Download error:", error);

    alert("Download failed");
  }
}

// =========================
// DELETE DOCUMENT
// =========================

async function deleteDocument(id) {
  const confirmed = confirm("Are you sure you want to delete this document?");

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/documents/${id}`, {
      method: "DELETE",

      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    const data = await response.json();

    if (response.status === 401) {
      alert("Session expired. Please login again.");

      localStorage.removeItem("token");

      window.location.href = "index.html";

      return;
    }

    alert(data.message || "Delete completed");

    if (response.ok) {
      await loadDocuments();

      await loadAuditLogs();
    }
  } catch (error) {
    console.error("Delete error:", error);

    alert("Delete failed");
  }
}

// =========================
// LOAD SHARED DOCUMENTS
// =========================

async function loadSharedDocuments() {
  const container = document.getElementById("sharedDocumentsList");

  if (!container) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/shares/received`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    const data = await response.json();

    const sharedCount = document.getElementById("sharedCount");

    if (sharedCount) {
      sharedCount.textContent = data.shares ? data.shares.length : 0;
    }

    console.log("Shared documents:", response.status, data);

    if (response.status === 401) {
      container.innerHTML = "<p>Session expired. Please login again.</p>";

      return;
    }

    if (!response.ok) {
      container.innerHTML = `
                <p>
                    ${escapeHTML(
                      data.message || "Failed to load shared documents",
                    )}
                </p>
            `;

      return;
    }

    if (!data.shares || data.shares.length === 0) {
      container.innerHTML = "<p>No documents have been shared with you.</p>";

      return;
    }

    container.innerHTML = "";

    data.shares.forEach((share) => {
      const div = document.createElement("div");

      div.className = "document-item";

      div.innerHTML = `

    <strong>
        ${escapeHTML(share.document.originalName)}
    </strong>

    <p>
        Shared by:
        ${escapeHTML(share.sharedBy.email)}
    </p>

    <p>
        Expires:
        ${new Date(share.expiresAt).toLocaleString()}
    </p>

    <button
        onclick="downloadSharedDocument('${share._id}')"
    >
        Download
    </button>

`;

      container.appendChild(div);
    });
  } catch (error) {
    console.error("Shared documents error:", error);

    container.innerHTML = "<p>Failed to load shared documents.</p>";
  }
}

async function downloadSharedDocument(shareId) {
  try {
    const response = await fetch(`${API_URL}/shares/download/${shareId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (response.status === 401) {
      alert("Session expired. Please login again.");
      localStorage.removeItem("token");
      window.location.href = "index.html";
      return;
    }

    if (!response.ok) {
      const data = await response.json();
      alert(data.message || "Shared download failed");
      return;
    }

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "shared-document";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);

    await loadAuditLogs();
  } catch (error) {
    console.error("Shared download error:", error);
    alert("Shared download failed");
  }
}

// =========================
// LOAD AUDIT LOGS
// =========================

async function loadAuditLogs() {
  const container = document.getElementById("auditLogs");

  if (!container) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/audit`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    const data = await response.json();

    const activityCount = document.getElementById("activityCount");

    if (activityCount) {
      activityCount.textContent = data.logs ? data.logs.length : 0;
    }

    console.log("Audit logs:", response.status, data);

    if (response.status === 401) {
      container.innerHTML = "<p>Session expired. Please login again.</p>";

      return;
    }

    if (!response.ok) {
      container.innerHTML = `
                <p>
                    ${escapeHTML(
                      data.message || "Failed to load activity logs",
                    )}
                </p>
            `;

      return;
    }

    if (!data.logs || data.logs.length === 0) {
      container.innerHTML = "<p>No activity yet.</p>";

      return;
    }

    container.innerHTML = "";

    data.logs.forEach((log) => {
      const div = document.createElement("div");

      div.className = "log-item";

      div.innerHTML = `

                <strong>
                    ${escapeHTML(log.action)}
                </strong>

                <p>
                    ${escapeHTML(log.details)}
                </p>

                <small>
                    ${new Date(log.createdAt).toLocaleString()}
                </small>

            `;

      container.appendChild(div);
    });
  } catch (error) {
    console.error("Audit logs error:", error);

    container.innerHTML = "<p>Failed to load activity logs.</p>";
  }
}

// =========================
// BASIC HTML SAFETY
// =========================

function escapeHTML(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayDocuments(documents) {

    const container =
        document.getElementById("documentsList");

    if (!documents || documents.length === 0) {
        container.innerHTML =
            "<p>No matching documents found.</p>";
        return;
    }

    container.innerHTML = "";

    documents.forEach((doc) => {

        const div = document.createElement("div");

        div.className = "document-item";

        div.innerHTML = `
            <div>
                <strong>
                    ${escapeHTML(doc.originalName)}
                </strong>

                <p>
                    Uploaded:
                    ${new Date(
                        doc.createdAt
                    ).toLocaleString()}
                </p>
            </div>

            <div>
                <button
                    onclick="downloadDocument('${doc._id}')">
                    Download
                </button>

                <button
                    onclick="deleteDocument('${doc._id}')">
                    Delete
                </button>

                <button
                    onclick="showShareForm('${doc._id}')">
                    Share
                </button>
            </div>

            <div
                id="shareForm-${doc._id}"
                style="display:none; margin-top:10px;">
            </div>
        `;

        container.appendChild(div);
    });
}

function sortDocuments() {

    const sortOption =
        document.getElementById("documentSort").value;

    const searchInput =
        document.getElementById("documentSearch");

    const searchText =
        searchInput.value.toLowerCase().trim();

    let filteredDocuments = allDocuments.filter((doc) =>
        doc.originalName
            .toLowerCase()
            .includes(searchText)
    );

    if (sortOption === "newest") {

        filteredDocuments.sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );

    } else if (sortOption === "oldest") {

        filteredDocuments.sort(
            (a, b) =>
                new Date(a.createdAt) -
                new Date(b.createdAt)
        );

    } else if (sortOption === "nameAsc") {

        filteredDocuments.sort(
            (a, b) =>
                a.originalName.localeCompare(
                    b.originalName
                )
        );

    } else if (sortOption === "nameDesc") {

        filteredDocuments.sort(
            (a, b) =>
                b.originalName.localeCompare(
                    a.originalName
                )
        );
    }

    displayDocuments(filteredDocuments);
}

function togglePassword(inputId, button) {

    const input = document.getElementById(inputId);

    if (input.type === "password") {

        input.type = "text";
        button.textContent = "🙈";

    } else {

        input.type = "password";
        button.textContent = "👁";

    }
}