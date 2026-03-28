const { GoogleGenerativeAI } = require('@google/generative-ai');

const FIREBASE_KEY = "AIzaSyB_s_KrEgSkKPKBxglEEvnLpwWW8BdS72U";
const genAI = new GoogleGenerativeAI(FIREBASE_KEY);

async function test() {
    console.log("Testing with Firebase key...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Response:", result.response.text());
    } catch (e) {
        console.error("Error Status:", e.status);
        console.error("Error Message:", e.message);
    }
}

test();
