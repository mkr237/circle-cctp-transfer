module.exports = {
    apiKey: process.env.CIRCLE_API_KEY || "YOUR_API_KEY",
    entitySecret: process.env.CIRCLE_ENTITY_SECRET || null,
    apiVersion: "v1",
    apiBase: "https://api.circle.com"
};
