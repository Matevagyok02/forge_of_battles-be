import {handleServerError} from "../middleware";
import {Request, Response} from "express";

export class ServerAvailabilityTestController {

    static test = async (req: Request, res: Response) => {
        try {
            res.json({ message: "Server is available" });
        } catch (e: any) {
            handleServerError(e, res);
        }
    }
}