import {Response, Request, NextFunction} from "express";

//parse user id from request
export const getUserId = (req: Request): string => {
    return req.auth?.payload.sub as string;
}

//handle error + respond
export const handleServerError = (error: any, res: Response) => {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
}

export const checkUserId = (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.auth?.payload.sub;

        if (userId) {
            next();
        } else {
            res.status(401).json({message: "Missing user ID"});
        }
    } catch (e: any) {
        handleServerError(e, res);
    }
}
