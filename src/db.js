const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Test database connection
pool.getConnection()
    .then((connection) => {
        console.log('Database connected successfully');
        connection.release();
    })
    .catch((error) => {
        console.error('Error connecting to database:', error);
    });

module.exports = pool;
