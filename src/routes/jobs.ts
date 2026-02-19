import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req: AuthRequest, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC');
    const jobs = stmt.all(req.user!.id);
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', (req: AuthRequest, res) => {
  const {
    company,
    role,
    location,
    type,
    status,
    applied_date,
    resume_version,
    recruiter_name,
    recruiter_email,
    recruiter_phone,
    link,
    notes,
  } = req.body;

  if (!company || !role || !status) {
    return res.status(400).json({ message: 'Company, role, and status are required' });
  }

  try {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO jobs (
        id, user_id, company, role, location, type, status, applied_date,
        resume_version, recruiter_name, recruiter_email, recruiter_phone, link, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      req.user!.id,
      company,
      role,
      location,
      type,
      status,
      applied_date || new Date().toISOString(),
      resume_version,
      recruiter_name,
      recruiter_email,
      recruiter_phone,
      link,
      notes
    );

    res.status(201).json({ message: 'Job added successfully', id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const {
    company,
    role,
    location,
    type,
    status,
    applied_date,
    resume_version,
    recruiter_name,
    recruiter_email,
    recruiter_phone,
    link,
    notes,
  } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE jobs SET
        company = ?, role = ?, location = ?, type = ?, status = ?, applied_date = ?,
        resume_version = ?, recruiter_name = ?, recruiter_email = ?, recruiter_phone = ?,
        link = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(
      company,
      role,
      location,
      type,
      status,
      applied_date,
      resume_version,
      recruiter_name,
      recruiter_email,
      recruiter_phone,
      link,
      notes,
      id,
      req.user!.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }

    res.json({ message: 'Job updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, req.user!.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
