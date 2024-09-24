import {UserService} from "../services/UserService";
import {Request, Response} from "express";

const userService = new UserService();

export class UserController {

    async getUser(req: Request, res: Response) {
        try {
            const userId = req.params.id;

            const user = await userService.getUserByUserId(userId);

            if (user) {
                res.status(200).json(user);
            } else {
                res.status(404).json({ message: 'User not found' });
            }
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message});
        }
    }

    async logToken(req: Request, res: Response){

    }
}