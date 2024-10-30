import {MatchModel} from "./models/Match";
import mongoose from "mongoose";

class Mongo {

    readonly uri = process.env.FOB_MONGO_URI;
    readonly inactivityTime = require("../game-rules.json").inactivityTime * 60; //inactivity time converted to seconds

    constructor() {
        this.connect();
    }

    connect() {
        if (this.uri) {
            mongoose
                .connect(this.uri)
                .then(() =>
                    MatchModel.collection.dropIndex("updatedAt_1")
                        .then(() =>
                            MatchModel.collection.createIndex(
                                { updatedAt: 1 },
                                { expireAfterSeconds: this.inactivityTime }
                            ))
                        .then(() =>
                            console.log('MongoDB connected')
                        )
                )
                .catch(() => {
                    console.error('MongoDB connection failed...');
                });
        } else {
            console.log("Missing environment variable: 'FOB_MONGO_URI'");
        }
    }
}

export default Mongo;