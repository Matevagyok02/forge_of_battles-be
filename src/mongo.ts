let mongoose = require('mongoose');
const uri = process.env.FOB_MONGO_URI;

class Mongo {
    constructor() {
        this._connect();
    }

    _connect() {
        mongoose
            .connect(uri)
            .then(() => {
                console.log('MongoDB connected');
            })
            .catch(() => {
                console.error('MongoDB connection failed...');
            });
    }
}

module.exports = new Mongo();