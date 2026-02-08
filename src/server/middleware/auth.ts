import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../../db';

// Secret for JWT - in production, this should be an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'banquet-health-secret-key';
const SALT_ROUNDS = 10;

// Extend Express Request to include admin info
declare global {
   namespace Express {
      interface Request {
         adminId?: string;
         patientId?: string;
      }
   }
}

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
   return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a password with a hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
   return bcrypt.compare(password, hash);
};

/**
 * Generate a JWT token for an admin
 */
export const generateToken = (adminId: string): string => {
   return jwt.sign({ adminId }, JWT_SECRET, { expiresIn: '24h' });
};

/**
 * Verify a JWT token
 */
export const verifyToken = (token: string): { adminId: string } | null => {
   try {
      return jwt.verify(token, JWT_SECRET) as { adminId: string };
   } catch {
      return null;
   }
};

/**
 * Middleware to authenticate admin requests using JWT Bearer token
 */
export const authenticateAdmin = async (
   req: Request,
   res: Response,
   next: NextFunction,
): Promise<void> => {
   const authHeader = req.headers.authorization;

   if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
   }

   const token = authHeader.substring(7); // Remove 'Bearer ' prefix
   const decoded = verifyToken(token);

   if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
   }

   // Verify admin still exists
   const admin = await db.admin.findUnique({
      where: { id: decoded.adminId },
   });

   if (!admin) {
      res.status(401).json({ error: 'Admin not found' });
      return;
   }

   req.adminId = decoded.adminId;
   next();
};

/**
 * Middleware to authenticate patient requests using patientId cookie
 */
export const authenticatePatient = async (
   req: Request,
   res: Response,
   next: NextFunction,
): Promise<void> => {
   const patientId = req.cookies?.patientId;

   if (!patientId) {
      res.status(401).json({ error: 'Missing patientId cookie' });
      return;
   }

   // Verify patient exists
   const patient = await db.patient.findUnique({
      where: { id: patientId },
   });

   if (!patient) {
      res.status(401).json({ error: 'Patient not found' });
      return;
   }

   req.patientId = patientId;
   next();
};
