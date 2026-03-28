const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = "AIzaSyCPV10q5K_PGMhKFnkZUUf2bN_sHayqwHw";
const genAI = new GoogleGenerativeAI(API_KEY);

async function test() {
    console.log("Testing with hardcoded key...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Response:", result.response.text());
    } catch (e) {
        console.error("Error Status:", e.status);
        console.error("Error Message:", e.message);
        console.error("Full Error:", JSON.stringify(e, null, 2));
    }
}

test();
