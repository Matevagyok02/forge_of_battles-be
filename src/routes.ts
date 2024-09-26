import {RequestHandler, Router} from "express";
import {UserController} from "./controllers/UserController";

const router = Router();
const userController = new UserController();

interface Route {
    path: string;
    endpoints: Endpoint[];
}

interface Endpoint {
    path: string;
    func: any;
    method?: string;
}

const routes: Route[] = [
    {
        path: "user",
        endpoints: [
            {
                path: "",
                func: userController.getUser
            },
            {
                path: "friends",
                func: userController.getUserFriends
            },
            {
                path: "find",
                func: userController.getUserByUsername
            },
            {
                path: "register",
                method: "POST",
                func: userController.registerNewUser
            }
        ]
    },
    {
        path: "friends",
        endpoints: [
            {
                path: "invite",
                method: "PUT",
                func: userController.sendFriendRequest
            },
            {
                path: "accept",
                method: "PUT",
                func: userController.acceptFriendRequest
            },
            {
                path: "decline",
                method: "PUT",
                func: userController.declineFriendRequest
            }
        ]
    }
];

//sets up all routes
routes.forEach(entry => {
    const path = entry.path;

    entry.endpoints.forEach(endpoint => {
        const fullPath = `/${path}/${endpoint.path}`;
        const func = endpoint.func;
        const method = endpoint.method;

        switch (method) {
            case "POST":
                router.post(fullPath, func);
                break;
            case "PUT":
                router.put(fullPath, func);
                break;
            case "DELETE":
                router.delete(fullPath, func);
                break;
            default:
                router.get(fullPath, func);
        }
    })
})

export default router;