import {UserService} from "../services/UserService";
import {Request, Response} from "express";
import {getUserId, handleServerError} from "../middleware";

export class UserController {

    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    changeUserPicture = async(req: Request, res: Response)=>  {
        try {
            const userId = getUserId(req);
            const newPicture = req.query.id;

            if (typeof newPicture === "string") {
                const update = await this.userService.changeProfilePicture(userId, newPicture);

                if (update) {
                    res.status(200).json({ message: "Profile picture was changed successfully" });
                } else {
                    res.status(409).json({ message: "The update has failed" });
                }
            } else {
                res.status(400).json({ message: "'id' param is missing" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    getUserAndFriends = async(req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);
            const user = await this.userService.getUserAndFriends(userId);

            if (user)
                res.json(user);
            else
                res.status(404).json({ message: "The user was not found"});
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    getUserByUsernameOrUserId = async(req: Request, res: Response)=> {
        try {
            const username = req.query.username;
            const userId = req.query.id;
            let user;

            if (typeof username === "string" ) {
                user = await this.userService.getUserByUsername(username);
            } else if (typeof userId === "string") {
                user = await this.userService.getUserByUserId(userId);
            } else {
                res.status(400).json({ message: "Missing search parameter, 'username' or 'id' must be specified" });
                return;
            }

            if (user) {
                res.json(user);
            } else {
                res.status(404).json({ message: "The user was not found" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    registerNewUser = async(req: Request, res: Response)=>
    {
        try {
            const userId = getUserId(req);
            const user: {
                username: string;
                picture?: string;
            } = await req.body;

            if (user.username && userId) {
                const usernameTaken = await this.userService.usernameInUse(user.username)

                if (!usernameTaken) {
                    const userInsert = await this.userService.insertNewUser(userId, user.username, user.picture);
                    if (userInsert) {
                        res.status(201).json({ message: "User successfully registered" });
                    } else {
                        res.status(409).json({ message: "This user already has an account" });
                    }
                } else {
                    res.status(409).json({ message: "This username is already taken" });
                }
            } else {
                res.status(400).json({ message: "'username' is missing from request body" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }
}