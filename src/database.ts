let mongoose = require('mongoose');
const uri = "mongodb+srv://fobAdmin:lzHdWT2ORKAYZLp0@forgeofbattles.xkdcf.mongodb.net/forge_of_battles?retryWrites=true&w=majority&appName=ForgeOfBattles";

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