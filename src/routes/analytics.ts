import express from 'express';
import db from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/stats', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE user_id = ?').get(userId) as any;
    const statusCounts = db.prepare('SELECT status, COUNT(*) as count FROM jobs WHERE user_id = ? GROUP BY status').all(userId) as any[];
    
    // Weekly applications (last 7 days)
    const weeklyApplications = db.prepare(`
      SELECT date(applied_date) as date, COUNT(*) as count 
      FROM jobs 
      WHERE user_id = ? AND applied_date >= date('now', '-7 days')
      GROUP BY date(applied_date)
    `).all(userId);

    res.json({
      total: totalJobs.count,
      statusDistribution: statusCounts.reduce((acc: any, curr: any) => {
        acc[curr.status] = curr.count;
        return acc;
      }, {}),
      weeklyTrends: weeklyApplications
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
