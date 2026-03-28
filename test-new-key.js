const { GoogleGenerativeAI } = require('@google/generative-ai');

const NEW_KEY = "AIzaSyAQbIjayyBgNvTlX2YqOWU_PgB--NQNiyU";
const genAI = new GoogleGenerativeAI(NEW_KEY);

async function test() {
    console.log("Testing new key directly...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello! Are you working?");
        console.log("Response:", result.response.text());
    } catch (e) {
        console.error("Error Status:", e.status);
        console.error("Error Message:", e.message);
    }
}

test();
