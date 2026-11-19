const cds = require('@sap/cds');
const path = require('path');
const fs = require('fs');

let appPromise = null;

async function getApp() {
    if (!appPromise) {
        appPromise = (async () => {
            const projectRoot = path.resolve(__dirname, '..');
            process.chdir(projectRoot);

            // In serverless runtime (e.g. Vercel), copy db to /tmp if writable DB is needed
            const tmpDb = path.join('/tmp', 'db.sqlite');
            const localDb = path.join(projectRoot, 'db.sqlite');

            if (fs.existsSync(localDb)) {
                try {
                    if (!fs.existsSync(tmpDb)) {
                        fs.copyFileSync(localDb, tmpDb);
                    }
                    cds.env.requires.db = { kind: 'sqlite', credentials: { url: tmpDb } };
                } catch (e) {
                    cds.env.requires.db = { kind: 'sqlite', credentials: { url: localDb } };
                }
            }

            // Ensure mocked auth in serverless
            cds.env.requires.auth = { kind: 'mocked' };

            // Start server instance
            await cds.server();
            return cds.app;
        })();
    }
    return appPromise;
}

module.exports = async (req, res) => {
    try {
        const app = await getApp();
        return app(req, res);
    } catch (err) {
        console.error('Vercel serverless error:', err);
        res.status(500).json({ error: 'Serverless execution error: ' + err.message });
    }
};
