require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3001;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ================= GEMINI INIT =================
let genAI = null;

const MASTER_PROMPT = `
You are CyberShield AI, a cybersecurity assistant for beginners and students.

Your goals:
- Explain concepts in simple English
- Help identify scams and phishing
- Teach using real-life examples
- Be interactive and engaging

Rules:
- No complex jargon
- Keep answers concise (100–150 words)
- Use natural conversational tone

For scam-related queries:
- Highlight red flags
- Explain psychology (urgency, fear, trust)
- Give prevention tips

Behavior:
- If user is wrong → gently correct
- If user is right → encourage briefly
- End with a helpful tip or question
`;
if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("xxxx")) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("✅ Gemini AI Connected");
} else {
    console.log("⚠️ Gemini AI NOT configured - running in fallback mode");
}

// ================= FALLBACKS =================
function fallbackScan(input) {
    return {
        score: 50,
        verdict: "Suspicious",
        explanation: "AI offline. Basic rule-based scan suggests caution."
    };
}

function fallbackChat(message) {
    return {
        reply: "AI offline. Please configure GEMINI_API_KEY in .env file."
    };
}

// ================= RULE ENGINE =================
function ruleBasedScan(input) {
    const text = input.toLowerCase();
    let score = 0;
    let reasons = [];

    if (text.includes("http://")) {
        score += 30;
        reasons.push("Insecure HTTP link detected");
    }

    if (text.includes("urgent") || text.includes("verify") || text.includes("account")) {
        score += 25;
        reasons.push("Urgency/fear based wording");
    }

    if (text.includes("otp") || text.includes("password") || text.includes("bank")) {
        score += 30;
        reasons.push("Sensitive information request");
    }

    if (text.includes("login") || text.includes(".xyz") || text.includes("update")) {
        score += 20;
        reasons.push("Suspicious login/update pattern");
    }

    if (score > 100) score = 100;

    let verdict = "Safe";
    if (score >= 70) verdict = "Scam";
    else if (score >= 40) verdict = "Suspicious";

    return { score, verdict, reasons };
}

// ================= ROUTES =================

// 🧪 SCAN API
app.post("/scan", async (req, res) => {
    try {
        const { input, inlineData } = req.body;

        if (!input && !inlineData) {
            return res.status(400).json({ error: "Input text or image is required" });
        }

        const ruleResult = ruleBasedScan(input || "Image Uploaded");

        let explanation = "";

        if (genAI) {
            try {
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash"
                });

                const prompt = `
${MASTER_PROMPT}

Now analyze this message (and attached image if provided):

"${input || '[Image Attached]'}"

Return the analysis in exactly these sections, using clear HTML bold tags for headers like <b>Verdict:</b>

<b>Verdict:</b>
(Scam / Suspicious / Safe)

<b>Reason:</b>
(1-2 sentences explaining exactly why)

<b>Red Flags:</b>
(Bullet points of key warning signs detected)

<b>Prevention:</b>
(What to do next to stay safe)
`;
                let scanResult;
                if (inlineData) {
                    scanResult = await model.generateContent([
                        {
                            role: "user",
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: inlineData.mimeType,
                                        data: inlineData.data
                                    }
                                }
                            ]
                        }
                    ]);
                } else {
                    scanResult = await model.generateContent(prompt);
                }

                const response = await scanResult.response;
                explanation = response.text().replace(/\n/g, " <br><br> ");

            } catch (aiError) {
                console.error("Gemini Scan Error:", aiError);
                explanation = "Basic scan result: " + ruleResult.reasons.join(", ");
            }
        } else {
            explanation = "Basic scan result: " + (ruleResult.reasons.join(", ") || "No major threats detected");
        }

        res.json({
            score: ruleResult.score,
            verdict: ruleResult.verdict,
            explanation
        });

    } catch (error) {
        console.error("Scan Error:", error);
        res.status(500).json({ error: "Scan failed" });
    }
});


// 💬 CHAT API
app.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        let reply = "";

        if (genAI) {
            try {
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash"
                });

                const prompt = `
${MASTER_PROMPT}

User question:
"${message}"

Instructions:
- Make your response extremely human, interactive, and helpful.
- Keep the response short (100–120 words).
- Add a small real-life example to help them understand.
- Always end with a follow-up question to keep them engaged.
`;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                reply = response.text().replace(/\n/g, " ");

            } catch (aiError) {
                console.error("Gemini Chat Error:", aiError);
                reply = "AI error occurred. Please try again later.";
            }
        } else {
            reply = fallbackChat(message).reply;
        }

        res.json({ reply });

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: "Chat failed" });
    }
});

// 🎮 SIMULATION API
app.post("/simulate", async (req, res) => {
    try {
        const { scenario, userAction, isEnding, status } = req.body;

        if (!scenario) {
            return res.status(400).json({ error: "Scenario is required" });
        }

        let responseText = "";

        if (genAI) {
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash"
            });

            let prompt;
            if (isEnding) {
                prompt = `
You are an expert cybersecurity analyst reviewing a completed scam simulation.
Scenario: ${scenario}
Final Action Taken: ${userAction}
Outcome: ${status === 'safe' ? 'User successfully defeated the scam' : 'User was compromised'}

Generate a brief, beginner-friendly post-game analysis returning EXACTLY these 4 HTML bold sections:

<b>Mistake Made:</b>
(If they won, say what trap they avoided. If compromised, explain exactly why their action failed.)

<b>Psychological Trick:</b>
(What mental manipulation the attacker relied on, e.g., Fear, Greed, Authority.)

<b>Real-World Example:</b>
(Give a 1-sentence example of this exact scam happening to real people.)

<b>Correct Action:</b>
(What is the absolute best practice to handle this situation next time.)
`;
            } else {
                prompt = `
You are simulating a realistic cyber scam scenario.

Scenario:
${scenario}

User action:
${userAction || "User is starting the simulation"}

Instructions:
- Act entirely like the attacker or malicious system. DO NOT break character.
- Escalate urgency constantly to put pressure on the user.
- Utilize deep psychological tricks (fear of closing account, greed for prize, blind authority).
- Adapt heavily based on their previous action (if they probe, get defensive or offer fake proof).
- Highlight danger level (Low/Medium/High).
- Keep it extremely short, tense, and realistic. 
- Ask user: "What will you do next?"
`;
            }

            const simResult = await model.generateContent(prompt);
            const response = await simResult.response;
            responseText = response.text().replace(/\n/g, " ");

        } else {
            responseText = "Simulation unavailable. AI not configured.";
        }

        res.json({ reply: responseText });

    } catch (error) {
        console.error("Simulation Error:", error);
        res.status(500).json({ error: "Simulation failed" });
    }
});

// ================= SERVER START =================
app.listen(PORT, () => {
    console.log(`🚀 CyberShield running at http://localhost:${PORT}`);
});