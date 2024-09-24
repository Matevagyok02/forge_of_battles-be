import {Router} from "express";
import {UserController} from "./controllers/UserController";

const router = Router();
const userController = new UserController();

const routes = [
    {
        path: "user",
        endpoints: [
            {
                path: ":id",
                type: "GET",
                func: userController.getUser
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

        switch (endpoint.type) {
            case "GET":
                router.get(fullPath, endpoint.func);
                break;
            case "POST":
                router.post(fullPath, endpoint.func);
                break;
            case "PUT":
                router.put(fullPath, endpoint.func);
                break;
            case "DELETE":
                router.delete(fullPath, endpoint.func);
                break;
            default:
                router.get(fullPath, endpoint.func);
        }
    })
})

export default router;