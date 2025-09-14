require('dotenv').config();
const { Connector } = require("@google-cloud/cloud-sql-connector");
const mysql = require("mysql2/promise");

async function displayUsersTableData() {
    const connector = new Connector();
    let pool;
    try {
        const clientOpts = await connector.getOptions({
            instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
            ipType: "PUBLIC",
        });

        pool = mysql.createPool({
            ...clientOpts,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });

        console.log("\n=== users ===");
        // Discover available columns and exclude sensitive ones
        const [cols] = await pool.query(
            "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users' ORDER BY ordinal_position",
            [process.env.DB_NAME]
        );
        if (!cols.length) {
            console.log("users table not found or has no columns");
            return;
        }
        const sensitive = new Set(["password", "password_hash"]);
        const columnNames = cols.map(c => c.name).filter(n => !sensitive.has(n));
        if (!columnNames.length) {
            console.log("users table has only sensitive columns; nothing to display");
            return;
        }
        const orderBy = columnNames.includes("id") ? "id" : columnNames[0];
        const selectSql = "SELECT ?? FROM users ORDER BY ??";
        const [rows] = await pool.query(selectSql, [columnNames, orderBy]);
        console.log(JSON.stringify(rows, null, 2));

    } catch (error) {
        console.error("Error displaying tables:", error);
    } finally {
        if (pool) {
            await pool.end();
        }
        try { connector.close(); } catch (_) { }
    }
}

displayUsersTableData();