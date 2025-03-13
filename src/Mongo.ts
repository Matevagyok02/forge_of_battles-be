import {MatchModel} from "./models/Match";
import mongoose from "mongoose";

class Mongo {

    readonly uri = process.env.FOB_MONGO_URI;
    readonly inactivityTime = require("../game-rules.json").deleteInactivityTimeSeconds;

    constructor() {
        this.connect().then(connected => {
            if (connected) {
                console.log("MongoDB connected");
            }
        });
    }

    private async createIndex() {
        try {
            const dropIndex = await MatchModel.collection.dropIndex("updatedAt_1");
            if (dropIndex) {
                const createIndex = await MatchModel.collection.createIndex(
                    { updatedAt: 1 },
                    { expireAfterSeconds: this.inactivityTime }
                );

                return !!createIndex;
            } else {
                return false;
            }
        } catch (e: any) {
            console.log("MongoDB index creation failed:", e.message);
            return false;
        }
    }

    private async connect() {
        if (this.uri) {
            try {
                await mongoose.connect(this.uri);
                await this.createIndex();
                return true;
            } catch (e: any) {
                console.log("MongoDB connection error:", e.message);
                return false;
            }
        } else {
            console.log("Missing environment variable: 'FOB_MONGO_URI'");
            return false;
        }
    }
}

export default Mongo;