import {MatchModel} from "./models/Match";

let mongoose = require('mongoose');
const uri = process.env.FOB_MONGO_URI;
const inactivityTime = require("../game-rules.json").inactivityTime * 60 //inactivity time converted to seconds

class Mongo {
    constructor() {
        this._connect();
    }

    _connect() {
        mongoose
            .connect(uri)
            .then(() =>
                MatchModel.collection.dropIndex("updatedAt_1")
                    .then(() =>
                        MatchModel.collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: inactivityTime }))
                    .then(() =>
                        console.log('MongoDB connected')
                    )
            )
            .catch(() => {
                console.error('MongoDB connection failed...');
            });
    }
}

module.exports = new Mongo();