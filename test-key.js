const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testKey() {
    console.log("Key:", process.env.GENERATIVE_AI_API_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GENERATIVE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    try {
        const result = await model.generateContent("Say hello");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.error("Failed:", e);
    }
}

testKey();
