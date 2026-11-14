const db = require('./db');
const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (err) => {
    if (err) {
        console.error('Error executing schema:', err.message);
    } else {
        console.log('Database initialized successfully.');
    }
    db.close();
});
