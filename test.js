require('dotenv').config();
const { Connector } = require("@google-cloud/cloud-sql-connector");
const mysql = require("mysql2/promise");

async function displayAllTablesData() {
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

        const [tables] = await pool.query(
            "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name",
            [process.env.DB_NAME]
        );

        if (!tables.length) {
            console.log("No tables found in schema:", process.env.DB_NAME);
            return;
        }

        const sensitiveColumnsByTable = {
            users: new Set(["password", "password_hash"])
        };

        for (const t of tables) {
            const tableName = t.name;
            console.log(`\n=== ${tableName} ===`);

            // Get column list for the table
            const [cols] = await pool.query(
                "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
                [process.env.DB_NAME, tableName]
            );
            if (!cols.length) {
                console.log("(no columns)");
                continue;
            }

            let columnNames = cols.map(c => c.name);
            const sensitive = sensitiveColumnsByTable[tableName];
            if (sensitive) {
                columnNames = columnNames.filter(n => !sensitive.has(n));
                if (!columnNames.length) {
                    console.log("(all columns are sensitive; nothing to display)");
                    continue;
                }
            }

            // Build SELECT query with safe identifier escaping
            let rows;
            try {
                const [result] = await pool.query("SELECT ?? FROM ??", [columnNames, tableName]);
                rows = result;
            } catch (e) {
                console.warn(`Failed to fetch data from ${tableName} with filtered columns, falling back to SELECT *:`, e.message || e);
                const [result] = await pool.query("SELECT * FROM ??", [tableName]);
                rows = result;
            }

            console.log(JSON.stringify(rows, null, 2));
        }
    } catch (error) {
        console.error("Error displaying tables:", error);
    } finally {
        if (pool) {
            await pool.end();
        }
        try { connector.close(); } catch (_) { }
    }
}

displayAllTablesData();