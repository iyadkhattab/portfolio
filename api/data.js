const fs = require("fs");
const path = require("path");

export default function handler(req, res) {
    try {
        const contentPath = path.join(process.cwd(), "content.json");
        const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

        res.status(200).json(content);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Could not load portfolio content"
        });
    }
}