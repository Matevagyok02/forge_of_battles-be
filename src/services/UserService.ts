import {User, UserModel} from "../models/User";

export class UserService {

    async getUserByUserId(userId: string): Promise<User | null> {
        try {
            return await UserModel.findOne({userId}).exec();
        } catch (error: any) {
            return null;
        }
    }

    async getUserByUsername(username: string): Promise<User | null> {
        try {
            return await UserModel.findOne({username}).exec();
        } catch (error: any) {
            return null;
        }
    }
}