import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const jwksClient = jwksRsa({
    jwksUri: `https://dev-58nywxjmv52aaecl.eu.auth0.com/.well-known/jwks.json`,
});

const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    jwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) {
            return callback(err);
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
    });
};

export const checkJwt = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Access Token Required');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, getKey, {
        audience: "https://forge-of-battles-be.onrender.com",
        issuer: "https://dev-58nywxjmv52aaecl.eu.auth0.com/",
        algorithms: ['RS256'],
    }, (err, decoded) => {
        console.log(token);
        if (err || !decoded) {
            return res.status(401).send('Invalid Token');
        }

        // Extract the userId (sub) from the token payload
        const userId = (decoded as any).sub;
        if (!userId) {
            return res.status(401).send('User ID not found');
        }

        // Attach userId to req
        req.userId = userId;

        next();
    });
};
