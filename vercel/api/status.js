// vercel-backend/api/status.js
// Use Vercel Serverless Functions to query your Render backend

export default async function handler(req, res) {
    const response = await fetch(`${process.env.RENDER_BACKEND_URL}/api/status`);
    const data = await response.json();
    res.status(200).json(data);
}
