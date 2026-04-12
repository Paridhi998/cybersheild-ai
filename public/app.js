// --- NAVIGATION LOGIC ---
function showSection(sectionId, event) {
    // Hide all sections
    document.querySelectorAll('section').forEach(sec => {
        sec.classList.remove('active-section');
        sec.classList.add('hidden');
    });

    // Remove active class from all nav links
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected section
    const target = document.getElementById(sectionId);
    target.classList.remove('hidden');
    target.classList.add('active-section');

    // Highlight clicked nav
    if (event) {
        event.currentTarget.classList.add('active');
    }
}
// --- GLOBAL DASHBOARD LOGIC ---
const globalStats = {
    scamsAnalyzed: 0,
    simulationsCompleted: 0,
    improvementScore: 0
};

function updateGlobalDashboard() {
    document.getElementById('dash-scams').innerText = globalStats.scamsAnalyzed;
    document.getElementById('dash-sims').innerText = globalStats.simulationsCompleted;
    
    // Improvement Score logic: caps at 100%, grows faster if you analyze scams and beat simulations safely
    let score = Math.floor(globalStats.scamsAnalyzed * 5 + globalStats.improvementScore);
    if (score > 100) score = 100;
    
    document.getElementById('dash-improvement').innerText = `${score}%`;
}

// --- 1. SMART SCANNER LOGIC ---
let selectedImageBase64 = null;
let selectedImageMimeType = null;

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Strip out the data:image/png;base64, prefix
            const result = e.target.result;
            const base64Data = result.split(',')[1];
            selectedImageBase64 = base64Data;
            
            // Gemini API strict MIME types:
            selectedImageMimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
            
            document.getElementById('file-preview').classList.remove('hidden');
            document.getElementById('file-preview').classList.add('fade-in');
            document.getElementById('file-name').innerText = `🖼️ Image Attached: ${file.name}`;
            document.getElementById('scan-input').placeholder = "Image loaded. (Optional) Add extra context here...";
        };
        reader.readAsDataURL(file);
    } else if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('scan-input').value = e.target.result;
        };
        reader.readAsText(file);
    } else {
        alert("Unsupported file type. Please upload an image or text file.");
    }
}

function clearUpload() {
    selectedImageBase64 = null;
    selectedImageMimeType = null;
    document.getElementById('file-upload').value = '';
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('scan-input').placeholder = "e.g. http://login.bank-update123.com or 'Urgent: Verify your account now!'...";
}

async function analyzeInput() {
    const inputField = document.getElementById('scan-input');
    const input = inputField.value.trim();
    
    if (!input && !selectedImageBase64) {
        return alert("Please enter text, a URL, or upload a screenshot to scan.");
    }

    const btn = document.getElementById('scan-btn');
    btn.innerHTML = '<span class="typing-effect">Scanning Target...</span>';
    btn.disabled = true;
    
    // Add loading feedback to UI smoothly before fetch
    const resultsContainer = document.getElementById('scan-results');
    resultsContainer.classList.remove('hidden');
    resultsContainer.classList.add('fade-in');
    
    document.getElementById('risk-score').innerText = "...";
    document.getElementById('verdict-banner').innerText = "ANALYZING";
    document.getElementById('verdict-banner').className = 'verdict-suspicious';
    document.getElementById('ai-explanation').innerHTML = '<em><span class="typing-effect">Deep scanning mechanisms engaged... this takes a few seconds.</span></em>';

    try {
        const reqBody = { input };
        if (selectedImageBase64) {
            reqBody.inlineData = {
                data: selectedImageBase64,
                mimeType: selectedImageMimeType
            };
        }

        const response = await fetch('/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        // Update UI
        resultsContainer.classList.remove('hidden');

        // Animate score
        animateValue("risk-score", 0, data.score, 1000);

        const banner = document.getElementById('verdict-banner');
        banner.innerText = data.verdict;
        banner.className = ''; // reset
        banner.classList.add(`verdict-${data.verdict.toLowerCase()}`);

        document.getElementById('ai-explanation').innerHTML = data.explanation; // Using innerHTML to support <br> from the formatted report

        // Update dashboard stats
        globalStats.scamsAnalyzed++;
        updateGlobalDashboard();

    } catch (error) {
        console.error("Scan error:", error);
        alert("Server Error: " + error.message);
        document.getElementById('ai-explanation').innerHTML = "Scan failed. Please verify your connection or check terminal logs.";
        document.getElementById('verdict-banner').innerText = "ERROR";
    } finally {
        btn.innerHTML = 'Scan Now';
        btn.disabled = false;
        clearUpload(); // Auto-clear upload after scan completes
    }
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Helper from Manual to Scanner
function testInScanner(exampleText) {
    showSection('scanner-section');
    document.getElementById('scan-input').value = exampleText;

    // update navbar active state manually
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    document.querySelector('.nav-links a[onclick="showSection(\'scanner-section\')"]').classList.add('active');
}

// --- 2. AI ASSISTANT LOGIC ---
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    appendMessage(msg, 'user-msg');
    input.value = '';

    // Show loading
    const loadingId = appendMessage('Typing...', 'bot-msg');

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await response.json();

        // Replace loading msg
        document.getElementById(loadingId).innerText = data.reply || "Error: No reply.";

    } catch (error) {
        console.error("Chat error:", error);
        document.getElementById(loadingId).innerText = "Sorry, I'm having trouble connecting to the server.";
    }
}

function appendMessage(text, className) {
    const windowDiv = document.getElementById('chat-window');
    const msgDiv = document.createElement('div');
    const id = 'msg-' + Date.now();
    msgDiv.id = id;
    msgDiv.className = `chat-message ${className} fade-in`;
    msgDiv.innerText = text;
    windowDiv.appendChild(msgDiv);
    windowDiv.scrollTop = windowDiv.scrollHeight;
    return id;
}

// Enter key to send chat
document.getElementById('chat-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});

// --- 3. GAMIFIED AI SIMULATOR LOGIC ---
const simulationState = {
    scenario: "",
    riskLevel: 20,
    xp: 0,
    level: "Beginner",
    lastActions: [],
    status: "active", // active, compromised, safe
    badges: new Set()
};

function updateGamification(xpDelta) {
    if (xpDelta !== 0) {
        simulationState.xp += xpDelta;
        if (simulationState.xp < 0) simulationState.xp = 0;
        document.getElementById('player-xp').innerText = `${simulationState.xp} XP`;
    }

    // Level calculation (Beginner 0-30, Intermediate 31-70, Advanced 71+)
    if (simulationState.xp > 70) simulationState.level = "Advanced";
    else if (simulationState.xp > 30) simulationState.level = "Intermediate";
    else simulationState.level = "Beginner";

    const levelSpan = document.getElementById('player-level');
    levelSpan.innerText = simulationState.level;
    levelSpan.className = `gf-value level-${simulationState.level.toLowerCase()}`;

    // Badge logic
    const badgesDiv = document.getElementById('player-badges');
    if (simulationState.xp >= 30 && !simulationState.badges.has("Scam Detector")) {
        simulationState.badges.add("Scam Detector");
        badgesDiv.innerHTML += `<span class="badge" title="Reached Intermediate level">🛡️ Scam Detector</span>`;
    }
    if (simulationState.xp >= 70 && !simulationState.badges.has("Phishing Expert")) {
        simulationState.badges.add("Phishing Expert");
        badgesDiv.innerHTML += `<span class="badge" title="Reached Advanced level">🧠 Phishing Expert</span>`;
    }
    if (simulationState.xp >= 150 && !simulationState.badges.has("Cyber Guardian")) {
        simulationState.badges.add("Cyber Guardian");
        badgesDiv.innerHTML += `<span class="badge" title="Mastered the simulations">🌐 Cyber Guardian</span>`;
    }
}

function updateRiskMeter(addedRisk) {
    simulationState.riskLevel += addedRisk;
    if (simulationState.riskLevel < 0) simulationState.riskLevel = 0;
    if (simulationState.riskLevel > 100) simulationState.riskLevel = 100;

    const bar = document.getElementById('sim-risk-bar');
    bar.style.width = simulationState.riskLevel + '%';
    
    // Smooth Transition UI (0-30 Green, 31-70 Yellow, 71+ Red)
    const riskLabel = document.getElementById('risk-label');
    bar.classList.remove('bg-green', 'bg-yellow', 'bg-red');
    
    if (simulationState.riskLevel <= 30) {
        bar.classList.add('bg-green');
        riskLabel.innerHTML = `Threat Level: <span style="color:#10b981;">LOW</span>`;
    } else if (simulationState.riskLevel <= 70) {
        bar.classList.add('bg-yellow');
        riskLabel.innerHTML = `Threat Level: <span style="color:#f59e0b;">MEDIUM</span>`;
    } else {
        bar.classList.add('bg-red');
        riskLabel.innerHTML = `Threat Level: <span style="color:#ef4444;">HIGH</span>`;
    }
}

async function startAdvancedSimulation(scenarioName) {
    simulationState.scenario = scenarioName;
    simulationState.lastActions = [];
    simulationState.riskLevel = 20;
    simulationState.status = "active";
    
    document.getElementById('sim-scenarios').classList.add('hidden');
    document.getElementById('sim-interactive-area').classList.remove('hidden');
    document.getElementById('sim-analysis').classList.add('hidden');
    document.getElementById('sim-chat-history').innerHTML = '';
    
    document.getElementById('quiz-section').classList.add('screen-flash');
    setTimeout(() => document.getElementById('quiz-section').classList.remove('screen-flash'), 500);

    updateRiskMeter(0);
    renderActionButtons(["System Boot...", "Connecting..."]);
    
    appendToTerminal("System", `Initializing Scenario: ${scenarioName}...`);
    await fetchSimulationTurn("User joins scenario.");
}

async function fetchSimulationTurn(userAction) {
    if (simulationState.status !== "active") return;

    // Show typing
    document.getElementById('sim-typing-indicator').classList.remove('hidden');
    renderActionButtons([]); // Disable buttons instantly

    // Append to memory (max 3)
    simulationState.lastActions.push(userAction);
    if (simulationState.lastActions.length > 3) simulationState.lastActions.shift();

    try {
        const response = await fetch('/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                scenario: simulationState.scenario,
                userAction: simulationState.lastActions.join(" -> ")
            })
        });

        const data = await response.json();
        const aiText = data.reply || "Connection lost.";

        document.getElementById('sim-typing-indicator').classList.add('hidden');
        appendToTerminal("Attacker", aiText);

        if (simulationState.riskLevel > 80) {
            triggerScenarioEnd("compromised", aiText);
        } else if (simulationState.riskLevel === 0) {
            triggerScenarioEnd("safe", aiText);
        } else {
            renderDynamicOptions();
        }

    } catch (error) {
        console.error("Simulation error:", error);
        document.getElementById('sim-typing-indicator').classList.add('hidden');
        appendToTerminal("System ERROR", "Failed to connect to simulation backend.");
    }
}

function renderDynamicOptions() {
    // Determine dynamic options based on context/risk
    // Exact requested increments: Dangerous (-10 XP, +40 risk), Smart (+15 XP, +10 Risk), Safe (+10 XP, -40/-30 Risk)
    
    const options = [
        { label: "Click Link / Obey", risk: +40, xp: -10, text: "I will click the link or follow the instruction." },
        { label: "Probing Question", risk: +10, xp: +15, text: "Can you provide more proof? Who is this exactly?" },
        { label: "Ignore Request", risk: -40, xp: +10, text: "I am ignoring this request." },
        { label: "Report & Block", risk: -100, xp: +15, text: "I have reported this as fraud and blocked you." }
    ];

    renderActionButtons(options.map(opt => `<button class="sim-action-btn" onclick="takeAction('${opt.text}', ${opt.risk}, ${opt.xp})">${opt.label}</button>`));
}

function renderActionButtons(htmlArray) {
    document.getElementById('sim-action-buttons').innerHTML = typeof htmlArray === 'string' ? htmlArray : htmlArray.join('');
}

function appendToTerminal(sender, text) {
    const historyDiv = document.getElementById('sim-chat-history');
    const msgDiv = document.createElement('div');
    
    let senderClass = "system-msg";
    if (sender === "Attacker") senderClass = "ai-msg";
    if (sender === "You") senderClass = "user-msg";

    msgDiv.className = `terminal-msg ${senderClass}`;
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    
    historyDiv.appendChild(msgDiv);
    
    // Auto-scroll logic inside the container
    const container = document.getElementById('sim-screen');
    container.scrollTop = container.scrollHeight;
}

function takeAction(actionText, riskDelta, xpDelta) {
    appendToTerminal("You", actionText);
    updateRiskMeter(riskDelta);
    updateGamification(xpDelta);

    if (simulationState.riskLevel > 80) {
        triggerScenarioEnd("compromised", "You fell for the psychological manipulation and exposed your data.");
        return;
    }
    
    if (simulationState.riskLevel <= 0 || actionText.includes("Report")) {
        triggerScenarioEnd("safe", "You successfully identified and bypassed the threat!");
        return;
    }

    fetchSimulationTurn(actionText);
}

async function triggerScenarioEnd(endStatus, endText) {
    simulationState.status = endStatus;
    
    document.getElementById('sim-interactive-area').classList.add('hidden');
    document.getElementById('sim-analysis').classList.remove('hidden');

    const banner = document.getElementById('end-status-banner');
    const title = document.getElementById('sim-analysis-title');
    const expl = document.getElementById('sim-analysis-text');

    if (endStatus === "safe") {
        banner.innerText = "ATTACK PREVENTED";
        banner.className = "glitch-success";
        title.innerText = "Scenario Defeated";
        title.style.color = "#10b981";
        globalStats.improvementScore += 20; // Big boost for winning
    } else {
        banner.innerText = "ACCOUNT COMPROMISED";
        banner.className = "glitch-warning";
        title.innerText = "Incident Report";
        title.style.color = "#ef4444";
        globalStats.improvementScore -= 5; // Penalty for failing
        if (globalStats.improvementScore < 0) globalStats.improvementScore = 0;
    }

    // Update global variables
    globalStats.simulationsCompleted++;
    updateGlobalDashboard();

    expl.innerHTML = `<em>Generating detailed AI Post-Game Analysis...</em>`;

    try {
        const response = await fetch('/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                scenario: simulationState.scenario,
                userAction: simulationState.lastActions.join(" -> ") || "No actions taken",
                isEnding: true,
                status: endStatus
            })
        });

        const data = await response.json();
        // Render identical to scanner layout, sharing the exact same CSS we built for the explanation-box
        expl.innerHTML = `<div class="explanation-box">${data.reply.replace(/\n/g, '<br>')}</div>`;

    } catch (err) {
        console.error("AI Analysis Failed", err);
        expl.innerHTML = `${endText}<br><br><strong>Analysis Error:</strong> Could not retrieve AI break down.`;
    }
}

function resetSimulation() {
    document.getElementById('sim-scenarios').classList.remove('hidden');
    document.getElementById('sim-analysis').classList.add('hidden');
    document.getElementById('sim-interactive-area').classList.add('hidden');
    updateRiskMeter(-100); // Reset UI to green
}

// --- 4. CYBER TRAINING ZONE (LEARN SECTION) LOGIC ---
const trainingQuestions = [
    {
        type: "quiz",
        question: "What is the primary difference between HTTP and HTTPS?",
        choices: [
            { text: "HTTPS encrypts your information", isCorrect: true, explanation: "HTTPS uses SSL/TLS encryption to protect data like passwords in transit." },
            { text: "HTTP is faster for banking", isCorrect: false, explanation: "HTTP is unencrypted and should NEVER be used for banking." },
            { text: "They are exactly the same", isCorrect: false, explanation: "HTTPS adds a critical layer of encryption over standard HTTP." }
        ]
    },
    {
        type: "scenario",
        tag: "REAL SCENARIO",
        question: "You received a text: 'URGENT! Your BankAccount will be locked in 2hrs. Click here to verify: http://secure-update-123.com'",
        choices: [
            { text: "Click the link immediately", isCorrect: false, explanation: "Scammers use 'Urgency' to cause panic. Also, the link uses insecure HTTP and a fake domain." },
            { text: "Ignore & Delete", isCorrect: false, explanation: "While safe, the BEST action is to report it so the domain gets blocked." },
            { text: "Report phishing & Block number", isCorrect: true, explanation: "Perfect! Reporting protects you and helps authorities shut down the scam link." }
        ]
    },
    {
        type: "quiz",
        question: "A legitimate company will NEVER ask you for your...?",
        choices: [
            { text: "Full Name", isCorrect: false, explanation: "Companies often ask for your name for verification." },
            { text: "One-Time Password (OTP)", isCorrect: true, explanation: "OTPs are for your eyes only. Support staff will never ask you to read back an OTP." },
            { text: "Email Address", isCorrect: false, explanation: "Emails are standard contact info." }
        ]
    },
    {
        type: "scenario",
        tag: "REAL SCENARIO",
        question: "An email from 'Netflix Support' says your payment failed. It addresses you as 'Dear Customer' instead of your name.",
        choices: [
            { text: "Update payment info immediately", isCorrect: false, explanation: "Never click links in generic emails. Check your account directly via the app." },
            { text: "Log in via the official app to check", isCorrect: true, explanation: "Correct! Bypassing the email link ruins their trap. Generic greetings are a huge red flag." },
            { text: "Reply asking if it's real", isCorrect: false, explanation: "Replying confirms your email is active, leading to more spam." }
        ]
    }
];

let currentTrainingIndex = 0;
let trainingXP = 0;

function startTrainingSession() {
    currentTrainingIndex = 0;
    trainingXP = 0;
    updateTrainingXPUI();
    
    document.getElementById('training-start-screen').classList.add('hidden');
    document.getElementById('training-completion-screen').classList.add('hidden');
    document.getElementById('training-active-container').classList.remove('hidden');
    
    renderTrainingQuestion();
}

function updateTrainingXPUI() {
    document.getElementById('training-xp-display').innerText = trainingXP;
}

function spawnFloatingXP(btnElement) {
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-xp';
    floatEl.innerText = '+10 XP';
    
    // Position near the button click
    const rect = btnElement.getBoundingClientRect();
    floatEl.style.left = `${rect.left + (rect.width / 2)}px`;
    floatEl.style.top = `${rect.top}px`;
    
    document.body.appendChild(floatEl);
    
    setTimeout(() => {
        if (document.body.contains(floatEl)) {
            document.body.removeChild(floatEl);
        }
    }, 1200);
}

function renderTrainingQuestion() {
    const q = trainingQuestions[currentTrainingIndex];
    document.getElementById('training-feedback-box').classList.add('hidden');
    document.getElementById('training-choices-grid').innerHTML = ''; // Clear previous
    document.getElementById('training-choices-grid').style.pointerEvents = 'auto'; // allow clicks
    
    // Set Question text and Tag
    document.getElementById('training-question-text').innerText = q.question;
    const tag = document.getElementById('training-scenario-tag');
    if (q.type === 'scenario') {
        tag.innerText = q.tag || "SCENARIO";
        tag.style.background = "#f59e0b"; // Yellow for scenario
    } else {
        tag.innerText = "QUIZ";
        tag.style.background = "#3b82f6"; // Blue for quiz
    }

    // Render Buttons pure JS
    q.choices.forEach((choice, idx) => {
        const btn = document.createElement('button');
        btn.className = 'sim-btn';
        btn.style.width = '100%';
        btn.innerText = choice.text;
        
        btn.addEventListener('click', function(e) {
            handleTrainingAnswer(choice, btn, e.target);
        });
        
        document.getElementById('training-choices-grid').appendChild(btn);
    });
}

function handleTrainingAnswer(choiceItem, btnElement) {
    // Freeze other inputs
    document.getElementById('training-choices-grid').style.pointerEvents = 'none';
    
    const feedbackBox = document.getElementById('training-feedback-box');
    const title = document.getElementById('training-feedback-title');
    const text = document.getElementById('training-feedback-text');
    
    feedbackBox.classList.remove('hidden');
    feedbackBox.classList.add('fade-in');
    
    if (choiceItem.isCorrect) {
        // Correct Action
        btnElement.classList.add('glow-green');
        title.innerText = "Correct! ✅";
        title.style.color = "#10b981";
        
        trainingXP += 10;
        updateTrainingXPUI();
        spawnFloatingXP(btnElement);
        
        // Also feed global improvement score organically
        globalStats.improvementScore += 2; 
        updateGlobalDashboard();
        
    } else {
        // Wrong Action
        btnElement.classList.add('shake-red');
        title.innerText = "Incorrect ❌";
        title.style.color = "#ef4444";
    }
    
    text.innerText = choiceItem.explanation;
}

function nextTrainingQuestion() {
    currentTrainingIndex++;
    if (currentTrainingIndex >= trainingQuestions.length) {
        // Show completion
        document.getElementById('training-active-container').classList.add('hidden');
        document.getElementById('training-completion-screen').classList.remove('hidden');
    } else {
        renderTrainingQuestion();
    }
}

function resetTrainingSession() {
    startTrainingSession();
}
