let mongoose = require('mongoose');
const uri = process.env.FOB_DB_URI;

class Database {
    constructor() {
        this._connect();
    }

    _connect() {
        mongoose
            .connect(uri)
            .then(() => {
                console.log('Database connection successful');
            })
            .catch(() => {
                console.error('Database connection error');
            });
    }
}

module.exports = new Database();