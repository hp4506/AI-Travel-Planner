const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testKey() {
    console.log("Testing with gemini-1.0-pro...");
    const genAI = new GoogleGenerativeAI(process.env.GENERATIVE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
    try {
        const result = await model.generateContent("Say hello");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.error("Failed Code:", e.status);
        console.error("Failed Message:", e.message);
    }
}

testKey();
