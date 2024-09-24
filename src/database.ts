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
                console.log('Successfully connected to the database!');
            })
            .catch(() => {
                console.error('Error while connecting to database...');
            });
    }
}

module.exports = new Database();