import {User, UserModel} from "../models/User";
import {isUpdateSuccessful} from "../utils";
import {DuplicateOptionsError} from "@typegoose/typegoose/lib/internal/errors";

const basicParams = "userId username picture";

export class UserService {

    async changeProfilePicture(userId: string, newPicture: string) {
        try {
            const update = await UserModel.updateOne(
                {userId},
                {picture: newPicture}
            ).lean();

            return isUpdateSuccessful(update);
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }

    async getUserAndFriends(userId: string){
        try {
            const user = await UserModel.findOne({userId}).lean();

            if (user) {
                const friends = await UserModel.find({userId: {$in: user.friends}}, basicParams).lean();
                return { user: user, friends: friends};
            } else
                return null;
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async getUserByUserId(userId: string): Promise<User | null> {
        try {
            return await UserModel.findOne({userId}).lean();
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async getUserByUsername(username: string): Promise<User | null> {
        try {
            return await UserModel.findOne({username}, basicParams).lean();
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async insertUser(userId: string, username: string, picture?: string) {
        try {
            const newUser = new User(userId, username, picture);
            const insert = await UserModel.create(newUser);
            return !!insert;
        } catch (error: any) {
            if (error !instanceof DuplicateOptionsError)
                console.error(error);
            return null;
        }
    }

    async getAllUsernames() {
        try {
            const users = await UserModel.find({}, "username").lean();
            const usernames: string[] = [];

            users.forEach((user: { username: string }) => {
                usernames.push(user.username);
            });

            return usernames;
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async usernameInUse(username: string): Promise<boolean> {
        try {
            return !!(await UserModel.exists({username}).lean());
        } catch (error: any) {
            console.error(error);
            return true;
        }
    }

    async areFriends(user1Id: string, user2Id: string) {
        try {
            return !! await UserModel.exists({userId: user1Id, friends: {$in: [user2Id]} }).lean();
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }
}